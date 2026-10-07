// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// Student dashboard: every application with its progress, what needs attention (fees, document
// requests, offers), and the actions: pay, reply, accept or decline an offer, withdraw.
import { CAO } from '../data.js';
import { ART } from '../art.js';
import {
  byId, courseById, STATUS, TIMELINE, ACTIVE, fmtDate, fmtDateTime, rand, profileChecklist, analyse,
} from '../logic.js';
import { $, esc, toast, busy, dialog, statusBadge, monogram, brandVars, confetti } from '../ui.js';
import { refresh, renderAccount } from '../app.js';

let C, main;

const ACTION_WORDS = {
  submit: 'Application submitted', pay: 'Fee paid', review: 'Review started', request_docs: 'Documents requested',
  respond: 'You replied', offer: 'Provisional offer made', waitlist: 'Waitlisted', decline: 'Application unsuccessful',
  accept: 'Offer accepted', decline_offer: 'Offer declined', withdraw: 'Application withdrawn',
};

/** Which timeline step is in progress: earlier steps are done; 5 means all done. */
const STEP_NOW = { awaiting_payment: 1, submitted: 2, under_review: 2, docs_requested: 2, waitlisted: 3, declined: 3, offer: 4, accepted: 5, offer_declined: 5 };
function progress(app) {
  return { current: STEP_NOW[app.status] ?? 0, withdrawn: app.status === 'withdrawn', bad: app.status === 'declined' };
}

/** Unpaid applications grouped into what gets paid together (a CAO group pays once). */
function paymentUnits(apps) {
  const units = new Map();
  for (const a of apps.filter((x) => x.status === 'awaiting_payment')) {
    const key = a.cao_group || a.id;
    if (!units.has(key)) units.set(key, { key, apps: [], amount: 0, cao: !!a.cao_group });
    const u = units.get(key); u.apps.push(a); u.amount += a.fee;
  }
  return [...units.values()];
}

export async function render(el, ctx, query) {
  C = ctx; main = el;
  const apps = [...ctx.apps].sort((a, b) => (ACTIVE.includes(b.status) - ACTIVE.includes(a.status)) || b.updated_at.localeCompare(a.updated_at));
  const check = profileChecklist(ctx.me, ctx.docs);
  const units = paymentUnits(apps);
  const due = units.reduce((s, u) => s + u.amount, 0);
  const offers = apps.filter((a) => a.status === 'offer');
  const docsReq = apps.filter((a) => a.status === 'docs_requested');
  const accepted = apps.find((a) => a.status === 'accepted');
  const paid = apps.filter((a) => a.paid_at && a.fee > 0).reduce((s, a) => s + a.fee, 0);
  const a = analyse(ctx.me.marks || []);

  main.innerHTML = `
    <div class="portal-head">
      <div class="grow"><h1>Hi ${esc(ctx.me.first_names || ctx.me.full_name)}</h1>
        <p>${apps.length ? `You have ${apps.length} application${apps.length === 1 ? '' : 's'}${ctx.me.marks_confirmed_at ? ` · APS ${a.aps}` : ''}.` : 'Welcome. Here is where you will follow every application.'}</p></div>
      <a class="btn btn-gold" href="#/apply">+ New application</a>
    </div>
    ${check.ready ? '' : `<div class="card nudge"><div class="grow"><h2>Finish your profile (${check.percent}%)</h2><p class="muted">You fill it in once. Every institution you apply to gets the same details, marks and documents.</p>
      <ul class="checklist">${check.items.map((i) => `<li class="${i.done ? 'done' : ''}"><a href="#/${i.route}">${i.done ? '<span class="i i-check" aria-hidden="true"></span>' : '<span class="i i-circle" aria-hidden="true"></span>'} ${esc(i.label)}</a></li>`).join('')}</ul></div>
      <a class="btn btn-primary" href="#/${check.items.find((i) => !i.done).route}">Continue <span class="i i-arrow" aria-hidden="true"></span></a></div>`}
    ${accepted ? `<div class="card celebrate" style="${brandVars(byId[accepted.institution_id])}">${ART.skyline(accepted.institution_id, byId[accepted.institution_id].type)}
      <div><span class="eyebrow dark">Your place for ${new Date().getFullYear() + 1}</span><h2>${esc(courseById[accepted.offer_choice || accepted.choice1].name)} at ${esc(byId[accepted.institution_id].name)}</h2>
      <p>Next: watch your email for registration dates, apply for residence, and make sure your NSFAS application is in.</p></div></div>` : ''}
    ${units.length || docsReq.length || offers.length ? `<section class="attention"><h2>Needs your attention</h2><div class="attention-grid">
      ${units.length ? `<div class="attn pay"><span class="attn-ico">${ART.ui('wallet', 20)}</span><div><strong>Pay R${due.toLocaleString('en-ZA')} to complete ${units.reduce((n, u) => n + u.apps.length, 0)} application${units.reduce((n, u) => n + u.apps.length, 0) === 1 ? '' : 's'}</strong>
        <span>Institutions only start reviewing once the fee is paid.</span></div><button class="btn btn-gold" data-pay-all>Pay now</button></div>` : ''}
      ${docsReq.map((x) => `<div class="attn docs"><span class="attn-ico">${ART.ui('clipboard', 20)}</span><div><strong>${esc(byId[x.institution_id].short)} asked for documents</strong><span>${esc(lastNote(x, 'request_docs'))}</span></div><button class="btn btn-primary" data-act="respond" data-id="${x.id}">Reply</button></div>`).join('')}
      ${offers.map((x) => `<div class="attn offer"><span class="attn-ico">${ART.ui('star', 20)}</span><div><strong>Offer from ${esc(byId[x.institution_id].short)}</strong><span>${esc(courseById[x.offer_choice || x.choice1].name)}</span></div><button class="btn btn-primary" data-act="accept" data-id="${x.id}">Respond</button></div>`).join('')}
    </div></section>` : ''}
    <div class="stat-tiles">
      <div class="tile"><strong>${apps.filter((x) => x.status !== 'withdrawn').length}</strong><span>applications</span></div>
      <div class="tile"><strong>${apps.filter((x) => ['offer', 'accepted'].includes(x.status)).length}</strong><span>offers</span></div>
      <div class="tile"><strong>${apps.filter((x) => ['submitted', 'under_review', 'docs_requested', 'waitlisted'].includes(x.status)).length}</strong><span>waiting for a decision</span></div>
      <div class="tile"><strong>R${paid.toLocaleString('en-ZA')}</strong><span>fees paid</span></div>
    </div>
    <div class="dash-layout">
      <div class="app-grid">${apps.length ? apps.map(card).join('') : `<div class="card empty-state">${ART.icon('education', 40)}<h2>No applications yet</h2><p class="muted">Shortlist institutions, choose programmes, and submit them all at once.</p><a class="btn btn-primary" href="#/apply">Start an application</a></div>`}</div>
      <aside class="activity card"><h3>Recent activity</h3>${activity()}</aside>
    </div>`;
  main.onclick = onClick;
  if (query.get('new') && units.length) setTimeout(() => payAll(), 400);
}

function lastNote(app, action) {
  const e = [...C.events].reverse().find((x) => x.application_id === app.id && (!action || x.action === action) && x.note);
  return e?.note || '';
}

function card(app) {
  const i = byId[app.institution_id];
  const p = progress(app);
  const c1 = courseById[app.choice1], c2 = courseById[app.choice2];
  const offered = app.offer_choice && courseById[app.offer_choice];
  const actions = {
    awaiting_payment: `<button class="btn btn-gold btn-sm" data-act="pay" data-id="${app.id}">Pay ${rand(app.cao_group ? unitAmount(app) : app.fee)}</button>`,
    docs_requested: `<button class="btn btn-primary btn-sm" data-act="respond" data-id="${app.id}">Reply</button>`,
    offer: `<button class="btn btn-primary btn-sm" data-act="accept" data-id="${app.id}">Accept</button><button class="btn btn-outline btn-sm" data-act="decline_offer" data-id="${app.id}">Decline</button>`,
  }[app.status] || '';
  const canWithdraw = ['awaiting_payment', 'submitted', 'under_review', 'docs_requested', 'waitlisted'].includes(app.status);
  return `<article class="app-card spot tone-${STATUS[app.status].tone}" style="${brandVars(i)}">
    <div class="app-cover">${ART.skyline(i.id, i.type)}</div>
    <div class="app-body">
      <div class="app-top">${monogram(i)}<div class="grow"><h3>${esc(i.name)}</h3><span class="muted small">${esc(app.ref)}${i.cao ? ' · via CAO' : ''}</span></div>${statusBadge(app.status)}</div>
      <ul class="progs">
        <li class="${offered && offered.id === c1.id ? 'offered' : ''}"><span>1</span>${esc(c1.name)}</li>
        ${c2 ? `<li class="${offered && offered.id === c2.id ? 'offered' : ''}"><span>2</span>${esc(c2.name)}</li>` : ''}
      </ul>
      ${p.withdrawn ? '<p class="muted small">You withdrew this application.</p>' : `<ol class="timeline ${p.bad ? 'bad' : ''}">${TIMELINE.map((label, n) => {
        const lbl = n === 1 && app.fee === 0 && !app.cao_group ? 'No fee' : label;
        const cls = n < p.current ? 'done' : n === p.current ? (p.bad ? 'stop' : 'now') : '';
        return `<li class="${cls}"><span></span>${lbl}</li>`;
      }).join('')}</ol>`}
      ${app.decision_note && ['offer', 'declined', 'waitlisted', 'accepted'].includes(app.status) ? `<p class="note">“${esc(app.decision_note)}”</p>` : ''}
      <div class="app-foot"><span class="muted small">Updated ${fmtDate(app.updated_at.slice(0, 10))}</span>
        <div class="btn-row tight">${actions}<button class="btn btn-text" data-act="details" data-id="${app.id}">Details</button>${canWithdraw ? `<button class="btn btn-text danger" data-act="withdraw" data-id="${app.id}">Withdraw</button>` : ''}</div></div>
    </div>
  </article>`;
}

function unitAmount(app) { return C.apps.filter((a) => a.cao_group === app.cao_group && a.status === 'awaiting_payment').reduce((s, a) => s + a.fee, 0); }

function activity() {
  const mine = [...C.events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  if (!mine.length) return '<p class="muted small">Nothing yet.</p>';
  return `<ol class="feed">${mine.map((e) => {
    const app = C.apps.find((a) => a.id === e.application_id); const i = app && byId[app.institution_id];
    const byMe = e.actor_id === C.me.id;
    return `<li><span class="dot tone-${STATUS[app?.status]?.tone || 'muted'}"></span><div><strong>${esc(ACTION_WORDS[e.action] || e.action)}</strong> · ${esc(i?.short || '')}
      ${e.note && !byMe ? `<p>“${esc(e.note)}”</p>` : ''}<small>${fmtDateTime(e.at)}${byMe ? '' : ` · ${esc(e.actor_name)}`}</small></div></li>`;
  }).join('')}</ol>`;
}

// ───────────────────────── actions
async function act(btn, appId, action, note = '', extra = {}) {
  await busy(btn, async () => {
    await C.api.studentAction(appId, action, note, extra);
    await refresh(); renderAccount();
    await render(main, C, new URLSearchParams());
  });
}

async function pay(app) {
  const unit = paymentUnits(C.apps).find((u) => u.apps.some((a) => a.id === app.id));
  const names = unit.apps.map((a) => byId[a.institution_id].short).join(', ');
  const demo = C.api.kind === 'demo';
  const r = await dialog({
    title: `Pay ${rand(unit.amount)}`,
    body: `<p>${unit.cao ? `One CAO fee covers ${esc(names)}.` : `Application fee for ${esc(byId[app.institution_id].name)}.`}</p>
      ${demo ? `<div class="pay-methods">
        ${[['card', 'Card', 'Visa, Mastercard'], ['eft', 'Instant EFT', 'All major SA banks'], ['cash', 'Pay at a shop', 'Pick n Pay, Shoprite, Checkers']].map(([v, l, s], n) => `
          <label class="pay-opt"><input type="radio" name="method" value="${v}" ${n === 0 ? 'checked' : ''}><span><strong>${l}</strong><small>${s}</small></span></label>`).join('')}
        </div><p class="hint">Demo: no money moves. A made-up payment reference is recorded.</p>`
      : `<ol class="howto"><li>Pay ${rand(unit.amount)} on the ${unit.cao ? 'CAO' : 'institution\'s'} payment page or by EFT, using <strong>${esc(app.ref)}</strong> as your reference.</li>
          <li>Enter the reference from your proof of payment below.</li></ol>
        <label class="field"><span>Payment reference</span><input id="pay-ref" name="payment_ref" required placeholder="e.g. FNB 7731 0942"></label>
        <p class="hint">${unit.cao ? `<a href="${CAO.url}" target="_blank" rel="noopener">CAO payment options <span class="i i-ext" aria-hidden="true"></span></a>` : `<a href="${esc(byId[app.institution_id].apply)}" target="_blank" rel="noopener">${esc(byId[app.institution_id].short)} fees page <span class="i i-ext" aria-hidden="true"></span></a>`}</p>`}`,
    buttons: [{ label: 'Cancel', value: null }, { label: demo ? `Pay ${rand(unit.amount)}` : 'Record payment', kind: 'btn-gold', value: 'pay' }],
  });
  if (!r) return false;
  await C.api.studentAction(app.id, 'pay', '', { payment_ref: demo ? '' : String(r.form.get('payment_ref')).trim() });
  return true;
}

async function payAll() {
  const units = paymentUnits(C.apps);
  let n = 0;
  for (const u of units) {
    try { if (!(await pay(u.apps[0]))) break; n++; } catch (e) { toast(e.message, 'bad'); break; }
  }
  if (n) {
    await refresh(); renderAccount(); await render(main, C, new URLSearchParams());
    toast(n === units.length ? 'All fees paid. Your applications are with the institutions.' : 'Payment recorded.');
  }
}

async function onClick(e) {
  if (e.target.closest('[data-pay-all]')) { payAll(); return; }
  const t = e.target.closest('[data-act]');
  if (!t || !t.dataset.id) return;
  const app = C.apps.find((a) => a.id === t.dataset.id);
  const i = byId[app.institution_id];
  switch (t.dataset.act) {
    case 'pay':
      try { if (await pay(app)) { await refresh(); renderAccount(); await render(main, C, new URLSearchParams()); toast('Payment recorded. The institution can now review your application.'); } }
      catch (err) { toast(err.message, 'bad'); }
      break;
    case 'respond': {
      const r = await dialog({
        title: `Reply to ${i.short}`,
        body: `<p class="muted">They asked:</p><blockquote>${esc(lastNote(app, 'request_docs'))}</blockquote>
          <p>Upload anything new under <a href="#/profile?tab=documents">Profile, Documents tab</a> first, then send a short reply.</p>
          <label class="field"><span>Your reply</span><textarea id="reply" name="note" rows="3" required placeholder="e.g. I've uploaded my Grade 12 June results."></textarea></label>`,
        buttons: [{ label: 'Cancel', value: null }, { label: 'Send reply', kind: 'btn-primary', value: 'send' }],
      });
      if (r) await act(t, app.id, 'respond', r.form.get('note'));
      break;
    }
    case 'accept': {
      const others = C.apps.filter((a) => a.id !== app.id && a.status === 'offer');
      const r = await dialog({
        title: `Offer from ${i.name}`,
        body: `<p><strong>${esc(courseById[app.offer_choice || app.choice1].name)}</strong></p>${app.decision_note ? `<blockquote>${esc(app.decision_note)}</blockquote>` : ''}
          <p>Accepting reserves your place. ${others.length ? `Your other offer${others.length > 1 ? 's' : ''} (${others.map((o) => byId[o.institution_id].short).join(', ')}) will be declined automatically.` : ''}</p>`,
        buttons: [{ label: 'Not now', value: null }, { label: 'Decline offer', kind: 'btn-outline', value: 'decline' }, { label: 'Accept offer', kind: 'btn-gold', value: 'accept' }],
      });
      if (r?.value === 'accept') { await act(t, app.id, 'accept'); confetti(); toast(`Congratulations! You accepted your place at ${i.short}.`); }
      if (r?.value === 'decline') await act(t, app.id, 'decline_offer');
      break;
    }
    case 'decline_offer': {
      const r = await dialog({ title: 'Decline this offer?', body: `<p>You can't undo this. ${esc(i.short)} may give your place to someone else.</p>`, buttons: [{ label: 'Keep it', value: null }, { label: 'Decline offer', kind: 'btn-danger', value: 'yes' }] });
      if (r) await act(t, app.id, 'decline_offer');
      break;
    }
    case 'withdraw': {
      const r = await dialog({ title: `Withdraw from ${i.short}?`, body: '<p>Your application stops here. Fees already paid are not refunded.</p>', buttons: [{ label: 'Keep it', value: null }, { label: 'Withdraw', kind: 'btn-danger', value: 'yes' }] });
      if (r) await act(t, app.id, 'withdraw');
      break;
    }
    case 'details': details(app); break;
    default:
  }
}

function details(app) {
  const i = byId[app.institution_id];
  const events = C.events.filter((e) => e.application_id === app.id).sort((a, b) => a.at.localeCompare(b.at));
  dialog({
    title: `${i.short} · ${app.ref}`,
    wide: true,
    body: `<div class="kv">
        <div class="fact"><small>Status</small><strong>${statusBadge(app.status)}</strong></div>
        <div class="fact"><small>Fee</small><strong>${app.cao_group ? 'CAO' : rand(app.fee)}${app.paid_at ? ' · paid' : ''}</strong></div>
        <div class="fact"><small>Submitted</small><strong>${fmtDate(app.submitted_at.slice(0, 10))}</strong></div>
        <div class="fact"><small>Payment reference</small><strong>${esc(app.payment_ref || '—')}</strong></div>
      </div>
      <h3>History</h3>
      <ol class="feed">${events.map((e) => `<li><span class="dot"></span><div><strong>${esc(ACTION_WORDS[e.action] || e.action)}</strong>${e.note ? `<p>“${esc(e.note)}”</p>` : ''}<small>${fmtDateTime(e.at)} · ${esc(e.actor_id === C.me.id ? 'You' : e.actor_name)}</small></div></li>`).join('')}</ol>
      <p class="hint"><a href="${esc(i.web)}" target="_blank" rel="noopener">${esc(i.name)} website <span class="i i-ext" aria-hidden="true"></span></a></p>`,
  });
}
