// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// New application: choose several institutions and programmes, check eligibility, then submit
// them all at once with a single fee total (the CAO fee is charged once for KZN).
import { INSTITUTIONS, TYPES, CAO } from '../data.js';
import {
  byId, courseById, closingStatus, isOpen, fmtDate, rand, analyse, eligibility, feeBreakdown, basketProblems,
  profileChecklist, MAX_INSTITUTIONS, programmesOf, minLabel,
} from '../logic.js';
import { sourceOf, facultiesOf, facultyTitle } from '../programmes.js';
import { $, esc, toast, busy, store, monogram, brandVars, confetti } from '../ui.js';
import { refresh, renderAccount } from '../app.js';

let C, items, step, main, plannedKind = '';
const draftKey = () => `draft:${C.me.id}`;
const saveDraft = () => store.set(draftKey(), { items, step });

function taken() { return new Set(C.apps.filter((a) => a.status !== 'withdrawn').map((a) => a.institution_id)); }
const canPick = (i) => isOpen(i) || !C.api.enforceDates;

const QUAL = { degree: '', diploma: ' · Diploma', hc: ' · Higher Certificate' };
function courseOptions(inst, selected, allowNone) {
  const progs = programmesOf(inst.id);
  return (allowNone ? '<option value="">No second choice</option>' : `<option value="">Choose one of ${progs.length} programmes…</option>`)
    + facultiesOf(inst.id).map((f) =>
      `<optgroup label="${esc(f.title)}">${f.programmes.map((p) =>
        `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)} (${esc(minLabel(p))})</option>`).join('')}</optgroup>`).join('');
}
/** The programme of a given kind at an institution, if it offers one. */
const ofKind = (instId, kind) => (kind ? programmesOf(instId).find((p) => p.kind === kind) : null);

export async function render(el, ctx, query) {
  C = ctx; main = el;
  const draft = store.get(draftKey(), null);
  const already = taken();
  items = (draft?.items || []).filter((it) => byId[it.institution_id] && !already.has(it.institution_id));
  step = draft?.step || 1;
  // Bring in the shortlist and a programme chosen in the career guide.
  for (const id of ctx.shortlist) if (!already.has(id) && !items.some((it) => it.institution_id === id)) items.push({ institution_id: id, choice1: '', choice2: '' });
  const planned = query.get('course') || store.get('planned', '');
  if (planned) {
    for (const it of items) if (!it.choice1) it.choice1 = ofKind(it.institution_id, planned)?.id || '';
    plannedKind = planned;
    store.set('planned', '');
  }
  saveDraft();
  draw();
}

function draw() {
  const check = profileChecklist(C.me, C.docs);
  main.innerHTML = `
    <div class="portal-head"><div><h1>New application</h1>
      <p>Choose where you want to study and what. We send one application to each institution and give you one fee total.</p></div></div>
    ${check.ready ? '' : `<div class="callout warn gate"><strong>Finish your profile before you submit.</strong>
      <ul>${check.items.filter((i) => !i.done).map((i) => `<li><a href="#/${i.route}">${esc(i.label)} →</a></li>`).join('')}</ul>
      You can still choose institutions now. Your choices are saved.</div>`}
    ${C.api.enforceDates ? '' : '<div class="callout info">Demo: closing dates are shown but not enforced, so you can try every institution.</div>'}
    <ol class="stepper three">
      ${['Choices', 'Eligibility', 'Review & submit'].map((l, n) => `<li class="${step === n + 1 ? 'active' : step > n + 1 ? 'done' : ''}"><button data-step="${n + 1}"><span>${n + 1}</span>${l}</button></li>`).join('')}
    </ol>
    <div class="apply-layout">
      <div class="apply-main" id="step-body"></div>
      <aside class="apply-side"><div class="summary-card" id="summary"></div></aside>
    </div>`;
  ({ 1: stepChoices, 2: stepEligibility, 3: stepReview })[step]();
  drawSummary();
  main.onclick = onClick;
  main.onchange = onChange;
  main.oninput = onInput;
}

function goStep(n) {
  if (n > 1 && !items.length) { toast('Add at least one institution first.', 'bad'); return; }
  if (n > 1 && items.some((it) => !it.choice1)) { toast('Choose a first-choice programme at every institution.', 'bad'); return; }
  step = n; saveDraft(); draw(); scrollTo({ top: 0, behavior: 'smooth' });
}

// ───────────────────────── step 1
function stepChoices() {
  const already = taken();
  const chosen = new Set(items.map((i) => i.institution_id));
  const kind = courseById[items.find((i) => i.choice1)?.choice1]?.kind || plannedKind;
  $('#step-body').innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Your choices <span class="count-pill">${items.length}/${MAX_INSTITUTIONS - already.size}</span></h2>
        ${items.length > 1 && courseById[items[0].choice1]?.kind ? `<button class="btn btn-text" data-act="same">Choose the same kind of programme everywhere</button>` : ''}</div>
      ${items.length ? '' : '<p class="empty">No institutions yet. Add some from the list below or from <a href="#/universities">Universities</a>.</p>'}
      <div class="choice-list">${items.map((it, n) => {
        const i = byId[it.institution_id]; const st = closingStatus(i);
        return `<div class="choice" style="${brandVars(i)}">
          <div class="choice-top">${monogram(i)}
            <div class="grow"><strong>${esc(i.name)}</strong><span class="muted small">${esc(i.city)} · ${i.cao ? `CAO · R${CAO.fee} once` : rand(i.fee)} · ${programmesOf(i.id).length} programmes · <span class="badge ${st.key}">${esc(st.label)}</span></span></div>
            <button class="icon-btn" data-remove="${n}" aria-label="Remove ${esc(i.short)}" title="Remove">✕</button></div>
          <div class="grid-2">
            <label class="field"><span>1st choice</span><select id="c1-${i.id}" data-c1="${n}">${courseOptions(i, it.choice1)}</select></label>
            <label class="field"><span>2nd choice (optional)</span><select id="c2-${i.id}" data-c2="${n}">${courseOptions(i, it.choice2, true)}</select></label>
          </div>
          ${progLine(it.choice1)}${sourceOf(i.id) === 'compiled' ? '<p class="hint">Programme list compiled from the institution\'s website. Check the prospectus for exact requirements.</p>' : ''}
        </div>`;
      }).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Add institutions</h2>
        <label class="search small"><input type="search" id="add-q" placeholder="Search institution or programme, e.g. Pharmacy" aria-label="Search institutions or programmes"></label></div>
      <div class="pick-list" id="add-list">${addList(chosen, already, kind, '')}</div>
    </div>
    <div class="btn-row end"><button class="btn btn-primary" data-step="2">Check eligibility →</button></div>`;
}

/** One-line summary of a chosen programme: minimum, subjects, duration. */
function progLine(id) {
  const p = courseById[id];
  if (!p) return '';
  const reqs = Object.entries(p.req).map(([k, v]) => `${{ eng: 'English', math: 'Maths', mathOrLit: 'Maths/Maths Lit', sci: 'Physical Sci', life: 'Life Sci', acc: 'Accounting' }[k]} ${v}%`).join(' · ');
  return `<p class="prog-line"><span class="prog-fac">${esc(facultyTitle(p.faculty))}</span><strong>${esc(minLabel(p))}</strong>${reqs ? ` · ${esc(reqs)}` : ''} · ${p.years} year${p.years === 1 ? '' : 's'}${p.note ? ` · ${esc(p.note)}` : ''}</p>`;
}

function addList(chosen, already, kind, q) {
  const needle = q.toLowerCase();
  const matches = (i) => !needle || `${i.name} ${i.short} ${i.city}`.toLowerCase().includes(needle) || programmesOf(i.id).some((p) => p.name.toLowerCase().includes(needle));
  const list = INSTITUTIONS.filter((i) => !chosen.has(i.id) && matches(i))
    .sort((a, b) => (+!!already.has(a.id) - +!!already.has(b.id)) || (+!canPick(a) - +!canPick(b))
      || (kind ? +!ofKind(a.id, kind) - +!ofKind(b.id, kind) : 0) || a.name.localeCompare(b.name));
  return list.map((i) => {
    const st = closingStatus(i); const done = already.has(i.id); const blocked = done || !canPick(i);
    const hit = needle && programmesOf(i.id).filter((p) => p.name.toLowerCase().includes(needle));
    const k = kind && ofKind(i.id, kind);
    const hint = hit && hit.length ? ` · offers ${esc(hit[0].name)}${hit.length > 1 ? ` +${hit.length - 1}` : ''}` : kind ? (k ? ` · offers ${esc(k.name)}` : ' · doesn\'t offer this programme') : '';
    return `<button class="pick ${blocked ? 'disabled' : ''}" data-add="${i.id}" ${blocked ? 'disabled' : ''} style="${brandVars(i)}">
      ${monogram(i, 'sm')}<span class="pick-name">${esc(i.name)}<small>${esc(i.city)} · ${esc(TYPES[i.type])}${hint}</small></span>
      <span class="pick-right"><strong>${done ? 'Applied' : i.cao ? 'R' + CAO.fee + ' CAO' : rand(i.fee)}</strong><span class="badges"><span class="badge ${st.key}">${esc(st.label)}</span></span></span></button>`;
  }).join('') || '<p class="muted">No matches.</p>';
}

// ───────────────────────── step 2
function stepEligibility() {
  const a = analyse(C.me.marks || []);
  if (!C.me.marks_confirmed_at || a.count < 4) {
    $('#step-body').innerHTML = `<div class="card"><h2>Eligibility check</h2>
      <div class="callout info">Confirm your marks in your profile first. The estimate uses only your own confirmed marks.</div>
      <div class="btn-row"><a class="btn btn-primary" href="#/profile?tab=marks">Enter my marks →</a><button class="btn btn-outline" data-step="1">← Back</button></div></div>`;
    return;
  }
  const rows = items.map((it) => {
    const i = byId[it.institution_id];
    return { it, i, e1: eligibility(courseById[it.choice1], i, a), e2: it.choice2 ? eligibility(courseById[it.choice2], i, a) : null };
  });
  const best = (r) => (r.e1.key === 'yes' || !r.e2 ? r.e1 : [r.e1, r.e2].sort((x, y) => 'yes maybe no na'.indexOf(x.key) - 'yes maybe no na'.indexOf(y.key))[0]);
  const unlikely = rows.filter((r) => ['no', 'na'].includes(best(r).key));
  const all = feeBreakdown(items.map((x) => x.institution_id), caoOpts()).total;
  const saved = all - feeBreakdown(rows.filter((r) => !unlikely.includes(r)).map((r) => r.i.id), caoOpts()).total;
  const n = (k) => rows.filter((r) => best(r).key === k).length;
  const badge = (e) => `<span class="badge ${{ yes: 'open', maybe: 'soon', no: 'closed', na: 'closed' }[e.key]}">${esc(e.label)}</span>`;
  $('#step-body').innerHTML = `<div class="card">
    <h2>Eligibility check</h2>
    <p class="muted">Your APS is <strong>${a.aps}</strong>. Each programme's minimum comes from the institution's own requirements. Where it scores applicants its own way, we compare against a standard-APS equivalent. Meeting the minimum doesn't guarantee a place.</p>
    <div class="banner ${n('yes') ? 'good' : 'warn'}"><span class="ico">${n('yes') ? '✅' : '⚠️'}</span><div>
      <strong>Likely eligible at ${n('yes')} of ${rows.length}${n('maybe') ? ` · borderline at ${n('maybe')}` : ''}</strong>
      <p>${unlikely.length ? `${unlikely.length} look out of reach. Removing them saves ${rand(saved)}.` : 'None of your choices look out of reach.'}</p></div></div>
    <div class="table-scroll"><table class="elig-table">
      <thead><tr><th>Institution</th><th>1st choice</th><th>2nd choice</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td><strong>${esc(r.i.short)}</strong><small>${esc(r.i.city)}</small></td>
        <td>${esc(courseById[r.it.choice1].name)}<small>Minimum: ${esc(minLabel(courseById[r.it.choice1]))}${courseById[r.it.choice1].min ? ` (≈ APS ${r.e1.cutoff})` : ''}</small>${badge(r.e1)}${r.e1.reqs.filter((q) => !q.ok).map((q) => `<small class="bad">${esc(q.label)} ${q.have}% (needs ${q.min}%)</small>`).join('')}</td>
        <td>${r.e2 ? `${esc(courseById[r.it.choice2].name)}<small>Minimum: ${esc(minLabel(courseById[r.it.choice2]))}</small>${badge(r.e2)}` : '<span class="muted">—</span>'}</td>
      </tr>`).join('')}</tbody></table></div>
    ${unlikely.length ? `<div class="btn-row"><button class="btn btn-outline" data-act="drop">Remove ${unlikely.length} unlikely choice${unlikely.length === 1 ? '' : 's'}</button></div>` : ''}
  </div>
  <div class="btn-row between"><button class="btn btn-outline" data-step="1">← Back</button><button class="btn btn-primary" data-step="3">Review &amp; submit →</button></div>`;
  $('#step-body').dataset.drop = unlikely.map((r) => r.i.id).join(',');
}

// ───────────────────────── step 3
function stepReview() {
  const fb = feeBreakdown(items.map((x) => x.institution_id), caoOpts());
  const problems = basketProblems(items, { profile: C.me, docs: C.docs, existing: C.apps, enforceDates: C.api.enforceDates });
  const me = C.me;
  $('#step-body').innerHTML = `<div class="card">
    <h2>Review &amp; submit</h2>
    <div class="review-grid">
      <div class="fact"><small>Applicant</small><strong>${esc(me.full_name)}</strong></div>
      <div class="fact"><small>APS</small><strong>${analyse(me.marks || []).aps}</strong></div>
      <div class="fact"><small>Documents</small><strong>${C.docs.length} uploaded</strong></div>
    </div>
    <div class="table-scroll"><table class="elig-table">
      <thead><tr><th>Institution</th><th>Programmes</th><th>Closes</th><th class="num">Fee</th></tr></thead>
      <tbody>${fb.lines.map((l) => { const it = items.find((x) => x.institution_id === l.inst.id); return `<tr>
        <td><strong>${esc(l.inst.short)}</strong><small>${esc(l.inst.name)}</small></td>
        <td>1. ${esc(courseById[it.choice1]?.name || '—')}${it.choice2 ? `<small>2. ${esc(courseById[it.choice2].name)}</small>` : ''}</td>
        <td>${fmtDate(l.inst.closes)}</td>
        <td class="num">${l.included ? '<span class="muted">in CAO fee</span>' : rand(l.amount)}</td></tr>`; }).join('')}</tbody>
      <tfoot><tr><th colspan="3">Total to pay</th><th class="num">R${fb.total.toLocaleString('en-ZA')}</th></tr></tfoot></table></div>
    ${problems.length ? `<div class="callout bad"><strong>Before you can submit:</strong><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
    <fieldset class="declare"><legend>Declaration</legend>
      <label class="check"><input type="checkbox" id="d1" required> The information in my profile is true and complete. I understand an institution can cancel an offer if it is not.</label>
      <label class="check"><input type="checkbox" id="d2" required> I agree that ImbizoConnect sends my profile, marks and documents to the institutions listed above (POPIA).</label>
      <label class="check"><input type="checkbox" id="d3" required> I understand application fees are not refundable.</label>
    </fieldset>
    <div class="btn-row between"><button class="btn btn-outline" data-step="2">← Back</button>
      <button class="btn btn-gold btn-lg" data-act="submit" ${problems.length ? 'disabled' : ''}>Submit ${items.length} application${items.length === 1 ? '' : 's'}</button></div>
  </div>`;
}

function caoOpts() { return { alreadyPaidCao: C.apps.some((a) => byId[a.institution_id]?.cao && a.status !== 'withdrawn') }; }

function drawSummary() {
  const fb = feeBreakdown(items.map((x) => x.institution_id), caoOpts());
  const free = fb.lines.filter((l) => !l.inst.cao && l.amount === 0).length;
  $('#summary').innerHTML = `
    <div class="summary-head"><h3>Fee summary</h3><span class="muted">${items.length} institution${items.length === 1 ? '' : 's'}</span></div>
    <div class="summary-body">${fb.lines.length ? fb.lines.map((l) => `
      <div class="sum-line"><div>${esc(l.inst.short)}<small>${esc(l.label)}</small></div>
      <span class="amt ${l.included ? 'muted' : l.amount === 0 ? 'free' : ''}">${l.included ? 'R' + CAO.fee : rand(l.amount)}</span></div>`).join('')
      : '<div class="sum-empty">Nothing chosen yet.</div>'}</div>
    <div class="summary-total"><span>Total</span><strong>R${fb.total.toLocaleString('en-ZA')}</strong></div>
    <p class="summary-note">${[
      fb.caoCount > 1 ? `The CAO saves you R${(fb.naive - fb.total).toLocaleString('en-ZA')}.` : '',
      caoOpts().alreadyPaidCao && fb.caoCount ? 'Your CAO fee is already covered.' : '',
      free ? `${free} of your choices ${free === 1 ? 'is' : 'are'} free.` : '',
      C.me.nsfas && fb.total ? 'NSFAS applicants can ask each institution for a fee waiver.' : '',
    ].filter(Boolean).join(' ')}</p>`;
}

async function submit(btn) {
  if (!['d1', 'd2', 'd3'].every((id) => $('#' + id).checked)) { toast('Tick all three declarations to submit.', 'bad'); return; }
  await busy(btn, async () => {
    const created = await C.api.submitApplications(items.map(({ institution_id, choice1, choice2 }) => ({ institution_id, choice1, choice2: choice2 || null })));
    for (const it of items) C.shortlist.delete(it.institution_id);
    C.saveLocal();
    items = []; step = 1; saveDraft();
    await refresh(); renderAccount();
    confetti();
    const owed = created.filter((a) => a.status === 'awaiting_payment').reduce((s, a) => s + a.fee, 0);
    toast(`Submitted to ${created.length} institution${created.length === 1 ? '' : 's'}.${owed ? ` Pay R${owed} to complete.` : ''}`);
    location.hash = '#/applications?new=1';
  });
}

// ───────────────────────── events
function onClick(e) {
  const t = e.target.closest('[data-step],[data-add],[data-remove],[data-act]');
  if (!t) return;
  if (t.dataset.step) goStep(Number(t.dataset.step));
  else if (t.dataset.add) {
    if (items.length + taken().size >= MAX_INSTITUTIONS) { toast(`You can apply to at most ${MAX_INSTITUTIONS} institutions per intake.`, 'bad'); return; }
    const i = byId[t.dataset.add];
    const kind = courseById[items.find((x) => x.choice1)?.choice1]?.kind || plannedKind;
    items.push({ institution_id: i.id, choice1: ofKind(i.id, kind)?.id || '', choice2: '' });
    C.shortlist.add(i.id); C.saveLocal(); renderAccount();
    saveDraft(); draw();
  } else if (t.dataset.remove) {
    const [gone] = items.splice(Number(t.dataset.remove), 1);
    C.shortlist.delete(gone.institution_id); C.saveLocal(); renderAccount();
    saveDraft(); draw();
  } else if (t.dataset.act === 'same') {
    const c = courseById[items[0].choice1];
    let n = 0, missing = 0;
    for (const it of items.slice(1)) {
      const match = ofKind(it.institution_id, c.kind);
      if (!match) { missing++; continue; }
      if (it.choice1 !== match.id) { it.choice1 = match.id; if (it.choice2 === match.id) it.choice2 = ''; n++; }
    }
    saveDraft(); draw();
    toast(`${n ? `Updated ${n} institution${n === 1 ? '' : 's'}.` : 'Nothing to change.'}${missing ? ` ${missing} don't offer a matching programme.` : ''}`);
  } else if (t.dataset.act === 'drop') {
    const drop = new Set(($('#step-body').dataset.drop || '').split(',').filter(Boolean));
    items = items.filter((it) => !drop.has(it.institution_id));
    for (const id of drop) C.shortlist.delete(id);
    C.saveLocal(); renderAccount(); saveDraft(); draw(); toast(`Removed ${drop.size}.`);
  } else if (t.dataset.act === 'submit') submit(t);
}
function onChange(e) {
  const t = e.target;
  if (t.dataset.c1 !== undefined) { items[+t.dataset.c1].choice1 = t.value; if (items[+t.dataset.c1].choice2 === t.value) items[+t.dataset.c1].choice2 = ''; saveDraft(); draw(); }
  if (t.dataset.c2 !== undefined) { items[+t.dataset.c2].choice2 = t.value === items[+t.dataset.c2].choice1 ? '' : t.value; if (t.value && !items[+t.dataset.c2].choice2) toast('Pick a different programme for your second choice.', 'bad'); saveDraft(); }
}
function onInput(e) {
  if (e.target.id !== 'add-q') return;
  const kind = courseById[items.find((i) => i.choice1)?.choice1]?.kind || plannedKind;
  $('#add-list').innerHTML = addList(new Set(items.map((i) => i.institution_id)), taken(), kind, e.target.value);
}

