// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// Student profile: personal and school details, marks, and documents. Filled in once and
// shared with every institution the student applies to.
import { DOCUMENTS, SUBJECTS } from '../data.js';
import { validSAID, profileChecklist, analyse, marksProblems, fmtDateTime, fmtDate } from '../logic.js';
import { $, esc, toast, busy, fmtSize, dialog } from '../ui.js';
import { fillSubjects, readSubjects, livePoints } from './public.js';
import { refresh, renderAccount } from '../app.js';

const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];
const LANGUAGES = ['Afrikaans', 'English', 'IsiNdebele', 'IsiXhosa', 'IsiZulu', 'Sepedi', 'Sesotho', 'Setswana', 'Siswati', 'Tshivenda', 'Xitsonga', 'South African Sign Language', 'Other'];
const TERMS = { gr11: 'Grade 11 final results', gr12_june: 'Grade 12 June results', final: 'Final NSC results' };

function ring(percent) {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
    <circle cx="32" cy="32" r="${r}" class="ring-bg"/>
    <circle cx="32" cy="32" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - percent / 100)}"/>
    <text x="32" y="37" text-anchor="middle">${percent}%</text></svg>`;
}

export async function render(main, ctx, query) {
  const tab = query.get('tab') || 'details';
  const me = ctx.me;
  const check = profileChecklist(me, ctx.docs);
  main.innerHTML = `
    <div class="portal-head profile-head">
      ${ring(check.percent)}
      <div class="grow">
        <h1>${esc(me.full_name || 'Your profile')}</h1>
        <p>${esc(me.email)} · ${check.ready ? 'Your profile is complete. You can apply.' : 'Complete these to apply:'}</p>
        <ul class="checklist">${check.items.map((i) => `<li class="${i.done ? 'done' : ''}"><a href="#/${i.route}">${i.done ? '✓' : '○'} ${esc(i.label)}</a></li>`).join('')}</ul>
      </div>
      ${check.ready ? '<a class="btn btn-gold" href="#/apply">Start an application →</a>' : ''}
    </div>
    <nav class="tabs" role="tablist">
      ${[['details', 'Details'], ['marks', 'Marks'], ['documents', 'Documents']].map(([k, l]) => `<a role="tab" href="#/profile?tab=${k}" class="${tab === k ? 'active' : ''}" aria-selected="${tab === k}">${l}</a>`).join('')}
    </nav>
    <div id="tab-body"></div>`;
  const body = $('#tab-body');
  if (tab === 'marks') return marksTab(body, ctx);
  if (tab === 'documents') return documentsTab(body, ctx);
  return detailsTab(body, ctx);
}

// ───────────────────────── details
function detailsTab(body, ctx) {
  const p = ctx.me;
  const opt = (list, v) => list.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const field = (name, label, attrs = '', hint = '') => `<label class="field"><span>${label}</span><input id="pf-${name}" name="${name}" value="${esc(p[name] ?? '')}" ${attrs}>${hint}</label>`;
  body.innerHTML = `<form id="details" class="card" novalidate>
    <fieldset><legend>About you</legend><div class="grid-2">
      ${field('first_names', 'First names', 'required autocomplete="given-name"')}
      ${field('surname', 'Surname', 'required autocomplete="family-name"')}
      ${field('id_number', 'SA ID number', 'required inputmode="numeric" maxlength="13"', '<small class="field-hint" id="id-hint"></small>')}
      ${field('phone', 'Cellphone', 'required type="tel" autocomplete="tel" placeholder="e.g. 072 555 0142"')}
      <label class="field"><span>Home language</span><select id="pf-home_language" name="home_language"><option value="">Select…</option>${opt(LANGUAGES, p.home_language)}</select></label>
      <label class="field"><span>Email</span><input value="${esc(p.email)}" disabled></label>
    </div>
    <label class="check"><input type="checkbox" id="pf-disability" name="disability" ${p.disability ? 'checked' : ''}> I have a disability and would like institutions to contact me about support</label>
    </fieldset>
    <fieldset><legend>Home address</legend><div class="grid-2">
      <label class="field span-2"><span>Street address</span><input id="pf-address" name="address" value="${esc(p.address || '')}" required autocomplete="street-address"></label>
      ${field('city', 'Town or city', 'autocomplete="address-level2"')}
      ${field('postal_code', 'Postal code', 'inputmode="numeric" maxlength="4" autocomplete="postal-code"')}
      <label class="field"><span>Province</span><select id="pf-province" name="province" required><option value="">Select…</option>${opt(PROVINCES, p.province)}</select></label>
    </div></fieldset>
    <fieldset><legend>Parent or guardian</legend><div class="grid-2">
      ${field('guardian_name', 'Full name', 'required')}
      ${field('guardian_relation', 'Relationship', 'placeholder="e.g. Mother, Grandfather"')}
      ${field('guardian_phone', 'Cellphone', 'type="tel"')}
    </div></fieldset>
    <fieldset><legend>School</legend><div class="grid-2">
      ${field('school', 'High school', 'required autocomplete="organization"')}
      <label class="field"><span>Where are you now?</span><select id="pf-school_status" name="school_status">
        <option value="gr12" ${p.school_status === 'gr12' ? 'selected' : ''}>In Grade 12</option>
        <option value="matric" ${p.school_status === 'matric' ? 'selected' : ''}>Finished matric</option>
        <option value="upgrade" ${p.school_status === 'upgrade' ? 'selected' : ''}>Upgrading my marks</option></select></label>
      ${field('matric_year', 'Matric year', 'type="number" min="1990" max="2030"')}
    </div></fieldset>
    <fieldset><legend>Funding</legend>
      <label class="check"><input type="checkbox" id="pf-nsfas" name="nsfas" ${p.nsfas ? 'checked' : ''}> I'm applying for NSFAS (household income R350 000 a year or less)</label>
      <p class="hint">NSFAS is a separate application at <a href="https://www.nsfas.org.za/" target="_blank" rel="noopener">nsfas.org.za</a>. Ticking this lets institutions know.</p>
    </fieldset>
    <div class="btn-row between"><span class="muted small" id="saved-at"></span><button class="btn btn-primary">Save details</button></div>
  </form>`;
  const form = $('#details');
  const hint = () => {
    const v = form.elements.id_number.value.trim(); const h = $('#id-hint');
    if (!v) { h.textContent = '13 digits. We check the date of birth and check digit.'; h.className = 'field-hint'; return; }
    const r = validSAID(v); h.textContent = (r.ok ? '✓ ' : '') + r.msg; h.className = 'field-hint ' + (r.ok ? 'ok' : 'err');
  };
  hint();
  form.elements.id_number.addEventListener('input', hint);
  form.addEventListener('input', (e) => e.target.classList.remove('invalid'));
  form.onsubmit = (e) => {
    e.preventDefault();
    let bad = null;
    for (const el of form.elements) {
      if (!el.name) continue;
      let wrong = el.required && !String(el.value).trim();
      if (!wrong && el.name === 'id_number') wrong = !validSAID(el.value).ok;
      if (!wrong && el.name === 'phone') wrong = el.value.replace(/\D/g, '').length < 10;
      el.classList.toggle('invalid', wrong);
      if (wrong && !bad) bad = el;
    }
    if (bad) { bad.focus(); toast('Please fix the highlighted fields.', 'bad'); return; }
    const f = new FormData(form);
    const patch = {};
    for (const [k, v] of f.entries()) patch[k] = String(v).trim();
    patch.nsfas = form.elements.nsfas.checked;
    patch.disability = form.elements.disability.checked;
    patch.matric_year = patch.matric_year ? Number(patch.matric_year) : null;
    patch.id_number = patch.id_number.replace(/\s/g, '');
    busy(e.submitter, async () => {
      ctx.me = await ctx.api.saveProfile(patch);
      await refresh(); renderAccount();
      toast('Details saved');
      const check = profileChecklist(ctx.me, ctx.docs);
      location.hash = check.items[1].done ? (check.ready ? '#/profile?tab=details' : '#/profile?tab=documents') : '#/profile?tab=marks';
    });
  };
}

// ───────────────────────── marks
function marksTab(body, ctx) {
  const p = ctx.me;
  const opts = SUBJECTS.map((s) => `<option>${esc(s)}</option>`).join('');
  body.innerHTML = `<div class="aps-layout">
    <form id="marks" class="card" novalidate>
      <div class="card-head"><h2>Your marks</h2>
        <label class="field inline"><span>These are my</span><select id="pf-term" name="marks_term">${Object.entries(TERMS).map(([k, l]) => `<option value="${k}" ${p.marks_term === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <p class="muted">Enter all seven subjects exactly as they appear on your report. Universities use your latest results for provisional offers.</p>
      <div>${Array.from({ length: 7 }, (_, n) => `
        <div class="subject-row">
          <span class="n">${n + 1}</span>
          <select id="pm-subj-${n}" data-subj="${n}" aria-label="Subject ${n + 1}"><option value="">Select subject…</option>${opts}</select>
          <input id="pm-mark-${n}" type="number" data-mark="${n}" min="0" max="100" inputmode="numeric" placeholder="%" aria-label="Mark for subject ${n + 1}">
          <span class="pts" data-pts="${n}">–</span>
        </div>`).join('')}</div>
      <div class="callout ${p.marks_confirmed_at ? 'good' : 'warn'}" id="marks-state">${p.marks_confirmed_at
        ? `Confirmed on ${fmtDateTime(p.marks_confirmed_at)}. Institutions you apply to see these marks.`
        : 'Not confirmed yet. Confirm your marks to check eligibility and apply.'}</div>
      <label class="check"><input type="checkbox" id="pm-true" required> These marks are correct. I understand institutions will check them against my report and NSC results.</label>
      <div class="btn-row"><button class="btn btn-primary">Confirm marks</button><a class="btn btn-text" href="#/aps">Open the career guide</a></div>
    </form>
    <aside class="aps-side"><div class="aps-score-card" id="pm-card">
      <span class="label">Your APS</span><strong id="pm-aps">–</strong><span class="sub" id="pm-sub"></span>
      <div class="meter"><span id="pm-meter"></span></div><div class="pass-type" id="pm-pass"></div></div></aside>
  </div>`;
  const form = $('#marks');
  const update = () => {
    livePoints(form);
    const a = analyse(readSubjects(form));
    $('#pm-aps').textContent = a.count ? a.aps : '–';
    $('#pm-sub').textContent = `from ${a.count} subject${a.count === 1 ? '' : 's'} · max 42`;
    $('#pm-meter').style.width = Math.min(100, (a.aps / 42) * 100) + '%';
    $('#pm-pass').textContent = a.pass ? a.pass.label : '';
  };
  fillSubjects(form, p.marks?.length ? p.marks : ctx.local.confirmed ? ctx.local.marks : []);
  update();
  form.addEventListener('input', () => {
    update();
    const st = $('#marks-state');
    if (p.marks_confirmed_at) { st.className = 'callout warn'; st.textContent = 'You changed your marks. Confirm them again to save.'; }
  });
  form.addEventListener('change', update);
  form.onsubmit = (e) => {
    e.preventDefault();
    const marks = readSubjects(form);
    const problems = marksProblems(marks);
    if (problems.length) { toast(problems.join(' '), 'bad'); return; }
    if (!$('#pm-true').checked) { toast('Tick the box to confirm your marks are correct.', 'bad'); return; }
    busy(e.submitter, async () => {
      ctx.me = await ctx.api.saveProfile({ marks: marks.filter((x) => x.s), marks_term: form.elements.marks_term.value, marks_confirmed_at: new Date().toISOString() });
      await refresh(); renderAccount();
      toast(`Marks confirmed · APS ${analyse(marks).aps}`);
      location.hash = profileChecklist(ctx.me, ctx.docs).ready ? '#/apply' : '#/profile?tab=documents';
    });
  };
}

// ───────────────────────── documents
function documentsTab(body, ctx) {
  const byKind = Object.fromEntries(ctx.docs.map((d) => [d.kind, d]));
  body.innerHTML = `<div class="card">
    <h2>Documents</h2>
    <p class="muted">Upload each document once. Institutions you apply to can open them; nobody else can. PDF, JPG or PNG, up to 10 MB.</p>
    <div class="doc-list">${DOCUMENTS.map((d) => {
      const f = byKind[d.id];
      return `<div class="doc ${f ? 'done' : ''}">
        <div class="doc-ico">${d.icon}</div>
        <div><div class="doc-name">${esc(d.name)}${d.required ? '<span class="req-tag">Required</span>' : ''}</div>
        <div class="doc-hint">${f ? `✓ ${esc(f.name)} · ${fmtSize(f.size)} · uploaded ${fmtDate(f.uploaded_at.slice(0, 10))}` : esc(d.hint)}</div></div>
        <div class="btn-row tight">
          ${f ? `<button class="btn btn-text" data-view="${f.id}">View</button><button class="btn btn-text danger" data-del="${f.id}">Remove</button>` : ''}
          <label class="btn btn-outline btn-sm">${f ? 'Replace' : 'Upload'}<input type="file" id="doc-${d.id}" data-kind="${d.id}" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"></label>
        </div>
      </div>`;
    }).join('')}</div>
    <div class="callout warn">Certified copies must usually be less than three months old. Police stations certify documents for free.</div>
  </div>`;
  body.onchange = async (e) => {
    const input = e.target.closest('input[type=file]'); const file = input?.files?.[0];
    if (!file) return;
    const label = input.closest('label');
    label.classList.add('is-busy');
    try {
      await ctx.api.uploadDocument(input.dataset.kind, file);
      await refresh(); renderAccount();
      toast('Uploaded');
      documentsTab(body, ctx);
      const check = profileChecklist(ctx.me, ctx.docs);
      if (check.ready) location.hash = '#/profile?tab=documents';
    } catch (err) { toast(err.message, 'bad'); label.classList.remove('is-busy'); }
  };
  body.onclick = async (e) => {
    const v = e.target.closest('[data-view]'); const d = e.target.closest('[data-del]');
    if (v) {
      const doc = ctx.docs.find((x) => x.id === v.dataset.view);
      busy(v, async () => { const url = await ctx.api.documentUrl(doc); openFile(url, doc); });
    }
    if (d) {
      const ok = await dialog({ title: 'Remove this document?', body: '<p>Institutions you applied to will no longer be able to open it.</p>', buttons: [{ label: 'Cancel', value: null }, { label: 'Remove', kind: 'btn-danger', value: 'yes' }] });
      if (!ok) return;
      busy(d, async () => { await ctx.api.removeDocument(d.dataset.del); await refresh(); renderAccount(); documentsTab(body, ctx); toast('Removed'); });
    }
  };
}

/** Shows a document in a dialog (images) or opens it in a new tab (PDF). */
export function openFile(url, doc) {
  if (/^image\//.test(doc.type || '')) {
    dialog({ title: doc.name, body: `<img class="doc-preview" src="${esc(url)}" alt="${esc(doc.name)}">`, wide: true });
    return;
  }
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
}

