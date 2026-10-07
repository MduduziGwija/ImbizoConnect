// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// Admin: who is an admissions officer (and for which institution), and an overview per institution.
import { INSTITUTIONS } from '../data.js';
import { byId, rand } from '../logic.js';
import { $, esc, toast, busy, monogram, brandVars } from '../ui.js';
import { refresh, renderAccount } from '../app.js';

export async function render(main, ctx) {
  const people = [...ctx.profiles].sort((a, b) => a.role.localeCompare(b.role) || (a.surname || '').localeCompare(b.surname || ''));
  const per = INSTITUTIONS.map((i) => {
    const apps = ctx.apps.filter((a) => a.institution_id === i.id);
    return { i, n: apps.length, offers: apps.filter((a) => ['offer', 'accepted'].includes(a.status)).length,
      accepted: apps.filter((a) => a.status === 'accepted').length, unpaid: apps.filter((a) => a.status === 'awaiting_payment').length,
      fees: apps.filter((a) => a.paid_at).reduce((s, a) => s + a.fee, 0), officers: people.filter((p) => p.institution_id === i.id).length };
  }).filter((r) => r.n || r.officers).sort((a, b) => b.n - a.n);
  const alerts = await ctx.api.alerts().catch(() => []);
  const alertCounts = INSTITUTIONS.map((i) => ({ i, n: alerts.filter((a) => a.institution_ids.includes(i.id)).length })).filter((r) => r.n).sort((a, b) => b.n - a.n);
  const opts = (sel) => `<option value="">Choose institution…</option>${INSTITUTIONS.map((i) => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.short)} · ${esc(i.name)}</option>`).join('')}`;
  main.innerHTML = `
    <div class="portal-head"><div class="grow"><h1>Admin</h1><p>${people.length} accounts · ${ctx.apps.length} applications across ${per.filter((r) => r.n).length} institutions</p></div></div>
    <div class="card"><h2>Institutions</h2><div class="table-scroll"><table class="data-table">
      <thead><tr><th>Institution</th><th class="num">Applications</th><th class="num">Unpaid</th><th class="num">Offers</th><th class="num">Accepted</th><th class="num">Fees paid</th><th class="num">Officers</th></tr></thead>
      <tbody>${per.map((r) => `<tr style="${brandVars(r.i)}"><td><span class="row-inst">${monogram(r.i, 'sm')} ${esc(r.i.name)}</span></td><td class="num">${r.n}</td><td class="num">${r.unpaid}</td><td class="num">${r.offers}</td><td class="num">${r.accepted}</td><td class="num">${rand(r.fees)}</td><td class="num">${r.officers || '<span class="badge tone-warn">none</span>'}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h2>Opening alerts</h2>
      <p class="muted">${alerts.length} request${alerts.length === 1 ? '' : 's'} to be told by email or WhatsApp when applications open. ${alerts.filter((a) => a.whatsapp).length} by WhatsApp, ${alerts.filter((a) => a.email).length} by email. Sending them needs an email service and the WhatsApp Business API, which this concept leaves out.</p>
      ${alertCounts.length ? `<div class="chip-cloud">${alertCounts.map((r) => `<span class="alert-count" style="${brandVars(r.i)}">${monogram(r.i, 'sm')} ${esc(r.i.short)} <b>${r.n}</b></span>`).join('')}</div>` : ''}</div>
    <div class="card"><h2>People and roles</h2>
      <p class="muted">New sign-ups are students. Make someone an admissions officer to give them their institution's queue. Only admins can change roles; the database enforces this.</p>
      <div class="table-scroll"><table class="data-table people">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Institution</th><th></th></tr></thead>
      <tbody>${people.map((p) => `<tr data-user="${p.id}">
        <td><strong>${esc(p.full_name || '—')}</strong>${p.id === ctx.me.id ? ' <span class="badge tone-info">you</span>' : ''}</td>
        <td class="break">${esc(p.email)}</td>
        <td><select id="role-${p.id}" name="role" aria-label="Role for ${esc(p.full_name)}" ${p.id === ctx.me.id ? 'disabled' : ''}>
          ${['student', 'officer', 'admin'].map((r) => `<option value="${r}" ${p.role === r ? 'selected' : ''}>${{ student: 'Student', officer: 'Admissions officer', admin: 'Admin' }[r]}</option>`).join('')}</select></td>
        <td><select id="inst-${p.id}" name="institution" aria-label="Institution for ${esc(p.full_name)}" ${p.role === 'officer' ? '' : 'hidden'}>${opts(p.institution_id)}</select>${p.role !== 'officer' && p.institution_id ? esc(byId[p.institution_id]?.short || '') : ''}</td>
        <td><button class="btn btn-sm btn-outline" data-save="${p.id}" hidden>Save</button></td>
      </tr>`).join('')}</tbody></table></div></div>
    ${ctx.api.kind === 'demo' ? '<div class="card"><h2>Demo data</h2><p class="muted">Put the demo back the way it started: made-up students, applications and officers.</p><button class="btn btn-outline" data-act="reset-demo">Reset demo</button></div>' : ''}`;

  main.onchange = (e) => {
    const tr = e.target.closest('tr[data-user]'); if (!tr) return;
    const role = tr.querySelector('[name=role]').value;
    tr.querySelector('[name=institution]').hidden = role !== 'officer';
    tr.querySelector('[data-save]').hidden = false;
  };
  main.onclick = (e) => {
    const b = e.target.closest('[data-save]'); if (!b) return;
    const tr = b.closest('tr');
    const role = tr.querySelector('[name=role]').value;
    const inst = tr.querySelector('[name=institution]').value;
    if (role === 'officer' && !inst) { toast('Choose the institution this officer works for.', 'bad'); return; }
    busy(b, async () => {
      await ctx.api.setRole(b.dataset.save, role, inst);
      await refresh(); renderAccount();
      await render(main, ctx);
      toast('Role saved');
    });
  };
}
