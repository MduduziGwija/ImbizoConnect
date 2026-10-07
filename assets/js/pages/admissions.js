// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// Admissions portal for institution staff: the application queue, an applicant review panel
// (profile, marks, documents, history) and decisions. Officers see only their own institution;
// the database enforces that. Admins see every institution.
import { INSTITUTIONS, DOCUMENTS } from '../data.js';
import {
  byId, courseById, STATUS, OFFICER_ACTIONS, points, isLO, validSAID, fmtDate, fmtDateTime, rand, applicantSummary,
  actionError, maskID,
} from '../logic.js';
import { $, esc, toast, busy, dialog, statusBadge, monogram, brandVars, store, fmtSize } from '../ui.js';
import { refresh, renderAccount } from '../app.js';
import { openFile } from './profile.js';
import { facultyTitle } from '../programmes.js';

let C, main;
const f = { q: '', status: 'active', course: '', sort: 'new', inst: store.get('adm-inst', '') };
const ACTIVE_Q = ['submitted', 'under_review', 'docs_requested', 'waitlisted'];
const WORDS = {
  submit: 'Applied', pay: 'Fee paid', review: 'Review started', request_docs: 'Documents requested', respond: 'Applicant replied',
  offer: 'Provisional offer', waitlist: 'Waitlisted', decline: 'Declined', accept: 'Offer accepted', decline_offer: 'Offer declined', withdraw: 'Withdrawn',
};

const person = (id) => C.profiles.find((p) => p.id === id) || {};
const ageOf = (p) => { const v = validSAID(p.id_number); if (!v.ok) return ''; const b = new Date(v.dob); const n = new Date(); return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0); };

function scope() {
  if (C.me.role === 'officer') return C.apps.filter((a) => a.institution_id === C.me.institution_id);
  return f.inst ? C.apps.filter((a) => a.institution_id === f.inst) : C.apps;
}

function rows() {
  const q = f.q.trim().toLowerCase();
  let list = scope().filter((a) => {
    if (f.status === 'active' && !ACTIVE_Q.includes(a.status)) return false;
    if (f.status !== 'active' && f.status !== 'all' && a.status !== f.status) return false;
    if (f.course && a.choice1 !== f.course && a.choice2 !== f.course) return false;
    if (q) { const p = person(a.student_id); if (!`${p.full_name} ${a.ref} ${p.id_number} ${p.email}`.toLowerCase().includes(q)) return false; }
    return true;
  }).map((a) => ({ a, p: person(a.student_id), s: applicantSummary(a, person(a.student_id)) }));
  const sorters = {
    new: (x, y) => y.a.updated_at.localeCompare(x.a.updated_at),
    old: (x, y) => x.a.submitted_at.localeCompare(y.a.submitted_at),
    aps: (x, y) => y.s.aps - x.s.aps,
    name: (x, y) => (x.p.surname || '').localeCompare(y.p.surname || ''),
  };
  return list.sort(sorters[f.sort]);
}

export async function render(el, ctx) {
  C = ctx; main = el;
  const inst = C.me.role === 'officer' ? byId[C.me.institution_id] : (f.inst ? byId[f.inst] : null);
  const all = scope();
  const count = (st) => all.filter((a) => st.includes(a.status)).length;
  const courses = [...new Set(all.flatMap((a) => [a.choice1, a.choice2]).filter(Boolean))].map((id) => courseById[id]).sort((a, b) => a.name.localeCompare(b.name));
  main.innerHTML = `
    <div class="portal-head ${inst ? 'branded' : ''}" style="${inst ? brandVars(inst) : ''}">
      ${inst ? monogram(inst, 'lg') : ''}
      <div class="grow"><h1>Admissions${inst ? ` · ${esc(inst.short)}` : ''}</h1>
        <p>${inst ? esc(inst.name) : 'All institutions'} · ${all.length} application${all.length === 1 ? '' : 's'} received${C.me.role === 'officer' ? '. Unpaid applications appear once the fee is paid.' : ''}</p></div>
      ${C.me.role === 'admin' ? `<label class="field inline"><span>Institution</span><select id="adm-inst"><option value="">All</option>${INSTITUTIONS.map((i) => `<option value="${i.id}" ${f.inst === i.id ? 'selected' : ''}>${esc(i.short)}</option>`).join('')}</select></label>` : ''}
    </div>
    <div class="stat-tiles six">
      ${[['submitted', 'New'], ['under_review', 'In review'], ['docs_requested', 'Waiting on applicant'], ['waitlisted', 'Waitlisted'], ['offer,accepted', 'Offers made'], ['accepted', 'Accepted']].map(([st, l]) =>
        `<button class="tile" data-filter="${st}"><strong>${count(st.split(','))}</strong><span>${l}</span></button>`).join('')}
    </div>
    <div class="toolbar adm">
      <label class="search"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input type="search" id="adm-q" placeholder="Search name, reference or ID number" value="${esc(f.q)}" aria-label="Search applicants"></label>
      <select id="adm-status" aria-label="Status"><option value="active">Needs a decision</option><option value="all">All statuses</option>${Object.entries(STATUS).filter(([k]) => k !== 'awaiting_payment').map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select>
      <select id="adm-course" aria-label="Programme"><option value="">All programmes</option>${[...new Set(courses.map((c) => c.faculty))].sort().map((f) => `<optgroup label="${esc(facultyTitle(f))}">${courses.filter((c) => c.faculty === f).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`).join('')}</select>
      <select id="adm-sort" aria-label="Sort"><option value="new">Recently updated</option><option value="old">Oldest first</option><option value="aps">Highest APS</option><option value="name">Surname A–Z</option></select>
      <button class="btn btn-outline" id="adm-csv">Export CSV</button>
    </div>
    <div class="card table-card"><div class="table-scroll" id="adm-table"></div></div>`;
  $('#adm-status').value = f.status; $('#adm-course').value = f.course; $('#adm-sort').value = f.sort;
  drawTable();
  main.oninput = (e) => { if (e.target.id === 'adm-q') { f.q = e.target.value; drawTable(); } };
  main.onchange = (e) => {
    if (e.target.id === 'adm-status') f.status = e.target.value;
    if (e.target.id === 'adm-course') f.course = e.target.value;
    if (e.target.id === 'adm-sort') f.sort = e.target.value;
    if (e.target.id === 'adm-inst') { f.inst = e.target.value; store.set('adm-inst', f.inst); render(main, C); return; }
    drawTable();
  };
  main.onclick = (e) => {
    const tile = e.target.closest('[data-filter]');
    if (tile) { f.status = tile.dataset.filter.includes(',') ? 'offer' : tile.dataset.filter; $('#adm-status').value = f.status; drawTable(); return; }
    if (e.target.closest('#adm-csv')) { exportCsv(); return; }
    const row = e.target.closest('[data-app]');
    if (row) review(row.dataset.app);
  };
}

function eligBadge(e) {
  if (!e) return '';
  return `<span class="badge ${{ yes: 'open', maybe: 'soon', no: 'closed', na: 'closed' }[e.key]}" title="Estimated cut-off APS ${e.cutoff ?? '—'}">${esc(e.label)}</span>`;
}

function drawTable() {
  const list = rows();
  $('#adm-table').innerHTML = list.length ? `<table class="data-table adm-table">
    <thead><tr><th>Reference</th><th>Applicant</th><th class="num">APS</th><th>Programmes (estimate)</th><th>Status</th><th>Updated</th><th></th></tr></thead>
    <tbody>${list.map(({ a, p, s }) => `<tr data-app="${a.id}" tabindex="0">
      <td class="mono">${esc(a.ref)}${C.me.role === 'admin' && !f.inst ? `<small>${esc(byId[a.institution_id].short)}</small>` : ''}</td>
      <td><strong>${esc(p.full_name || '—')}</strong><small>${esc([p.city, p.province].filter(Boolean).join(', '))}${p.nsfas ? ' · NSFAS' : ''}</small></td>
      <td class="num"><strong>${s.aps || '—'}</strong>${s.confirmed ? '' : '<small>unconfirmed</small>'}</td>
      <td>1. ${esc(courseById[a.choice1].name)} ${eligBadge(s.e1)}${a.choice2 ? `<small>2. ${esc(courseById[a.choice2].name)} ${eligBadge(s.e2)}</small>` : ''}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${fmtDate(a.updated_at.slice(0, 10))}</td>
      <td><button class="btn btn-sm btn-outline">Open</button></td>
    </tr>`).join('')}</tbody></table>`
    : '<div class="empty-state"><h3>No applications here</h3><p class="muted">Try another status or clear the search.</p></div>';
}

async function review(appId) {
  const a = C.apps.find((x) => x.id === appId);
  const p = person(a.student_id);
  const inst = byId[a.institution_id];
  const s = applicantSummary(a, p);
  let docs = [];
  try { docs = await C.api.documents(p.id); } catch (e) { toast(e.message, 'bad'); }
  const events = C.events.filter((e) => e.application_id === a.id).sort((x, y) => x.at.localeCompare(y.at));
  const age = ageOf(p);
  const marks = (p.marks || []).filter((m) => m.s);
  const allowed = Object.entries(OFFICER_ACTIONS).filter(([k]) => !actionError(OFFICER_ACTIONS, k, a, { note: 'x' }));
  const byKind = Object.fromEntries(docs.map((d) => [d.kind, d]));

  const r = await dialog({
    title: `${p.full_name} · ${a.ref}`,
    wide: true,
    body: `<div class="review">
      <div class="review-main">
        <div class="applicant-head">
          <span class="avatar xl">${esc((p.first_names?.[0] || '') + (p.surname?.[0] || ''))}</span>
          <div><h3>${esc(p.full_name)}</h3>
          <p class="muted">${[age ? `${age} years` : '', p.home_language, p.city && p.province ? `${p.city}, ${p.province}` : p.province].filter(Boolean).map(esc).join(' · ')}</p>
          <div class="badges">${statusBadge(a.status)}${p.nsfas ? '<span class="badge tone-info">NSFAS applicant</span>' : ''}${p.disability ? '<span class="badge tone-warn">Disability support</span>' : ''}${inst.cao ? '<span class="badge cao">via CAO</span>' : ''}</div></div>
        </div>
        <div class="kv three">
          <div class="fact"><small>SA ID</small><strong class="mono">${esc(maskID(p.id_number))}</strong></div>
          <div class="fact"><small>Cellphone</small><strong>${esc(p.phone || '—')}</strong></div>
          <div class="fact"><small>Email</small><strong class="break">${esc(p.email || '—')}</strong></div>
          <div class="fact"><small>School</small><strong>${esc(p.school || '—')}</strong></div>
          <div class="fact"><small>Status</small><strong>${esc({ gr12: 'Grade 12', matric: `Matric ${p.matric_year || ''}`, upgrade: 'Upgrading' }[p.school_status] || '—')}</strong></div>
          <div class="fact"><small>Parent / guardian</small><strong>${esc(p.guardian_name || '—')}${p.guardian_phone ? `<small>${esc(p.guardian_phone)}</small>` : ''}</strong></div>
        </div>
        <h3>Marks <span class="muted small">${esc({ gr11: 'Grade 11 final', gr12_june: 'Grade 12 June', final: 'Final NSC' }[p.marks_term] || '')}${p.marks_confirmed_at ? ` · confirmed ${fmtDate(p.marks_confirmed_at.slice(0, 10))}` : ' · not confirmed'}</span></h3>
        <table class="marks-table"><tbody>${marks.map((m) => `<tr><td>${esc(m.s)}</td><td class="num">${m.m}%</td><td class="num"><span class="pt">${isLO(m.s) ? '—' : points(m.m)}</span></td></tr>`).join('')}</tbody>
          <tfoot><tr><th>APS (standard, excl. LO)</th><th></th><th class="num">${s.aps}</th></tr></tfoot></table>
        <p class="small">${esc(s.pass?.label || '')}</p>
        <h3>Programmes</h3>
        <ul class="prog-check">${[[a.choice1, s.e1], [a.choice2, s.e2]].filter(([c]) => c).map(([c, e], n) => `<li><span class="num-dot">${n + 1}</span><div><strong>${esc(courseById[c].name)}</strong>
          <small>Estimated cut-off APS ${e.cutoff ?? '—'} · ${e.reqs.map((q) => `${esc(q.label)} ${q.have}%/${q.min}% ${q.ok ? '✓' : '✗'}`).join(' · ')}</small></div>${eligBadge(e)}</li>`).join('')}</ul>
        <h3>Documents</h3>
        <ul class="doc-mini">${DOCUMENTS.map((d) => { const x = byKind[d.id]; return `<li class="${x ? 'has' : ''}"><span>${d.icon}</span><div><strong>${esc(d.name)}</strong><small>${x ? `${esc(x.name)} · ${fmtSize(x.size)}` : d.required ? 'Missing (required)' : 'Not uploaded'}</small></div>${x ? `<button type="button" class="btn btn-sm btn-outline" data-doc="${x.id}">Open</button>` : ''}</li>`; }).join('')}</ul>
      </div>
      <aside class="review-side">
        <h3>Decision</h3>
        ${allowed.length ? `
          <div class="decide">${allowed.map(([k, v], n) => `<label class="decide-opt ${k}"><input type="radio" name="action" value="${k}" ${n === 0 ? 'checked' : ''}><span>${esc(v.label)}</span></label>`).join('')}</div>
          <div id="offer-choice" class="field"><span>Offer for</span><select name="offer_choice">${[a.choice1, a.choice2].filter(Boolean).map((c) => `<option value="${c}">${esc(courseById[c].name)}</option>`).join('')}</select></div>
          <label class="field"><span>Note to the applicant <small id="note-req"></small></span><textarea name="note" rows="4" placeholder="Shown to the applicant"></textarea></label>`
          : `<p class="muted">No further decisions: this application is ${esc(STATUS[a.status].label.toLowerCase())}.</p>`}
        <h3>History</h3>
        <ol class="feed">${events.map((e) => `<li><span class="dot"></span><div><strong>${esc(WORDS[e.action] || e.action)}</strong>${e.note ? `<p>“${esc(e.note)}”</p>` : ''}<small>${fmtDateTime(e.at)} · ${esc(e.actor_name)}</small></div></li>`).join('')}</ol>
        <p class="small muted">Fee: ${a.cao_group ? 'CAO' : rand(a.fee)}${a.payment_ref ? ` · ref ${esc(a.payment_ref)}` : ''}</p>
      </aside>
    </div>`,
    buttons: allowed.length ? [{ label: 'Close', value: null }, { label: 'Save decision', kind: 'btn-primary', value: 'save', validate: false }] : [{ label: 'Close', value: null }],
    onOpen: (d) => {
      const sync = () => {
        const act = d.querySelector('input[name=action]:checked')?.value;
        const oc = d.querySelector('#offer-choice'); if (oc) oc.hidden = act !== 'offer';
        const nr = d.querySelector('#note-req'); if (nr) nr.textContent = OFFICER_ACTIONS[act]?.note ? '(required)' : '(optional)';
      };
      d.addEventListener('change', sync); sync();
      d.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-doc]'); if (!b) return;
        const doc = docs.find((x) => x.id === b.dataset.doc);
        busy(b, async () => openFile(await C.api.documentUrl(doc), doc));
      });
    },
  });
  if (!r) return;
  const action = r.form.get('action');
  const note = String(r.form.get('note') || '').trim();
  const err = actionError(OFFICER_ACTIONS, action, a, { note });
  if (err) { toast(err, 'bad'); review(appId); return; }
  await busy(null, async () => {
    await C.api.officerAction(a.id, action, note, { offer_choice: r.form.get('offer_choice') });
    await refresh(); renderAccount();
    await render(main, C);
    toast(`${OFFICER_ACTIONS[action].label}: saved for ${p.full_name}`);
  });
}

function exportCsv() {
  const list = rows();
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Reference', 'Institution', 'Surname', 'First names', 'ID number', 'Email', 'Cellphone', 'Province', 'School', 'APS', 'Pass', 'First choice', 'Second choice', 'Status', 'Offer', 'Submitted', 'Payment ref'];
  const lines = list.map(({ a, p, s }) => [a.ref, byId[a.institution_id].short, p.surname, p.first_names, p.id_number, p.email, p.phone, p.province, p.school, s.aps, s.pass?.key || '',
    courseById[a.choice1].name, a.choice2 ? courseById[a.choice2].name : '', STATUS[a.status].label, a.offer_choice ? courseById[a.offer_choice].name : '', a.submitted_at.slice(0, 10), a.payment_ref || ''].map(cell).join(','));
  const csv = [head.map(cell).join(','), ...lines].join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url; link.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`Exported ${list.length} application${list.length === 1 ? '' : 's'}`);
}

