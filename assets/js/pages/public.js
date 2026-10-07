// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// Public pages (no sign-in needed): home, universities with map and details drawer, the APS
// calculator and career guide. Their markup lives in index.html; this module fills it in.
import { INSTITUTIONS, COURSES, CAO, FIELDS, TYPES, SUBJECTS, SAMPLE_RESULTS, CAREERS, INTAKE_YEAR } from '../data.js';
import { PROGRAMMES, programmesOf, sourceOf, facultiesOf, facultyTitle } from '../programmes.js';
import { ART } from '../art.js';
import { alertButton } from './alerts.js';
import {
  byId, MONTHS, closingStatus, isOpen, daysUntil, fmtDate, rand, analyse, points, isLO, checkReqs, eligibility,
  marksProblems, minLabel,
} from '../logic.js';
const kindById = Object.fromEntries(COURSES.map((c) => [c.id, c]));
import { $, $$, esc, toast, store, brandOf, brandVars, monogram, fmtSize, copyText } from '../ui.js';

const FIELD_COLOURS = { health: '#1a7f5a', engineering: '#a8792a', science: '#0e6f86', commerce: '#1e3a5f', law: '#5b4a9e', humanities: '#a3485f', education: '#4f7a28', ict: '#2f5d8c' };
let C = null;       // shared app context
let shell = null;   // { renderAccount, go }
let query = new URLSearchParams();

const cycleOver = () => INSTITUTIONS.every((i) => !isOpen(i));
const canShortlist = (i) => isOpen(i) || !C.api.enforceDates || cycleOver();
const appliedTo = (id) => C.me?.role === 'student' && C.apps.some((a) => a.institution_id === id && a.status !== 'withdrawn');

/** The marks the public pages use: the student's confirmed profile marks, or the visitor's own. */
function currentMarks() {
  if (C.me?.role === 'student' && C.me.marks?.length) return { marks: C.me.marks, confirmed: !!C.me.marks_confirmed_at };
  return { marks: C.local.marks, confirmed: C.local.confirmed };
}

export function prospectus(inst) {
  const local = (window.PROSPECTUS_LOCAL || {})[inst.id];
  const p = inst.prospectus || {};
  if (local) return { kind: 'local', href: local.file, size: local.size, year: p.year };
  if (p.pdf) return { kind: 'pdf', href: p.pdf, year: p.year };
  if (p.page && p.page !== inst.web) return { kind: 'page', href: p.page, year: p.year };
  return { kind: 'none', href: inst.web, year: p.year };
}

function toggleShortlist(id, force) {
  const inst = byId[id];
  const add = force ?? !C.shortlist.has(id);
  if (add) {
    if (appliedTo(id)) { toast(`You already applied to ${inst.short}.`); return false; }
    if (!canShortlist(inst)) { toast(`${inst.short} closed on ${fmtDate(inst.closes)}. Try another university.`, 'bad'); return false; }
    C.shortlist.add(id); toast(`${inst.short} added to your shortlist`);
  } else {
    C.shortlist.delete(id); toast(`${inst.short} removed from your shortlist`);
  }
  C.saveLocal();
  refreshShortlistViews();
  return true;
}

function refreshShortlistViews() {
  shell.renderAccount();
  if (!$('[data-screen="universities"]').hidden) renderUniversities();
  if ($('#hero-map')?.children.length) paintMap($('#hero-map'), () => true);
  const d = $('#drawer');
  if (!d.hidden && d.dataset.id) openDrawer(d.dataset.id);
}

// ─────────────────────────── home
export function home() {
  const open = INSTITUTIONS.filter((i) => isOpen(i));
  $('#hero-open-count').textContent = open.length
    ? `${open.length} universities still open for ${INTAKE_YEAR}`
    : `${INTAKE_YEAR} applications have closed`;

  const upcoming = [...open].sort((a, b) => a.closes.localeCompare(b.closes)).slice(0, 6);
  $('#closing-title').textContent = upcoming.length ? 'Closing soon' : 'Recently closed';
  const list = upcoming.length ? upcoming : [...INSTITUTIONS].sort((a, b) => b.closes.localeCompare(a.closes)).slice(0, 6);
  $('#deadline-list').innerHTML = list.map((i) => {
    const st = closingStatus(i); const [, m, d] = i.closes.split('-').map(Number);
    return `<li data-open="${i.id}" tabindex="0" style="${brandVars(i)}">
      <div class="dl-badge"><span><b>${d}</b>${MONTHS[m - 1]}</span></div>
      <div class="dl-main"><strong>${esc(i.name)}</strong><span>${esc(st.label)}${i.cao ? ' · via CAO' : ''}</span></div>
      <span class="dl-fee">${i.cao ? 'R' + CAO.fee : rand(i.fee)}</span>
    </li>`;
  }).join('');

  const free = INSTITUTIONS.filter((i) => i.fee === 0);
  const paid = INSTITUTIONS.filter((i) => i.fee > 0).map((i) => i.fee);
  $('#stat-unis').textContent = INSTITUTIONS.length;
  $('#stat-free').textContent = free.length;
  $('#stat-range').textContent = `R0 – R${Math.max(...paid)}`;
  $('#stat-pdfs').textContent = INSTITUTIONS.filter((i) => ['local', 'pdf'].includes(prospectus(i).kind)).length;
  $('#free-list').innerHTML = free.map((i) => `<a href="#/universities?open=${i.id}" style="${brandVars(i)}"><b>R0</b> ${esc(i.name)}</a>`).join('');
  const closed = INSTITUTIONS.filter((i) => !isOpen(i));
  const strip = $('#closed-strip');
  if (strip) {
    strip.hidden = !closed.length;
    strip.innerHTML = closed.length ? `<div>${ART.ui('bell', 20)}</div><p><strong>${closed.length} of ${INSTITUTIONS.length} institutions have closed applications for ${INTAKE_YEAR}.</strong> Get an email or WhatsApp message when each one opens for the next intake.</p>
      <button class="btn btn-gold btn-sm" data-alert="${closed.map((i) => i.id).join(',')}">Alert me when they open</button>` : '';
  }
  renderHeroCards();
  if (!$('#hero-map').children.length) mountMap($('#hero-map'), () => true);
  else paintMap($('#hero-map'), () => true);
  countUp();
  const cta = $('#hero-apply');
  if (cta) cta.href = C.me?.role === 'student' ? '#/apply' : '#/signin?next=apply';
}

/* Hero cards show the visitor's own result, and only after they confirmed their marks. */
function bestMatch(a) {
  const hits = PROGRAMMES.filter((p) => p.qual === 'degree' && (isOpen(byId[p.institution_id]) || cycleOver()) && eligibility(p, null, a).key === 'yes')
    .sort((x, y) => y.aps - x.aps);
  return hits.length ? { course: hits[0], inst: byId[hits[0].institution_id] } : null;
}
function renderHeroCards() {
  const apsCard = $('.fc-aps'), offer = $('.fc-offer');
  const { marks, confirmed } = currentMarks();
  const a = analyse(marks);
  if (!confirmed || a.count < 4) {
    apsCard.innerHTML = '<span class="fc-label">Your APS</span><strong>?<small>/42</small></strong><a class="fc-link" href="#/aps">Enter your marks <span class="i i-arrow" aria-hidden="true"></span></a>';
    offer.hidden = true;
    return;
  }
  apsCard.innerHTML = `<span class="fc-label">Your APS</span><strong>${a.aps}<small>/42</small></strong><span class="fc-bar"><i style="width:${Math.round((a.aps / 42) * 100)}%"></i></span>`;
  const m = bestMatch(a);
  offer.hidden = !m;
  if (m) offer.innerHTML = `<span class="fc-tick"><span class="i i-check" aria-hidden="true"></span></span><div><strong>Likely eligible</strong><span class="fc-sub">${esc(m.inst.short)} · ${esc(m.course.name)}</span></div>`;
}

// ─────────────────────────── map
function mountMap(el, match) {
  el.innerHTML = ART.map(INSTITUTIONS);
  el.addEventListener('pointerover', (e) => { const g = e.target.closest('.map-pin'); if (g) showTip(g); });
  el.addEventListener('pointerout', (e) => { const g = e.target.closest('.map-pin'); if (g && !g.contains(e.relatedTarget)) hideTip(); });
  el.addEventListener('focusin', (e) => { const g = e.target.closest('.map-pin'); if (g) showTip(g); });
  el.addEventListener('focusout', hideTip);
  el.addEventListener('keydown', (e) => { const g = e.target.closest('.map-pin'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDrawer(g.dataset.pin); } });
  el.addEventListener('click', (e) => { const g = e.target.closest('.map-pin'); if (g) { hideTip(); openDrawer(g.dataset.pin); } });
  paintMap(el, match);
}
function paintMap(el, match) {
  $$('.map-pin', el).forEach((g) => {
    const i = byId[g.dataset.pin]; const st = closingStatus(i);
    g.classList.remove('open', 'soon', 'closed');
    g.classList.add(st.key);
    g.classList.toggle('dim', !match(i));
    g.classList.toggle('hot', C.shortlist.has(i.id) || appliedTo(i.id));
  });
}
function showTip(g) {
  const i = byId[g.dataset.pin]; const st = closingStatus(i); const tip = $('#map-tip');
  const mark = appliedTo(i.id) ? '<b><span class="i i-check" aria-hidden="true"></span> Applied</b>' : C.shortlist.has(i.id) ? '<b><span class="i i-check" aria-hidden="true"></span> Shortlisted</b>' : '';
  tip.innerHTML = `<strong>${esc(i.name)}</strong><div class="row"><span>${esc(i.city)}</span><b>${i.cao ? 'R' + CAO.fee + ' CAO' : rand(i.fee)}</b></div><div class="row"><span class="badge ${st.key}">${esc(st.label)}</span>${mark}</div>`;
  const r = g.getBoundingClientRect();
  tip.style.left = Math.min(innerWidth - 140, Math.max(140, r.left + r.width / 2)) + 'px';
  tip.style.top = r.top + 'px';
  tip.hidden = false;
}
function hideTip() { $('#map-tip').hidden = true; }

function countUp() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('.stat strong').forEach((el) => {
    const target = el.textContent;
    if (!/\d/.test(target) || el.dataset.done === target) return;
    el.dataset.done = target;
    const t0 = performance.now(), dur = 900;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = target.replace(/\d+/g, (n) => Math.round(+n * e));
      if (k < 1) requestAnimationFrame(tick); else el.textContent = target;
    };
    requestAnimationFrame(tick);
  });
}

// ─────────────────────────── universities
const uniFilter = { pill: 'all', q: '', province: '', field: '', sort: 'name' };

export function universities(ctx, q) {
  query = q;
  const sort = q.get('sort');
  if (sort) { uniFilter.sort = sort; $('#uni-sort').value = sort; }
  renderUniversities();
  const openId = q.get('open');
  if (openId && byId[openId]) openDrawer(openId);
}

function filteredUnis() {
  const q = uniFilter.q.trim().toLowerCase();
  const list = INSTITUTIONS.filter((i) => {
    if (q && !`${i.name} ${i.short} ${i.city} ${i.province}`.toLowerCase().includes(q) && !programmesOf(i.id).some((p) => p.name.toLowerCase().includes(q))) return false;
    if (uniFilter.province && i.province !== uniFilter.province) return false;
    if (uniFilter.field && !i.fields.includes(uniFilter.field)) return false;
    switch (uniFilter.pill) {
      case 'open': return isOpen(i);
      case 'free': return i.fee === 0;
      case 'cao': return !!i.cao;
      case 'shortlist': return C.shortlist.has(i.id);
      case 'all': return true;
      default: return i.type === uniFilter.pill;
    }
  });
  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    fee: (a, b) => a.fee - b.fee || a.name.localeCompare(b.name),
    closing: (a, b) => {
      const da = daysUntil(a.closes), db = daysUntil(b.closes);
      if ((da < 0) !== (db < 0)) return da < 0 ? 1 : -1;
      return a.closes.localeCompare(b.closes);
    },
  };
  return list.sort(sorters[uniFilter.sort] || sorters.name);
}

function feeHTML(i) {
  if (i.cao) return `R${CAO.fee}<small class="fee-note"> CAO</small>`;
  return i.fee === 0 ? '<span class="free">Free</span>' : rand(i.fee);
}

function prospectusButton(i, cls = 'btn btn-outline btn-sm') {
  const p = prospectus(i);
  if (p.kind === 'local') return `<a class="${cls}" href="${esc(p.href)}" download>⬇ Prospectus</a>`;
  if (p.kind === 'pdf') return `<a class="${cls}" href="${esc(p.href)}" target="_blank" rel="noopener">⬇ Prospectus</a>`;
  if (p.kind === 'page') return `<a class="${cls}" href="${esc(p.href)}" target="_blank" rel="noopener">Prospectus <span class="i i-ext" aria-hidden="true"></span></a>`;
  return `<a class="${cls}" href="${esc(i.web)}" target="_blank" rel="noopener">Prospectus <span class="i i-ext" aria-hidden="true"></span></a>`;
}
const websiteButton = (i) => `<a class="btn btn-outline btn-sm btn-icon" href="${esc(i.web)}" target="_blank" rel="noopener" title="${esc(i.name)} website" aria-label="${esc(i.name)} website">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg></a>`;

function shortlistButton(i, size = 'btn-sm') {
  if (appliedTo(i.id)) return `<a class="btn ${size} btn-added" href="#/applications"><span class="i i-check" aria-hidden="true"></span> Applied</a>`;
  const on = C.shortlist.has(i.id);
  const closed = !canShortlist(i);
  return `<button class="btn ${size} ${on ? 'btn-added' : 'btn-primary'}" data-cart="${i.id}" ${closed && !on ? 'disabled title="Applications have closed"' : ''}>${on ? '<span class="i i-check" aria-hidden="true"></span> Shortlisted' : closed ? 'Closed' : '+ Shortlist'}</button>`;
}

/** When searching for a programme, show which of this institution's programmes matched. */
function progHit(i) {
  const q = uniFilter.q.trim().toLowerCase();
  if (!q || `${i.name} ${i.short} ${i.city} ${i.province}`.toLowerCase().includes(q)) {
    return `<button class="prog-count" data-open="${i.id}" data-tab="programmes">${programmesOf(i.id).length} programmes <span class="i i-arrow" aria-hidden="true"></span></button>`;
  }
  const hits = programmesOf(i.id).filter((p) => p.name.toLowerCase().includes(q));
  return `<button class="prog-count hit" data-open="${i.id}" data-tab="programmes">${esc(hits[0].name)}${hits.length > 1 ? ` +${hits.length - 1} more` : ''} <span class="i i-arrow" aria-hidden="true"></span></button>`;
}

function renderUniversities() {
  const list = filteredUnis();
  $('#uni-meta').textContent = `${list.length} of ${INSTITUTIONS.length} universities` + (C.shortlist.size ? ` · ${C.shortlist.size} on your shortlist` : '');
  $('#uni-grid').innerHTML = list.length ? list.map((i) => {
    const st = closingStatus(i);
    return `<article class="uni-card spot ${C.shortlist.has(i.id) || appliedTo(i.id) ? 'in-cart' : ''}" style="${brandVars(i)}">
      <div class="uni-cover"><span class="sun"></span>${ART.skyline(i.id, i.type)}</div>
      <div class="uni-inner">
      <div class="uni-top">
        ${monogram(i)}
        <div class="uni-title">
          <h3><button data-open="${i.id}">${esc(i.name)}</button></h3>
          <span>${esc(i.city)} · ${esc(TYPES[i.type])}</span>
        </div>
      </div>
      <div class="badges">
        <span class="badge ${st.key}">${esc(st.label)}</span>
        ${i.cao ? '<span class="badge cao">Apply via CAO</span>' : ''}
        ${i.verify ? '<span class="badge verify" title="Sources disagree. Confirm with the university.">Confirm fee</span>' : ''}
      </div>
      <div class="uni-facts">
        <div class="fact"><small>Application fee</small><strong>${feeHTML(i)}</strong></div>
        <div class="fact"><small>Closes</small><strong>${fmtDate(i.closes)}</strong></div>
      </div>
      ${progHit(i)}
      ${isOpen(i) ? '' : `<div class="closed-row"><span>${ART.ui('lock', 14)} Applications closed</span>${alertButton(i, 'btn-ghost btn-sm')}</div>`}
      <div class="uni-actions">
        ${prospectusButton(i)}
        ${websiteButton(i)}
        ${shortlistButton(i)}
      </div>
      </div>
    </article>`;
  }).join('') : '<div class="card">No universities match those filters.</div>';

  const ids = new Set(list.map((i) => i.id));
  if (!$('#list-map').children.length) mountMap($('#list-map'), (i) => ids.has(i.id));
  else paintMap($('#list-map'), (i) => ids.has(i.id));

  $('#fee-table tbody').innerHTML = [...INSTITUTIONS].sort((a, b) => a.name.localeCompare(b.name)).map((i) => {
    const st = closingStatus(i); const p = prospectus(i);
    return `<tr>
      <td><strong>${esc(i.short)}</strong> <span class="muted">${esc(i.name)}</span></td>
      <td>${esc(i.province)}</td>
      <td class="num">${i.cao ? `R${CAO.fee} (CAO)` : rand(i.fee)}${i.verify ? ' <span class="badge verify">confirm</span>' : ''}</td>
      <td>${fmtDate(i.closes)}</td>
      <td><span class="badge ${st.key}">${esc(st.label)}</span></td>
      <td><a href="${esc(p.href)}" ${p.kind === 'local' ? 'download' : 'target="_blank" rel="noopener"'}>${['local', 'pdf'].includes(p.kind) ? 'PDF ' + (p.year || '') : 'Page <span class="i i-ext" aria-hidden="true"></span>'}</a></td>
      <td><a href="${esc(i.web)}" target="_blank" rel="noopener">${esc(new URL(i.web).hostname.replace(/^www\./, ''))} <span class="i i-ext" aria-hidden="true"></span></a></td>
    </tr>`;
  }).join('');
}

export function openDrawer(id, tab = '') {
  const i = byId[id]; if (!i) return;
  const st = closingStatus(i); const p = prospectus(i);
  const { marks, confirmed } = currentMarks();
  const a = analyse(marks);
  const planned = programmesOf(i.id).find((p) => p.kind === store.get('planned', ''));
  const elig = confirmed && a.count >= 4 && planned ? eligibility(planned, i, a) : null;

  const attach = ['local', 'pdf'].includes(p.kind)
    ? `<div class="doc-attach"><div class="pdf">PDF</div><div class="meta"><strong>${esc(i.short)} ${p.year || INTAKE_YEAR} undergraduate prospectus</strong><span>${p.kind === 'local' ? `Attached · ${fmtSize(p.size)}` : 'Official PDF from ' + esc(new URL(p.href).hostname)}</span></div><a class="btn btn-primary btn-sm" href="${esc(p.href)}" ${p.kind === 'local' ? 'download' : 'target="_blank" rel="noopener"'}>Download</a></div>`
    : `<div class="doc-attach"><div class="pdf web">WEB</div><div class="meta"><strong>${esc(i.short)} ${p.year || INTAKE_YEAR} prospectus</strong><span>Published on ${esc(new URL(p.href).hostname)}</span></div><a class="btn btn-outline btn-sm" href="${esc(p.href)}" target="_blank" rel="noopener">Open <span class="i i-ext" aria-hidden="true"></span></a></div>`;

  $('#drawer-content').innerHTML = `
    <div class="drawer-hero" style="${brandVars(i)}">${ART.skyline(i.id, i.type)}
      <div class="uni-top">
        ${monogram(i, 'on-dark')}
        <div><h2 id="drawer-title">${esc(i.name)}</h2><p>${esc(i.city)}, ${esc(i.province)} · ${esc(TYPES[i.type])}</p></div>
      </div>
    </div>
    <div class="drawer-body">
      <div class="badges"><span class="badge ${st.key}">${esc(st.label)}</span>${i.cao ? '<span class="badge cao">Apply via CAO</span>' : ''}${i.verify ? '<span class="badge verify">Confirm fee with the university</span>' : ''}</div>
      ${isOpen(i) ? '' : `<div class="closed-panel"><div>${ART.ui('lock', 20)}</div><div><strong>Applications for ${INTAKE_YEAR} are closed</strong><p>${esc(i.short)} closed on ${fmtDate(i.closes)}. Get one email or WhatsApp message when applications open for the next intake.</p></div>${alertButton(i, 'btn-primary btn-sm')}</div>`}
      <div class="kv">
        <div class="fact"><small>Fee · SA applicants</small><strong>${feeHTML(i)}</strong></div>
        <div class="fact"><small>Fee · international</small><strong>${i.cao ? 'R' + CAO.feeIntl : i.feeIntl ? rand(i.feeIntl) : 'See website'}</strong></div>
        <div class="fact"><small>Closing date</small><strong>${fmtDate(i.closes)}</strong></div>
        <div class="fact"><small>Admission score</small><strong class="small">${/standard 7-point/.test(i.apsNote) ? 'Standard APS' : 'Own method'}</strong></div>
      </div>
      ${i.cao ? `<div class="callout info">${esc(CAO.note)}</div>` : ''}
      ${i.feeNote ? `<div class="callout ${i.verify ? 'warn' : 'info'}">${esc(i.feeNote)}</div>` : ''}
      ${i.earlyNote ? `<div class="callout warn">${esc(i.earlyNote)}</div>` : ''}
      <div class="callout info">${esc(i.apsNote)}</div>
      ${elig ? `<div class="callout ${elig.key === 'yes' ? 'good' : elig.key === 'maybe' ? 'warn' : 'bad'}"><strong>${esc(planned.name)}:</strong> ${esc(elig.label)}${elig.cutoff ? ` (your APS ${a.aps}, estimated cut-off ${elig.cutoff}${elig.diploma ? ', diploma route' : ''})` : ''}</div>` : ''}
      <h3>Prospectus</h3>
      ${attach}
      <h3 id="drawer-programmes">Programmes <span class="count-pill">${programmesOf(i.id).length}</span></h3>
      ${programmeList(i, confirmed && a.count >= 4 ? a : null)}
      <h3>Links</h3>
      <ul class="link-list">
        <li><a href="${esc(i.web)}" target="_blank" rel="noopener"><span>Official website</span><b>${esc(new URL(i.web).hostname)} <span class="i i-ext" aria-hidden="true"></span></b></a></li>
        ${i.cao ? `<li><a href="${esc(CAO.url)}" target="_blank" rel="noopener"><span>Central Applications Office</span><b>cao.ac.za <span class="i i-ext" aria-hidden="true"></span></b></a></li>` : i.apply !== i.web ? `<li><a href="${esc(i.apply)}" target="_blank" rel="noopener"><span>How to apply</span><b>${esc(new URL(i.apply).hostname)} <span class="i i-ext" aria-hidden="true"></span></b></a></li>` : ''}
      </ul>
      <div class="btn-row">${shortlistButton(i, '')}${C.me?.role === 'student' && C.shortlist.has(i.id) ? '<a class="btn btn-gold" href="#/apply">Apply now <span class="i i-arrow" aria-hidden="true"></span></a>' : ''}</div>
    </div>`;
  const drawer = $('#drawer');
  drawer.dataset.id = id;
  if (drawer.hidden) { drawer.hidden = false; document.body.style.overflow = 'hidden'; $('.drawer-close').focus(); }
  $('#prog-q').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$('.prog-list li', drawer).forEach((li) => { li.hidden = q && !li.dataset.name.includes(q); });
    $$('.prog-group', drawer).forEach((g) => { g.hidden = !$$('li', g).some((li) => !li.hidden); });
  });
  if (tab === 'programmes') $('#drawer-programmes').scrollIntoView({ block: 'start' });
}
/** Every programme the institution offers, grouped by faculty, searchable. */
function programmeList(i, a) {
  const progs = programmesOf(i.id);
  const QUAL = { degree: 'Degree', diploma: 'Diploma', hc: 'Higher Certificate' };
  const LBL = { eng: 'English', math: 'Maths', mathOrLit: 'Maths/Maths Lit', sci: 'Physical Sci', life: 'Life Sci', acc: 'Accounting' };
  const groups = facultiesOf(i.id);
  return `<label class="search small"><input type="search" id="prog-q" placeholder="Search ${progs.length} programmes" aria-label="Search programmes"></label>
    <div class="prog-groups">${groups.map((f) => `<details class="prog-group" open><summary>${ART.icon(f.programmes[0].field, 16)} ${esc(f.title)} <span class="muted">${f.programmes.length}</span></summary>
      <ul class="prog-list">${f.programmes.map((p) => {
        const e = a ? eligibility(p, i, a) : null;
        return `<li data-name="${esc(p.name.toLowerCase())}"><div><strong>${esc(p.name)}</strong>
          <small>${QUAL[p.qual]} · ${p.years} yr${p.years === 1 ? '' : 's'} · ${Object.entries(p.req).map(([r, v]) => `${LBL[r]} ${v}%`).join(' · ')}${p.note ? ` · ${esc(p.note)}` : ''}</small></div>
          <span class="prog-min">${esc(minLabel(p))}${e ? `<span class="badge ${{ yes: 'open', maybe: 'soon', no: 'closed' }[e.key]}">${esc(e.label)}</span>` : ''}</span></li>`;
      }).join('')}</ul></details>`).join('')}</div>
    <p class="hint">${sourceOf(i.id) === 'prospectus' ? `From the ${esc(i.short)} 2027 prospectus.` : `Compiled from ${esc(i.short)}'s website and published 2027 guides. Check the prospectus for exact requirements.`}${a ? ' Eligibility uses your confirmed marks.' : ''}</p>`;
}

export function closeDrawer(silent = false) {
  const drawer = $('#drawer'); if (drawer.hidden) return;
  drawer.hidden = true; drawer.dataset.id = ''; document.body.style.overflow = '';
  if (!silent && query.get('open')) history.replaceState(null, '', '#/universities');
}

// ─────────────────────────── APS page
function renderSubjects() {
  const opts = SUBJECTS.map((s) => `<option>${esc(s)}</option>`).join('');
  $('#subjects').innerHTML = Array.from({ length: 7 }, (_, n) => `
    <div class="subject-row">
      <span class="n">${n + 1}</span>
      <select id="aps-subj-${n}" data-subj="${n}" aria-label="Subject ${n + 1}"><option value="">Select subject…</option>${opts}</select>
      <input id="aps-mark-${n}" type="number" data-mark="${n}" min="0" max="100" inputmode="numeric" placeholder="%" aria-label="Mark for subject ${n + 1}">
      <span class="pts" data-pts="${n}">–</span>
    </div>`).join('');
}
export function fillSubjects(root, marks) {
  for (let n = 0; n < 7; n++) {
    const e = marks[n] || {};
    $(`[data-subj="${n}"]`, root).value = e.s || '';
    $(`[data-mark="${n}"]`, root).value = Number.isFinite(e.m) ? e.m : '';
  }
  livePoints(root);
}
export function readSubjects(root) {
  return Array.from({ length: 7 }, (_, n) => {
    const s = $(`[data-subj="${n}"]`, root).value;
    const raw = $(`[data-mark="${n}"]`, root).value;
    const m = raw === '' ? NaN : Math.min(100, Math.max(0, Math.round(Number(raw))));
    return { s, m };
  });
}
export function livePoints(root) {
  readSubjects(root).forEach((e, n) => {
    const el = $(`[data-pts="${n}"]`, root);
    if (!e.s || !Number.isFinite(e.m)) { el.textContent = '–'; el.classList.remove('on'); return; }
    el.textContent = isLO(e.s) ? '—' : points(e.m);
    el.classList.toggle('on', !isLO(e.s));
  });
}

export function aps() {
  const form = $('#subjects-form');
  if (!$('#subjects').children.length) renderSubjects();
  const { marks, confirmed } = currentMarks();
  fillSubjects(form, marks);
  const student = C.me?.role === 'student';
  $('#aps-save-note').innerHTML = student
    ? `Calculating saves these marks to <a href="#/profile?tab=marks">your profile</a> and uses them for your applications.`
    : C.me ? '' : 'Marks stay in this browser. <a href="#/signin?next=aps">Create an account</a> to save them and apply.';
  if (marks.some((e) => e.s)) showAPS(marks, confirmed); else resetAPSCard();
}
function resetAPSCard() {
  $('#aps-value').textContent = '–'; $('#aps-meter').style.width = '0';
  $('#pass-type').textContent = ''; $('#career-results').innerHTML = '';
  $('#aps-sub').textContent = 'out of 42 (six subjects × 7)';
  $('#aps-card').classList.remove('is-sample');
}
function showAPS(marks, confirmed) {
  const a = analyse(marks);
  $('#aps-value').textContent = a.aps;
  $('#aps-meter').style.width = Math.min(100, (a.aps / 42) * 100) + '%';
  $('#pass-type').textContent = a.pass ? a.pass.label : 'Add all seven subjects to see your NSC pass type.';
  $('#aps-card').classList.toggle('is-sample', !confirmed);
  $('#aps-sub').textContent = confirmed ? `from ${a.count} subject${a.count === 1 ? '' : 's'} · max 42` : 'Sample marks. Enter yours and press Calculate APS.';
  renderCareers(a);
}

function renderCareers(a) {
  const rows = CAREERS.map((c) => {
    const course = kindById[c.course];
    const reqs = checkReqs(course, a.subj);
    const progs = PROGRAMMES.filter((p) => p.kind === c.course);
    const offering = [...new Set(progs.map((p) => p.institution_id))];
    const within = [...new Set(progs.filter((p) => eligibility(p, null, a).key === 'yes').map((p) => p.institution_id))];
    const subjectsOk = reqs.every((r) => r.ok);
    const tier = a.aps >= course.aps && subjectsOk ? 'yes' : (a.aps >= course.aps - 5 && reqs.every((r) => r.have >= r.min - 10)) ? 'close' : 'no';
    return { c, course, reqs, offering, within, tier };
  });
  const yes = rows.filter((r) => r.tier === 'yes');
  const close = rows.filter((r) => r.tier === 'close');
  const card = (r) => `
    <article class="career spot" style="--c:${FIELD_COLOURS[r.course.field]}">
      <div class="career-top">
        <div class="career-icon">${ART.icon(r.course.field, 24)}</div>
        <div><h3>${esc(r.c.title)}</h3><div class="sub">${esc(r.course.name)} · ${r.course.years} years · typical APS ${r.course.aps}+</div></div>
      </div>
      <p>${esc(r.c.description)}</p>
      <div class="req-list">
        <span class="req ${a.aps >= r.course.aps ? 'ok' : 'no'}">APS ${a.aps}/${r.course.aps}</span>
        ${r.reqs.map((q) => `<span class="req ${q.ok ? 'ok' : 'no'}">${esc(q.label)} ${q.have}%/${q.min}%</span>`).join('')}
      </div>
      <p class="small">${esc(r.c.note)}</p>
      <div class="career-foot">
        <div><span class="uni-count">Earning</span><br><strong>${esc(r.c.salary)}</strong> <span class="uni-count">/yr</span></div>
        <div class="right"><span class="uni-count">${r.within.length} of ${r.offering.length} institutions in reach</span><br>
        <button class="btn btn-text" data-plan="${r.course.id}">Apply for this <span class="i i-arrow" aria-hidden="true"></span></button></div>
      </div>
    </article>`;
  let html = '';
  if (yes.length) html += `<div class="results-head"><div><h2>You meet the typical requirements for ${yes.length} career${yes.length === 1 ? '' : 's'}</h2><p>Based on a mid-tier university's cut-off. More selective universities ask for more.</p></div></div><div class="career-grid">${yes.map(card).join('')}</div>`;
  if (close.length) html += `<div class="results-head"><div><h2>Within reach: ${close.length} more</h2><p>A few more marks in the red subjects would open these up.</p></div></div><div class="career-grid">${close.map(card).join('')}</div>`;
  if (!html) html = '<div class="card mt"><h3>No strong matches yet</h3><p class="muted">Check that every subject has a mark. Higher Certificate and Diploma routes at TVET colleges and universities of technology can lead to a degree later.</p></div>';
  $('#career-results').innerHTML = html + '<p class="hint mt">Salaries are indicative South African ranges for early-to-mid career and vary by employer. Always check the prospectus for exact entry requirements.</p>';
}

async function confirmMarks(marks) {
  const problems = marksProblems(marks);
  if (problems.length) { toast(problems[0], 'bad'); return; }
  if (C.me?.role === 'student') {
    C.me = await C.api.saveProfile({ marks: marks.filter((e) => e.s), marks_confirmed_at: new Date().toISOString() });
    toast('Marks confirmed and saved to your profile.');
  } else {
    C.local = { marks, confirmed: true }; C.saveLocal();
    toast('Marks confirmed. Eligibility checks now use your APS.');
  }
  showAPS(marks, true);
  $('#career-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─────────────────────────── wiring (once)
export function init(ctx, shellFns) {
  C = ctx; shell = shellFns;
  $$('.fund').forEach((el) => el.classList.add('spot'));

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-cart],[data-open],[data-close],[data-plan]');
    if (!t) return;
    if (t.dataset.cart) toggleShortlist(t.dataset.cart);
    else if (t.dataset.open) openDrawer(t.dataset.open, t.dataset.tab || (uniFilter.q ? 'programmes' : ''));
    else if ('close' in t.dataset) closeDrawer();
    else if (t.dataset.plan) {
      store.set('planned', t.dataset.plan);
      location.hash = C.me?.role === 'student' ? `#/apply?course=${t.dataset.plan}` : `#/signin?next=${encodeURIComponent('apply?course=' + t.dataset.plan)}`;
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches?.('li[data-open]')) openDrawer(e.target.dataset.open); });
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.spot'); if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
  window.addEventListener('scroll', hideTip, { passive: true });

  // Hero parallax
  const hero = $('#hero-visual');
  if (hero && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      $$('.float-card', hero).forEach((c) => { const d = +c.dataset.depth; c.style.transform = `translate(${-dx * d}px, ${-dy * d}px)`; });
    });
    hero.addEventListener('pointerleave', () => $$('.float-card', hero).forEach((c) => { c.style.transform = ''; }));
  }

  // Universities filters and view
  $('#uni-province').innerHTML += [...new Set(INSTITUTIONS.map((i) => i.province))].sort().map((p) => `<option>${esc(p)}</option>`).join('');
  $('#uni-field').innerHTML += Object.entries(FIELDS).map(([k, f]) => `<option value="${k}">${esc(f.label)}</option>`).join('');
  $('#uni-search').addEventListener('input', (e) => { uniFilter.q = e.target.value; renderUniversities(); });
  $('#uni-province').addEventListener('change', (e) => { uniFilter.province = e.target.value; renderUniversities(); });
  $('#uni-field').addEventListener('change', (e) => { uniFilter.field = e.target.value; renderUniversities(); });
  $('#uni-sort').addEventListener('change', (e) => { uniFilter.sort = e.target.value; renderUniversities(); });
  $$('.pill').forEach((p) => p.addEventListener('click', () => {
    $$('.pill').forEach((x) => x.classList.remove('active')); p.classList.add('active');
    uniFilter.pill = p.dataset.filter; renderUniversities();
  }));
  $$('.seg-btn').forEach((b) => b.addEventListener('click', () => {
    const map = b.dataset.view === 'map';
    $$('.seg-btn').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    $('#uni-grid').hidden = map; $('#uni-map').hidden = !map;
    store.set('view', b.dataset.view);
  }));
  if (store.get('view', 'grid') === 'map') $('.seg-btn[data-view="map"]').click();

  // APS calculator
  const form = $('#subjects-form');
  renderSubjects();
  form.addEventListener('input', () => livePoints(form));
  form.addEventListener('change', () => livePoints(form));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true;
    try { await confirmMarks(readSubjects(form)); } catch (err) { toast(err.message, 'bad'); } finally { btn.disabled = false; }
  });
  $('#load-sample').addEventListener('click', () => {
    fillSubjects(form, SAMPLE_RESULTS);
    if (C.me?.role !== 'student') { C.local = { marks: readSubjects(form), confirmed: false }; C.saveLocal(); }
    showAPS(readSubjects(form), false);
  });
  $('#clear-subjects').addEventListener('click', () => {
    fillSubjects(form, []);
    if (C.me?.role !== 'student') { C.local = { marks: [], confirmed: false }; C.saveLocal(); }
    resetAPSCard();
  });

  $('#copy-email').addEventListener('click', (e) => copyText(e.currentTarget.dataset.email, 'Email address copied'));
}

