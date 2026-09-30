/* ImbizoConnect — application logic. Plain JS, no build step. */
(() => {
'use strict';

// ─────────────────────────── helpers
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const rand = n => n === 0 ? 'Free' : 'R' + n.toLocaleString('en-ZA');
const byId = Object.fromEntries(INSTITUTIONS.map(i => [i.id, i]));
const courseById = Object.fromEntries(COURSES.map(c => [c.id, c]));
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FIELD_COLOURS = { health:'#1d9e75', engineering:'#c07e10', science:'#0d7490', commerce:'#0c3864', law:'#7c3aed', humanities:'#be4a6a', education:'#4d7c0f', ict:'#1a4f86' };
const MONO_COLOURS = ['#0c3864','#1a4f86','#0f766e','#7c3aed','#b45309','#be123c','#0369a1','#4d7c0f','#9d174d','#334155'];

const store = {
  get(key, fallback) { try { const v = localStorage.getItem('ic:' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem('ic:' + key, JSON.stringify(val)); } catch { /* storage unavailable */ } },
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysUntil(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const [ty, tm, td] = todayISO().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}
function fmtDate(iso, withYear = true) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ' ' + y : ''}`;
}
function status(inst) {
  const days = daysUntil(inst.closes);
  if (days < 0)   return { key:'closed', days, label:`Closed ${fmtDate(inst.closes, false)}` };
  if (days === 0) return { key:'soon', days, label:'Closes today' };
  if (days <= 14) return { key:'soon', days, label:`${days} day${days === 1 ? '' : 's'} left` };
  return { key:'open', days, label:`Open · ${days} days left` };
}
const cycleOver = () => INSTITUTIONS.every(i => daysUntil(i.closes) < 0);

const brandOf = i => BRAND[i.id] || { c: monoColour(i.id), w: '#f4a535', s: '#f4a535' };
function brandVars(i) { const b = brandOf(i); return `--c:${b.c};--w:${b.w};--s:${b.s}`; }
function monoColour(id) {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MONO_COLOURS[h % MONO_COLOURS.length];
}

function prospectus(inst) {
  const local = (window.PROSPECTUS_LOCAL || {})[inst.id];
  const p = inst.prospectus || {};
  if (local) return { kind:'local', href: local.file, size: local.size, year: p.year, source: p.pdf };
  if (p.pdf) return { kind:'pdf', href: p.pdf, year: p.year };
  return { kind:'page', href: p.page || inst.web, year: p.year };
}
function fmtSize(bytes) { return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB'; }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ─────────────────────────── state
const state = {
  cart: new Set(store.get('cart', [])),
  details: store.get('details', {}),
  c1: store.get('c1', ''),
  c2: store.get('c2', ''),
  docs: store.get('docs', {}),
  marks: store.get('marks', []),
  confirmed: store.get('confirmed', false),  // true once the student presses "Calculate APS" on their own marks
  step: 1,
  ref: store.get('ref', null),
};
function save() {
  store.set('cart', [...state.cart]);
  store.set('details', state.details);
  store.set('c1', state.c1); store.set('c2', state.c2);
  store.set('docs', state.docs); store.set('marks', state.marks);
  store.set('ref', state.ref);
  store.set('confirmed', state.confirmed);
}

// ─────────────────────────── fees (CAO charged once)
function feeBreakdown(ids = [...state.cart]) {
  const lines = []; let total = 0; let caoCharged = false;
  const sorted = ids.map(id => byId[id]).filter(Boolean).sort((a, b) => (b.cao ? 1 : 0) - (a.cao ? 1 : 0) || a.short.localeCompare(b.short));
  for (const inst of sorted) {
    if (inst.cao) {
      if (!caoCharged) { lines.push({ inst, amount: CAO.fee, label:'CAO fee (covers all KZN choices)' }); total += CAO.fee; caoCharged = true; }
      else lines.push({ inst, amount: 0, included: true, label:'Included in CAO fee' });
    } else {
      lines.push({ inst, amount: inst.fee, label: inst.fee === 0 ? 'No application fee' : 'Application fee' });
      total += inst.fee;
    }
  }
  const caoCount = sorted.filter(i => i.cao).length;
  return { lines, total, caoCount, naive: sorted.reduce((s, i) => s + i.fee, 0) };
}

function toggleCart(id, force) {
  const inst = byId[id];
  const add = force ?? !state.cart.has(id);
  if (add) {
    if (daysUntil(inst.closes) < 0 && !cycleOver()) { toast(`${inst.short} closed on ${fmtDate(inst.closes)}. Try another university.`); return false; }
    state.cart.add(id); toast(`${inst.short} added to your application`);
  } else {
    state.cart.delete(id); toast(`${inst.short} removed`);
  }
  state.ref = null;
  save(); refreshCartViews();
  return true;
}

function refreshCartViews() {
  const n = state.cart.size;
  const badge = $('#cart-count'); badge.textContent = n; badge.hidden = n === 0;
  if (current.route === 'universities') renderUniversities();
  if ($('#hero-map')?.children.length) paintMap($('#hero-map'), () => true);
  if (current.route === 'apply') { renderSummary(); if (state.step === 2) renderPickList(); }
  const drawerId = $('#drawer').dataset.id;
  if (!$('#drawer').hidden && drawerId) openDrawer(drawerId);
}

// ─────────────────────────── APS
const points = pct => pct >= 80 ? 7 : pct >= 70 ? 6 : pct >= 60 ? 5 : pct >= 50 ? 4 : pct >= 40 ? 3 : pct >= 30 ? 2 : 1;
const isLO = s => /life orientation/i.test(s);

function analyse(marks = state.marks) {
  const valid = marks.filter(e => e.s && Number.isFinite(e.m) && e.m >= 0);
  const scored = valid.filter(e => !isLO(e.s));
  const aps = scored.reduce((sum, e) => sum + points(e.m), 0);
  const find = re => Math.max(0, ...scored.filter(e => re.test(e.s)).map(e => e.m));
  const subj = {
    math: find(/^(Mathematics|Technical Mathematics)$/),
    lit:  find(/^Mathematical Literacy$/),
    sci:  find(/^(Physical Sciences|Technical Sciences)$/),
    life: find(/^Life Sciences$/),
    eng:  find(/^English/),
    hl:   find(/Home Language/),
  };
  subj.mathOrLit = Math.max(subj.math, subj.lit);
  return { aps, subj, count: scored.length, pass: passType(valid) };
}

/* NSC pass levels (simplified: HL ≥ 40 plus counts of other subjects, LO excluded). */
function passType(entries) {
  const scored = entries.filter(e => !isLO(e.s));
  if (scored.length < 6) return null;
  const hl = scored.find(e => /Home Language/.test(e.s));
  if (!hl || hl.m < 40) return { key:'none', label:'Home Language below 40%, so no NSC pass yet' };
  const others = scored.filter(e => e !== hl);
  const n50 = others.filter(e => e.m >= 50).length;
  const n40 = others.filter(e => e.m >= 40).length;
  const n30 = others.filter(e => e.m >= 30).length;
  if (n50 >= 4 && n30 >= others.length) return { key:'bachelor', label:"Bachelor's pass: you can apply for degrees" };
  if (n40 >= 4 && n30 >= others.length) return { key:'diploma', label:'Diploma pass: diplomas and higher certificates' };
  if (n40 >= 2 && n30 >= 5) return { key:'hc', label:'Higher Certificate pass' };
  return { key:'none', label:'Below NSC pass requirements' };
}

const REQ_LABEL = { math:'Maths', mathOrLit:'Maths / Maths Lit', sci:'Physical Sci', life:'Life Sci', eng:'English' };
function checkReqs(course, subj) {
  return Object.entries(course.req).map(([k, min]) => ({ key:k, label: REQ_LABEL[k], min, have: subj[k] || 0, ok: (subj[k] || 0) >= min }));
}

/* Estimated eligibility of the student for `course` at `inst`. */
function eligibility(course, inst, a) {
  if (!course) return null;
  if (!inst.fields.includes(course.field)) return { key:'na', label:'Not offered', cutoff:null, reqs:[] };
  const cutoff = Math.max(18, course.aps + inst.selectivity);
  const reqs = checkReqs(course, a.subj);
  const subjectsOk = reqs.every(r => r.ok);
  const nearSubjects = reqs.every(r => r.have >= r.min - 5);
  let key;
  if (a.aps >= cutoff && subjectsOk) key = 'yes';
  else if (a.aps >= cutoff - 2 && nearSubjects) key = 'maybe';
  else key = 'no';
  const label = { yes:'Likely eligible', maybe:'Borderline', no:'Unlikely' }[key];
  return { key, label, cutoff, reqs, diploma: inst.type === 'technology' };
}

// ─────────────────────────── routing
const current = { route: 'home', query: new URLSearchParams() };
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { route: path || 'home', query: new URLSearchParams(qs || '') };
}
function router() {
  const { route, query } = parseHash();
  const valid = ['home', 'universities', 'aps', 'funding', 'apply'];
  current.route = valid.includes(route) ? route : 'home';
  current.query = query;
  $$('.screen').forEach(s => s.hidden = s.dataset.screen !== current.route);
  $$('.primary-nav a').forEach(a => a.classList.toggle('active', a.dataset.route === current.route));
  closeMenu();
  ({ home: renderHome, universities: enterUniversities, aps: renderAPSPage, funding: () => {}, apply: enterApply })[current.route]();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  document.title = { home:'ImbizoConnect · One application, every SA university', universities:'Universities & fees · ImbizoConnect', aps:'APS calculator · ImbizoConnect', funding:'Funding & FAQ · ImbizoConnect', apply:'My application · ImbizoConnect' }[current.route];
}

// ─────────────────────────── home
function renderHome() {
  const open = INSTITUTIONS.filter(i => daysUntil(i.closes) >= 0);
  $('#hero-open-count').textContent = open.length
    ? `${open.length} universities still open for ${INTAKE_YEAR}`
    : `${INTAKE_YEAR} applications have closed`;

  const upcoming = [...open].sort((a, b) => a.closes.localeCompare(b.closes)).slice(0, 6);
  const list = upcoming.length ? upcoming : [...INSTITUTIONS].sort((a, b) => b.closes.localeCompare(a.closes)).slice(0, 6);
  $('#deadline-list').innerHTML = list.map(i => {
    const st = status(i); const [, m, d] = i.closes.split('-').map(Number);
    return `<li data-open="${i.id}" tabindex="0">
      <div class="dl-badge"><span><b>${d}</b>${MONTHS[m - 1]}</span></div>
      <div class="dl-main"><strong>${esc(i.name)}</strong><span>${esc(st.label)}${i.cao ? ' · via CAO' : ''}</span></div>
      <span class="dl-fee">${i.cao ? 'R' + CAO.fee : rand(i.fee)}</span>
    </li>`;
  }).join('');

  const free = INSTITUTIONS.filter(i => i.fee === 0);
  const paid = INSTITUTIONS.filter(i => i.fee > 0).map(i => i.fee);
  $('#stat-unis').textContent = INSTITUTIONS.length;
  $('#stat-free').textContent = free.length;
  $('#stat-range').textContent = `R0 – R${Math.max(...paid)}`;
  $('#stat-pdfs').textContent = INSTITUTIONS.filter(i => prospectus(i).kind !== 'page').length;
  $('#free-list').innerHTML = free.map(i => `<a href="#/universities?open=${i.id}"><b>R0</b> ${esc(i.name)}</a>`).join('');
  renderHeroCards();
  if (!$('#hero-map').children.length) mountMap($('#hero-map'), () => true);
  else paintMap($('#hero-map'), () => true);
  countUp();
}

/* Hero cards show the student's own result, and only after they have
 * confirmed their marks. Until then the APS card invites them to start. */
function bestMatch(a) {
  const c1 = courseById[state.c1];
  const courses = c1 ? [c1, ...COURSES.filter(c => c !== c1)] : [...COURSES].sort((x, y) => y.aps - x.aps);
  for (const course of courses) {
    const hits = INSTITUTIONS.filter(i => daysUntil(i.closes) >= 0 || cycleOver())
      .map(i => ({ i, e: eligibility(course, i, a) })).filter(r => r.e.key === 'yes')
      .sort((x, y) => y.e.cutoff - x.e.cutoff);
    if (hits.length) return { course, inst: hits[0].i };
  }
  return null;
}
function renderHeroCards() {
  const aps = $('.fc-aps'), offer = $('.fc-offer');
  const a = analyse();
  if (!state.confirmed || a.count < 4) {
    aps.innerHTML = `<span class="fc-label">Your APS</span><strong>?<small>/42</small></strong><a class="fc-link" href="#/aps">Enter your marks →</a>`;
    offer.hidden = true;
    return;
  }
  aps.innerHTML = `<span class="fc-label">Your APS</span><strong>${a.aps}<small>/42</small></strong><span class="fc-bar"><i style="width:${Math.round(a.aps / 42 * 100)}%"></i></span>`;
  const m = bestMatch(a);
  offer.hidden = !m;
  if (m) offer.innerHTML = `<span class="fc-tick">✓</span><div><strong>Likely eligible</strong><span class="fc-sub">${esc(m.inst.short)} · ${esc(m.course.name)}</span></div>`;
}

// ─────────────────────────── map
function mountMap(el, match) {
  el.innerHTML = ART.map(INSTITUTIONS);
  el.addEventListener('pointerover', e => { const g = e.target.closest('.map-pin'); if (g) showTip(g); });
  el.addEventListener('pointerout', e => { const g = e.target.closest('.map-pin'); if (g && !g.contains(e.relatedTarget)) hideTip(); });
  el.addEventListener('focusin', e => { const g = e.target.closest('.map-pin'); if (g) showTip(g); });
  el.addEventListener('focusout', hideTip);
  el.addEventListener('keydown', e => { const g = e.target.closest('.map-pin'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDrawer(g.dataset.pin); } });
  el.addEventListener('click', e => { const g = e.target.closest('.map-pin'); if (g) { hideTip(); openDrawer(g.dataset.pin); } });
  paintMap(el, match);
}
function paintMap(el, match) {
  $$('.map-pin', el).forEach(g => {
    const i = byId[g.dataset.pin]; const st = status(i);
    g.classList.remove('open', 'soon', 'closed');
    g.classList.add(st.key);
    g.classList.toggle('dim', !match(i));
    g.classList.toggle('hot', state.cart.has(i.id));
  });
}
function showTip(g) {
  const i = byId[g.dataset.pin]; const st = status(i); const tip = $('#map-tip');
  tip.innerHTML = `<strong>${esc(i.name)}</strong><div class="row"><span>${esc(i.city)}</span><b>${i.cao ? 'R' + CAO.fee + ' CAO' : rand(i.fee)}</b></div><div class="row"><span class="badge ${st.key}">${esc(st.label)}</span>${state.cart.has(i.id) ? '<b>✓ Added</b>' : ''}</div>`;
  const r = g.getBoundingClientRect();
  tip.style.left = Math.min(innerWidth - 140, Math.max(140, r.left + r.width / 2)) + 'px';
  tip.style.top = r.top + 'px';
  tip.hidden = false;
}
function hideTip() { $('#map-tip').hidden = true; }

function countUp() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $$('.stat strong').forEach(el => {
    const target = el.textContent;
    const m = target.match(/\d+/g); if (!m || reduce || el.dataset.done === target) return;
    el.dataset.done = target;
    const t0 = performance.now(), dur = 900;
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = target.replace(/\d+/g, n => Math.round(+n * e));
      if (k < 1) requestAnimationFrame(tick); else el.textContent = target;
    };
    requestAnimationFrame(tick);
  });
}

// ─────────────────────────── universities
const uniFilter = { pill: 'all', q: '', province: '', field: '', sort: 'name' };

function enterUniversities() {
  const sort = current.query.get('sort');
  if (sort) { uniFilter.sort = sort; $('#uni-sort').value = sort; }
  renderUniversities();
  const openId = current.query.get('open');
  if (openId && byId[openId]) openDrawer(openId);
}

function filteredUnis() {
  const q = uniFilter.q.trim().toLowerCase();
  let list = INSTITUTIONS.filter(i => {
    if (q && !`${i.name} ${i.short} ${i.city} ${i.province}`.toLowerCase().includes(q)) return false;
    if (uniFilter.province && i.province !== uniFilter.province) return false;
    if (uniFilter.field && !i.fields.includes(uniFilter.field)) return false;
    switch (uniFilter.pill) {
      case 'open': return daysUntil(i.closes) >= 0;
      case 'free': return i.fee === 0;
      case 'cao':  return !!i.cao;
      case 'all':  return true;
      default:     return i.type === uniFilter.pill;
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
  if (i.cao) return `R${CAO.fee}<small style="font-family:var(--font);font-weight:500;color:var(--muted);font-size:12px"> CAO</small>`;
  return i.fee === 0 ? '<span class="free">Free</span>' : rand(i.fee);
}

function prospectusButton(i, cls = 'btn btn-outline btn-sm') {
  const p = prospectus(i);
  if (p.kind === 'local') return `<a class="${cls}" href="${esc(p.href)}" download>⬇ Prospectus</a>`;
  if (p.kind === 'pdf')   return `<a class="${cls}" href="${esc(p.href)}" target="_blank" rel="noopener">⬇ Prospectus</a>`;
  return `<a class="${cls}" href="${esc(p.href)}" target="_blank" rel="noopener">Prospectus ↗</a>`;
}

function renderUniversities() {
  const list = filteredUnis();
  $('#uni-meta').textContent = `${list.length} of ${INSTITUTIONS.length} universities` + (state.cart.size ? ` · ${state.cart.size} in your application` : '');
  $('#uni-grid').innerHTML = list.length ? list.map(i => {
    const st = status(i); const inCart = state.cart.has(i.id);
    const closed = st.key === 'closed' && !cycleOver();
    return `<article class="uni-card spot ${inCart ? 'in-cart' : ''}" style="${brandVars(i)}">
      <div class="uni-cover"><span class="sun"></span>${ART.skyline(i.id, i.type)}</div>
      <div class="uni-inner">
      <div class="uni-top">
        <div class="uni-mono" style="background:${brandOf(i).c}${i.short.length > 4 ? ';font-size:10px' : ''}">${esc(i.short.slice(0, 7))}</div>
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
      <div class="uni-actions">
        ${prospectusButton(i)}
        <button class="btn btn-sm ${inCart ? 'btn-added' : 'btn-primary'}" data-cart="${i.id}" ${closed && !inCart ? 'disabled title="Applications have closed"' : ''}>${inCart ? '✓ Added' : closed ? 'Closed' : '+ Add'}</button>
      </div>
      </div>
    </article>`;
  }).join('') : '<div class="card">No universities match those filters.</div>';

  const ids = new Set(list.map(i => i.id));
  if (!$('#list-map').children.length) mountMap($('#list-map'), i => ids.has(i.id));
  else paintMap($('#list-map'), i => ids.has(i.id));
  if ($('#hero-map').children.length) paintMap($('#hero-map'), () => true);

  $('#fee-table tbody').innerHTML = [...INSTITUTIONS].sort((a, b) => a.name.localeCompare(b.name)).map(i => {
    const st = status(i); const p = prospectus(i);
    return `<tr>
      <td><strong>${esc(i.short)}</strong> <span class="muted">${esc(i.name)}</span></td>
      <td>${esc(i.province)}</td>
      <td>${i.cao ? `R${CAO.fee} (CAO)` : rand(i.fee)}${i.verify ? ' <span class="badge verify">confirm</span>' : ''}</td>
      <td>${fmtDate(i.closes)}</td>
      <td><span class="badge ${st.key}">${esc(st.label)}</span></td>
      <td><a href="${esc(p.href)}" ${p.kind === 'local' ? 'download' : 'target="_blank" rel="noopener"'}>${p.kind === 'page' ? 'Website ↗' : 'PDF ' + (p.year || '')}</a></td>
    </tr>`;
  }).join('');
}

function openDrawer(id) {
  const i = byId[id]; if (!i) return;
  const st = status(i); const p = prospectus(i); const inCart = state.cart.has(id);
  const closed = st.key === 'closed' && !cycleOver();
  const a = analyse();
  const c1 = courseById[state.c1];
  const elig = state.confirmed && a.count >= 4 && c1 ? eligibility(c1, i, a) : null;

  const attach = p.kind === 'page'
    ? `<div class="doc-attach"><div class="pdf">WEB</div><div class="meta"><strong>${esc(i.short)} ${p.year || INTAKE_YEAR} prospectus</strong><span>Published on the university website</span></div><a class="btn btn-outline btn-sm" href="${esc(p.href)}" target="_blank" rel="noopener">Open ↗</a></div>`
    : `<div class="doc-attach"><div class="pdf">PDF</div><div class="meta"><strong>${esc(i.short)} ${p.year || INTAKE_YEAR} undergraduate prospectus</strong><span>${p.kind === 'local' ? `Attached · ${fmtSize(p.size)}` : 'Official PDF from ' + esc(new URL(p.href).hostname)}</span></div><a class="btn btn-primary btn-sm" href="${esc(p.href)}" ${p.kind === 'local' ? 'download' : 'target="_blank" rel="noopener"'}>Download</a></div>`;

  $('#drawer-content').innerHTML = `
    <div class="drawer-hero" style="${brandVars(i)}">${ART.skyline(i.id, i.type)}
      <div class="uni-top">
        <div class="uni-mono" style="background:${brandOf(i).c};box-shadow:0 0 0 2px rgba(255,255,255,.2)${i.short.length > 4 ? ';font-size:10px' : ''}">${esc(i.short.slice(0, 7))}</div>
        <div><h2 id="drawer-title" style="margin:0">${esc(i.name)}</h2><p>${esc(i.city)}, ${esc(i.province)} · ${esc(TYPES[i.type])}</p></div>
      </div>
    </div>
    <div class="drawer-body">
      <div class="badges"><span class="badge ${st.key}">${esc(st.label)}</span>${i.cao ? '<span class="badge cao">Apply via CAO</span>' : ''}${i.verify ? '<span class="badge verify">Confirm fee with the university</span>' : ''}</div>
      <div class="kv">
        <div class="fact"><small>Fee · SA applicants</small><strong>${feeHTML(i)}</strong></div>
        <div class="fact"><small>Fee · international</small><strong>${i.cao ? 'R' + CAO.feeIntl : i.feeIntl ? rand(i.feeIntl) : 'See website'}</strong></div>
        <div class="fact"><small>Closing date</small><strong>${fmtDate(i.closes)}</strong></div>
        <div class="fact"><small>Admission score</small><strong style="font-size:13px;font-family:var(--font)">${/standard 7-point/.test(i.apsNote) ? 'Standard APS' : 'Own method'}</strong></div>
      </div>
      ${i.cao ? `<div class="callout info">${esc(CAO.note)}</div>` : ''}
      ${i.feeNote ? `<div class="callout ${i.verify ? 'warn' : 'info'}">${esc(i.feeNote)}</div>` : ''}
      ${i.earlyNote ? `<div class="callout warn">⏰ ${esc(i.earlyNote)}</div>` : ''}
      <div class="callout info">${esc(i.apsNote)}</div>
      ${elig ? `<div class="callout ${elig.key === 'yes' ? 'good' : elig.key === 'maybe' ? 'warn' : 'bad'}"><strong>${esc(c1.name)}:</strong> ${esc(elig.label)}${elig.cutoff ? ` (your APS ${a.aps}, estimated cut-off ${elig.cutoff}${elig.diploma ? ', diploma route' : ''})` : ''}</div>` : ''}
      <h3 style="margin-top:6px">Prospectus</h3>
      ${attach}
      <h3 style="margin-top:6px">Faculties</h3>
      <div class="field-tags">${i.fields.map(f => `<span>${ART.icon(f, 16)} ${esc(FIELDS[f].label)}</span>`).join('')}</div>
      <div class="btn-row">
        <button class="btn ${inCart ? 'btn-added' : 'btn-primary'}" data-cart="${i.id}" ${closed && !inCart ? 'disabled' : ''}>${inCart ? '✓ In your application (remove)' : closed ? 'Applications closed' : '+ Add to my application'}</button>
        <a class="btn btn-outline" href="${esc(i.apply)}" target="_blank" rel="noopener">${i.cao ? 'CAO website ↗' : 'Official site ↗'}</a>
      </div>
    </div>`;
  const drawer = $('#drawer');
  drawer.dataset.id = id;
  if (drawer.hidden) { drawer.hidden = false; document.body.style.overflow = 'hidden'; $('.drawer-close').focus(); }
}
function closeDrawer() {
  const drawer = $('#drawer'); if (drawer.hidden) return;
  drawer.hidden = true; drawer.dataset.id = ''; document.body.style.overflow = '';
  if (current.query.get('open')) history.replaceState(null, '', '#/universities');
}

// ─────────────────────────── APS page
function renderSubjects() {
  const opts = SUBJECTS.map(s => `<option>${esc(s)}</option>`).join('');
  $('#subjects').innerHTML = Array.from({ length: 7 }, (_, n) => `
    <div class="subject-row">
      <span class="n">${n + 1}</span>
      <select data-subj="${n}" aria-label="Subject ${n + 1}"><option value="">Select subject…</option>${opts}</select>
      <input type="number" data-mark="${n}" min="0" max="100" inputmode="numeric" placeholder="%" aria-label="Mark for subject ${n + 1}">
      <span class="pts" data-pts="${n}">–</span>
    </div>`).join('');
  fillSubjects(state.marks);
}
function fillSubjects(marks) {
  for (let n = 0; n < 7; n++) {
    const e = marks[n] || {};
    $(`[data-subj="${n}"]`).value = e.s || '';
    $(`[data-mark="${n}"]`).value = Number.isFinite(e.m) ? e.m : '';
  }
  livePoints();
}
function readSubjects() {
  return Array.from({ length: 7 }, (_, n) => {
    const s = $(`[data-subj="${n}"]`).value;
    const raw = $(`[data-mark="${n}"]`).value;
    const m = raw === '' ? NaN : Math.min(100, Math.max(0, Math.round(Number(raw))));
    return { s, m };
  });
}
function livePoints() {
  readSubjects().forEach((e, n) => {
    const el = $(`[data-pts="${n}"]`);
    if (!e.s || !Number.isFinite(e.m)) { el.textContent = '–'; el.classList.remove('on'); return; }
    el.textContent = isLO(e.s) ? '—' : points(e.m);
    el.classList.toggle('on', !isLO(e.s));
  });
}
function renderAPSPage() {
  if (!$('#subjects').children.length) renderSubjects();
  if (state.marks.some(e => e.s)) showAPS(); else resetAPSCard();
}
function resetAPSCard() {
  $('#aps-value').textContent = '–'; $('#aps-meter').style.width = '0';
  $('#pass-type').textContent = ''; $('#career-results').innerHTML = '';
}
function showAPS() {
  const a = analyse();
  $('#aps-value').textContent = a.aps;
  $('#aps-sub').textContent = `from ${a.count} subject${a.count === 1 ? '' : 's'} · max 42`;
  $('#aps-meter').style.width = Math.min(100, a.aps / 42 * 100) + '%';
  $('#pass-type').textContent = a.pass ? a.pass.label : 'Add all seven subjects to see your NSC pass type.';
  $('#aps-card').classList.toggle('is-sample', !state.confirmed);
  $('#aps-sub').textContent = state.confirmed ? `from ${a.count} subject${a.count === 1 ? '' : 's'} · max 42` : 'Sample marks. Enter yours and press Calculate APS.';
  renderCareers(a);
}

function renderCareers(a) {
  const rows = CAREERS.map(c => {
    const course = courseById[c.course];
    const reqs = checkReqs(course, a.subj);
    const offering = INSTITUTIONS.filter(i => i.fields.includes(course.field) && i.type !== 'technology');
    const within = offering.filter(i => eligibility(course, i, a).key === 'yes');
    const subjectsOk = reqs.every(r => r.ok);
    const tier = a.aps >= course.aps && subjectsOk ? 'yes' : (a.aps >= course.aps - 5 && reqs.every(r => r.have >= r.min - 10)) ? 'close' : 'no';
    return { c, course, reqs, offering, within, tier };
  });
  const yes = rows.filter(r => r.tier === 'yes');
  const close = rows.filter(r => r.tier === 'close');
  const card = r => `
    <article class="career spot" style="--c:${FIELD_COLOURS[r.course.field]}">
      <div class="career-top">
        <div class="career-icon">${ART.icon(r.course.field, 24)}</div>
        <div><h3>${esc(r.c.title)}</h3><div class="sub">${esc(r.course.name)} · ${r.course.years} years · typical APS ${r.course.aps}+</div></div>
      </div>
      <p>${esc(r.c.description)}</p>
      <div class="req-list">
        <span class="req ${a.aps >= r.course.aps ? 'ok' : 'no'}">APS ${a.aps}/${r.course.aps}</span>
        ${r.reqs.map(q => `<span class="req ${q.ok ? 'ok' : 'no'}">${esc(q.label)} ${q.have}%/${q.min}%</span>`).join('')}
      </div>
      <p style="font-size:12.5px">${esc(r.c.note)}</p>
      <div class="career-foot">
        <div><span class="uni-count">Earning</span><br><strong>${esc(r.c.salary)}</strong> <span class="uni-count">/yr</span></div>
        <div style="text-align:right"><span class="uni-count">${r.within.length} of ${r.offering.length} universities in reach</span><br>
        <button class="btn btn-text" data-plan="${r.course.id}">Plan applications →</button></div>
      </div>
    </article>`;
  let html = '';
  if (yes.length) html += `<div class="results-head"><div><h2>You meet the typical requirements for ${yes.length} career${yes.length === 1 ? '' : 's'}</h2><p>Based on a mid-tier university's cut-off. More selective universities ask for more.</p></div></div><div class="career-grid">${yes.map(card).join('')}</div>`;
  if (close.length) html += `<div class="results-head"><div><h2>Within reach: ${close.length} more</h2><p>A few more marks in the red subjects would open these up.</p></div></div><div class="career-grid">${close.map(card).join('')}</div>`;
  if (!html) html = `<div class="card" style="margin-top:24px"><h3>No strong matches yet</h3><p class="muted">Check that every subject has a mark. Higher Certificate and Diploma routes at TVET colleges and universities of technology can lead to a degree later.</p></div>`;
  $('#career-results').innerHTML = html + `<p class="hint" style="margin-top:20px">Salaries are indicative South African ranges for early-to-mid career and vary by employer. Always check the prospectus for exact entry requirements.</p>`;
}

// ─────────────────────────── apply
function enterApply() {
  const s = Number(current.query.get('step'));
  if (s >= 1 && s <= 5) state.step = s;
  renderCourseSelects();
  hydrateDetails();
  goStep(state.step, false);
}

function renderCourseSelects() {
  const groups = Object.entries(FIELDS).map(([k, f]) =>
    `<optgroup label="${esc(f.label)}">${COURSES.filter(c => c.field === k).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
  $('#course1').innerHTML = `<option value="">Select a programme…</option>${groups}`;
  $('#course2').innerHTML = `<option value="">None</option>${groups}`;
  $('#course1').value = state.c1; $('#course2').value = state.c2;
}

function goStep(n, scroll = true) {
  state.step = n;
  $$('.step-panel').forEach(p => p.hidden = Number(p.dataset.panel) !== n);
  $$('#stepper li').forEach(li => {
    const s = Number(li.dataset.step);
    li.classList.toggle('active', s === n);
    li.classList.toggle('done', s < n);
  });
  ({ 2: renderPickList, 3: renderDocs, 4: renderEligibility, 5: renderReview })[n]?.();
  renderSummary();
  const next = $('#next-btn');
  next.textContent = ['', 'Continue to choices →', 'Continue to documents →', 'Check eligibility →', 'Review →', state.ref ? (canPrint ? 'Print application pack' : 'Copy checklist') : 'Create application pack'][n];
  $('#back-btn').hidden = n === 1;
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validSAID(id) {
  if (!/^\d{13}$/.test(id)) return { ok:false, msg:'Must be exactly 13 digits.' };
  const yy = +id.slice(0, 2), mm = +id.slice(2, 4), dd = +id.slice(4, 6);
  const year = yy + (yy <= new Date().getFullYear() % 100 ? 2000 : 1900);
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  if (dob.getUTCMonth() !== mm - 1 || dob.getUTCDate() !== dd) return { ok:false, msg:'The first six digits are not a valid date of birth.' };
  let sum = 0;
  for (let k = 0; k < 13; k++) {
    let d = +id[k];
    if (k % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  if (sum % 10 !== 0) return { ok:false, msg:'Check digit does not match. Please re-check the number.' };
  const gender = +id[6] >= 5 ? 'male' : 'female';
  return { ok:true, msg:`✓ Valid · born ${dd} ${MONTHS[mm - 1]} ${year} · ${gender}${id[10] === '0' ? ' · SA citizen' : ''}` };
}
function makeDemoID() {
  const base = '080315' + '0' + String(Math.floor(Math.random() * 1000)).padStart(3, '0') + '08';
  for (let c = 0; c <= 9; c++) if (validSAID(base + c).ok) return base + c;
  return '0803150123086';
}

function hydrateDetails() {
  const f = $('#details-form');
  for (const [k, v] of Object.entries(state.details)) {
    const el = f.elements[k]; if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  }
  idHint();
}
function readDetails() {
  const f = $('#details-form'); const out = {};
  for (const el of f.elements) if (el.name) out[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  return out;
}
function idHint() {
  const v = $('#details-form').elements.idNumber.value.trim();
  const h = $('#id-hint');
  if (!v) { h.textContent = '13 digits. We check the date of birth and check digit.'; h.className = 'field-hint'; return; }
  const r = validSAID(v); h.textContent = r.msg; h.className = 'field-hint ' + (r.ok ? 'ok' : 'err');
}
function validateDetails() {
  const f = $('#details-form'); let ok = true; let first = null;
  for (const el of f.elements) {
    if (!el.required) continue;
    let bad = !el.value.trim();
    if (!bad && el.type === 'email') bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value);
    if (!bad && el.name === 'cell') bad = el.value.replace(/\D/g, '').length < 10;
    if (!bad && el.name === 'idNumber') bad = !validSAID(el.value.trim()).ok;
    el.classList.toggle('invalid', bad);
    if (bad) { ok = false; first ||= el; }
  }
  if (!ok) { first.focus(); toast('Please fix the highlighted fields.'); }
  return ok;
}

function renderPickList() {
  const c1 = courseById[state.c1];
  const over = cycleOver();
  const list = [...INSTITUTIONS].sort((a, b) => {
    const oa = c1 ? +a.fields.includes(c1.field) : 1, ob = c1 ? +b.fields.includes(c1.field) : 1;
    const ca = daysUntil(a.closes) < 0 ? 1 : 0, cb = daysUntil(b.closes) < 0 ? 1 : 0;
    return (ob - oa) || (ca - cb) || a.name.localeCompare(b.name);
  });
  let lastGroup = '';
  $('#pick-list').innerHTML = (over ? `<div class="callout warn">All ${INTAKE_YEAR} closing dates have passed. You can still build a plan. Next year's dates are usually similar.</div>` : '') + list.map(i => {
    const offers = !c1 || i.fields.includes(c1.field);
    const closed = daysUntil(i.closes) < 0 && !over;
    const group = !offers ? `Doesn't offer ${c1 ? FIELDS[c1.field].label : ''}` : closed ? 'Closed for ' + INTAKE_YEAR : c1 ? `Offers ${FIELDS[c1.field].label}` : 'All universities';
    const head = group !== lastGroup ? `<div class="pick-group">${esc(group)}</div>` : ''; lastGroup = group;
    const on = state.cart.has(i.id); const st = status(i);
    return `${head}<label class="pick ${on ? 'on' : ''} ${closed && !on ? 'disabled' : ''}">
      <input type="checkbox" data-pick="${i.id}" ${on ? 'checked' : ''} ${closed && !on ? 'disabled' : ''}>
      <span class="pick-name">${esc(i.name)}<small>${esc(i.city)} · ${esc(TYPES[i.type])}</small></span>
      <span class="pick-right"><strong>${i.cao ? 'R' + CAO.fee + ' CAO' : rand(i.fee)}</strong><span class="badges"><span class="badge ${st.key}">${esc(st.label)}</span></span></span>
    </label>`;
  }).join('');
}

function renderDocs() {
  $('#doc-list').innerHTML = DOCUMENTS.map(d => {
    const f = state.docs[d.id];
    return `<div class="doc ${f ? 'done' : ''}">
      <div class="doc-ico">${d.icon}</div>
      <div><div class="doc-name">${esc(d.name)}${d.required ? '<span class="req-tag">Required</span>' : ''}</div>
      <div class="doc-hint">${f ? `✓ ${esc(f.name)} · ${fmtSize(f.size)}` : esc(d.hint)}</div></div>
      <div class="btn-row" style="margin:0">
        ${f ? `<button class="btn btn-text" data-doc-clear="${d.id}">Remove</button>` : ''}
        <label class="btn btn-outline btn-sm">${f ? 'Replace' : 'Choose file'}<input type="file" data-doc="${d.id}" accept=".pdf,.jpg,.jpeg,.png"></label>
      </div>
    </div>`;
  }).join('');
}

function renderEligibility() {
  const a = analyse();
  const c1 = courseById[state.c1], c2 = courseById[state.c2];
  const unis = [...state.cart].map(id => byId[id]);
  const body = $('#elig-body');
  if (!c1) { $('#elig-intro').textContent = ''; body.innerHTML = `<div class="callout warn">Choose a first-choice programme in step 2 first.</div>`; return; }
  if (!unis.length) { $('#elig-intro').textContent = ''; body.innerHTML = `<div class="callout warn">Add at least one university in step 2.</div>`; return; }
  if (!state.confirmed || a.count < 4) {
    $('#elig-intro').textContent = 'We need your own marks before we can estimate eligibility.';
    body.innerHTML = `<div class="callout info">Enter your subjects and marks in the APS calculator, then press <strong>Calculate APS</strong> to confirm them. They'll carry over here automatically. Sample marks aren't used.</div><div class="btn-row"><a class="btn btn-primary" href="#/aps">Open the APS calculator →</a></div>`;
    return;
  }
  $('#elig-intro').textContent = `Your APS is ${a.aps}. Cut-offs are estimates from each university's typical requirements, so check the prospectus for the exact figure.`;
  const rows = unis.map(i => {
    let e = eligibility(c1, i, a), course = c1;
    if (c2 && (e.key === 'no' || e.key === 'na')) { const e2 = eligibility(c2, i, a); if (e2.key === 'yes' || e2.key === 'maybe') { e = e2; course = c2; } }
    return { i, e, course };
  });
  const count = k => rows.filter(r => r.e.key === k).length;
  const unlikely = rows.filter(r => r.e.key === 'no' || r.e.key === 'na');
  const wasted = feeBreakdown([...state.cart]).total - feeBreakdown(rows.filter(r => !unlikely.includes(r)).map(r => r.i.id)).total;
  body.innerHTML = `
    <div class="banner ${count('yes') ? 'good' : 'warn'}"><span class="ico">${count('yes') ? '✅' : '⚠️'}</span><div>
      <strong>Likely eligible at ${count('yes')} of ${rows.length}${count('maybe') ? ` · borderline at ${count('maybe')}` : ''}</strong>
      <p>${unlikely.length ? `${unlikely.length} look out of reach. Removing them saves ${rand(wasted)} in fees.` : 'None of your choices look out of reach.'}</p></div></div>
    <table class="elig-table">
      <thead><tr><th>University</th><th>Programme</th><th>Cut-off (est.)</th><th>Status</th></tr></thead>
      <tbody>${rows.map(({ i, e, course }) => `<tr>
        <td><strong>${esc(i.short)}</strong><small>${prospectus(i).kind !== 'page' ? `<a href="${esc(prospectus(i).href)}" target="_blank" rel="noopener">Prospectus</a>` : esc(i.city)}</small></td>
        <td>${esc(course.name)}${course !== c1 ? '<small>Your 2nd choice (1st choice unlikely here)</small>' : ''}${e.diploma && e.key !== 'na' ? '<small>Diploma route likely at a UoT</small>' : ''}${e.reqs.filter(r => !r.ok).map(r => `<small style="color:var(--red)">${esc(r.label)} ${r.have}% (needs ${r.min}%)</small>`).join('')}</td>
        <td>${e.cutoff ? `APS ${e.cutoff}` : '—'}</td>
        <td><span class="badge ${ { yes:'open', maybe:'soon', no:'closed', na:'closed' }[e.key] }">${esc(e.label)}</span></td>
      </tr>`).join('')}</tbody>
    </table>
    ${unlikely.length ? `<div class="btn-row"><button class="btn btn-outline" id="drop-unlikely">Remove ${unlikely.length} unlikely choice${unlikely.length === 1 ? '' : 's'}</button></div>` : ''}
    ${rows.some(r => !/standard 7-point/.test(r.i.apsNote)) ? '<div class="callout info">Some of your universities score applicants their own way. Open each one in the Universities tab to see how.</div>' : ''}`;
  $('#drop-unlikely')?.addEventListener('click', () => {
    unlikely.forEach(r => state.cart.delete(r.i.id));
    save(); refreshCartViews(); renderEligibility(); toast(`Removed ${unlikely.length}. You saved ${rand(wasted)}.`);
  });
}

function renderReview() {
  const d = state.details; const fb = feeBreakdown(); const a = analyse();
  const docsDone = DOCUMENTS.filter(x => state.docs[x.id]).length;
  const missingReq = DOCUMENTS.filter(x => x.required && !state.docs[x.id]);
  const c1 = courseById[state.c1], c2 = courseById[state.c2];
  const problems = [];
  if (!d.firstName) problems.push('personal details');
  if (!c1) problems.push('a first-choice programme');
  if (!state.cart.size) problems.push('at least one university');
  const steps = fb.lines.filter(l => !l.included).map(l => l.inst);
  const caoUnis = fb.lines.filter(l => l.inst.cao).map(l => l.inst.short);
  $('#review-card').innerHTML = `
    <h2>Review &amp; application pack</h2>
    <p class="muted">ImbizoConnect is a concept, so the last step is done on each university's own portal. Your pack lists exactly where to go and what to pay.</p>
    ${problems.length ? `<div class="callout bad">Still needed: ${problems.join(', ')}.</div>` : ''}
    ${missingReq.length ? `<div class="callout warn">Missing required documents: ${missingReq.map(x => esc(x.name)).join(', ')}.</div>` : ''}
    <div class="review-grid">
      <div class="fact"><small>Applicant</small><strong>${esc([d.firstName, d.lastName].filter(Boolean).join(' ') || '—')}</strong></div>
      <div class="fact"><small>Contact</small><strong>${esc(d.email || '—')}</strong></div>
      <div class="fact"><small>APS</small><strong>${a.count ? a.aps : '—'}</strong></div>
      <div class="fact"><small>1st choice</small><strong>${esc(c1?.name || '—')}</strong></div>
      <div class="fact"><small>2nd choice</small><strong>${esc(c2?.name || '—')}</strong></div>
      <div class="fact"><small>Documents</small><strong>${docsDone} of ${DOCUMENTS.length} ready</strong></div>
    </div>
    <h3>Where to apply and pay</h3>
    <table class="elig-table">
      <thead><tr><th>#</th><th>Portal</th><th>Closes</th><th style="text-align:right">Fee</th></tr></thead>
      <tbody>${steps.map((i, n) => `<tr>
        <td>${n + 1}</td>
        <td>${i.cao ? `<strong>CAO</strong><small>One form for ${esc(caoUnis.join(', '))}</small>` : `<strong>${esc(i.name)}</strong>`}<small><a href="${esc(i.apply)}" target="_blank" rel="noopener">${esc(new URL(i.apply).hostname)} ↗</a></small></td>
        <td>${fmtDate(i.cao ? CAO.closes : i.closes)}</td>
        <td style="text-align:right;font-weight:600">${i.cao ? 'R' + CAO.fee : rand(i.fee)}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="muted">No universities selected.</td></tr>'}</tbody>
    </table>
    ${state.ref ? `<div class="receipt">
      <small class="muted">Application pack reference</small>
      <div class="receipt-ref">${esc(state.ref)}</div>
      <p class="muted" style="margin:8px 0 0">Your pack is saved on this device. ${canPrint ? 'Use <strong>Print</strong> to save it as a PDF, or copy' : 'Copy'} the checklist into your notes. Pay each fee on the official portal only, and never into a personal bank account.</p>
      <div class="btn-row"><button class="btn btn-outline btn-sm" id="copy-checklist">Copy checklist</button></div>
    </div>` : ''}`;
}

const canPrint = (() => { try { return window.self === window.top; } catch { return false; } })();

function checklistText() {
  const fb = feeBreakdown(); const c1 = courseById[state.c1];
  const lines = [`ImbizoConnect application pack ${state.ref || ''}`.trim(), `Programme: ${c1 ? c1.name : '-'}`, ''];
  fb.lines.filter(l => !l.included).forEach((l, n) => {
    const i = l.inst;
    lines.push(`${n + 1}. ${i.cao ? 'CAO (' + fb.lines.filter(x => x.inst.cao).map(x => x.inst.short).join(', ') + ')' : i.name}: ${i.cao ? 'R' + CAO.fee : rand(i.fee)}, closes ${fmtDate(i.cao ? CAO.closes : i.closes)}, ${i.apply}`);
  });
  lines.push('', `Total: R${fb.total}`);
  return lines.join('\n');
}
async function copyText(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove(); toast(ok ? done : 'Copy failed. Select the text and copy it manually.');
  }
}
function copyChecklist() { copyText(checklistText(), 'Checklist copied'); }

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('#confetti'); const ctx = cv.getContext('2d');
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio);
  const colours = ['#f4a535', '#1d9e75', '#0c3864', '#e24b4a', '#fdfaf4'];
  const bits = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: colours[Math.floor(Math.random() * colours.length)] }));
  const t0 = performance.now();
  const frame = now => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) { b.vy += .35; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore(); }
    if (now - t0 < 2600) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

function renderSummary() {
  const fb = feeBreakdown();
  $('#sum-count').textContent = `${state.cart.size} selected`;
  $('#summary-body').innerHTML = fb.lines.length ? fb.lines.map(l => `
    <div class="sum-line">
      <div>${esc(l.inst.short)}<small>${esc(l.label)}</small></div>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="amt ${l.included ? 'muted' : l.amount === 0 ? 'free' : ''}">${l.included ? 'R' + CAO.fee : rand(l.amount)}</span>
        <button class="btn btn-text" data-remove="${l.inst.id}" aria-label="Remove ${esc(l.inst.short)}" title="Remove">×</button>
      </div>
    </div>`).join('') : `<div class="sum-empty">No universities yet.<br><a class="btn btn-text" href="#/universities">Browse universities →</a></div>`;
  $('#sum-total').textContent = 'R' + fb.total.toLocaleString('en-ZA');
  const notes = [];
  if (fb.caoCount > 1) notes.push(`CAO saves you R${(fb.naive - fb.total).toLocaleString('en-ZA')}: ${fb.caoCount} KZN universities, one fee.`);
  if (fb.caoCount && state.c1) notes.push(`CAO allows up to ${CAO.maxChoices} programme choices in total.`);
  const free = fb.lines.filter(l => !l.inst.cao && l.amount === 0).length;
  if (free) notes.push(`${free} of your choices are free to apply to.`);
  if (state.details.nsfas && fb.total > 0) notes.push('Tight on money? Ask each university about a fee waiver. Many offer one to NSFAS-eligible applicants.');
  $('#sum-note').textContent = notes.join(' ');
}

function nextStep() {
  const s = state.step;
  if (s === 1) { if (!validateDetails()) return; state.details = readDetails(); save(); }
  if (s === 2) {
    if (!state.c1) { toast('Choose a first-choice programme.'); $('#course1').focus(); return; }
    if (!state.cart.size) { toast('Add at least one university.'); return; }
  }
  if (s === 5) {
    if (!state.ref) {
      if (!state.details.firstName || !state.c1 || !state.cart.size) { toast('Complete the earlier steps first.'); return; }
      state.ref = `IC-${INTAKE_YEAR}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      save(); renderReview(); goStep(5, false); toast('Application pack created'); confetti();
    } else if (canPrint) window.print();
    else copyChecklist();
    return;
  }
  goStep(s + 1);
  history.replaceState(null, '', `#/apply?step=${s + 1}`);
}

// ─────────────────────────── menu / theme
function closeMenu() { $('#primary-nav').classList.remove('open'); $('.menu-toggle').setAttribute('aria-expanded', 'false'); }
function initTheme() {
  const saved = store.get('theme', null);
  if (saved) document.documentElement.dataset.theme = saved;
  else if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; store.set('theme', next);
  });
}

// ─────────────────────────── events
function bind() {
  $('.menu-toggle').addEventListener('click', e => {
    const open = $('#primary-nav').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-cart],[data-open],[data-close],[data-remove],[data-plan],[data-doc-clear]');
    if (!t) return;
    if (t.dataset.cart) toggleCart(t.dataset.cart);
    else if (t.dataset.open) openDrawer(t.dataset.open);
    else if ('close' in t.dataset) closeDrawer();
    else if (t.dataset.remove) toggleCart(t.dataset.remove, false);
    else if (t.dataset.plan) { state.c1 = t.dataset.plan; save(); state.step = 2; location.hash = '#/apply?step=2'; }
    else if (t.dataset.docClear) { delete state.docs[t.dataset.docClear]; save(); renderDocs(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); closeMenu(); } });

  // universities filters
  $('#uni-province').innerHTML += [...new Set(INSTITUTIONS.map(i => i.province))].sort().map(p => `<option>${esc(p)}</option>`).join('');
  $('#uni-field').innerHTML += Object.entries(FIELDS).map(([k, f]) => `<option value="${k}">${esc(f.label)}</option>`).join('');
  $('#uni-search').addEventListener('input', e => { uniFilter.q = e.target.value; renderUniversities(); });
  $('#uni-province').addEventListener('change', e => { uniFilter.province = e.target.value; renderUniversities(); });
  $('#uni-field').addEventListener('change', e => { uniFilter.field = e.target.value; renderUniversities(); });
  $('#uni-sort').addEventListener('change', e => { uniFilter.sort = e.target.value; renderUniversities(); });
  $$('.pill').forEach(p => p.addEventListener('click', () => {
    $$('.pill').forEach(x => x.classList.remove('active')); p.classList.add('active');
    uniFilter.pill = p.dataset.filter; renderUniversities();
  }));

  // APS
  $('#subjects').addEventListener('input', livePoints);
  $('#subjects').addEventListener('change', livePoints);
  $('#subjects-form').addEventListener('submit', e => {
    e.preventDefault();
    const marks = readSubjects();
    if (!marks.some(m => m.s && Number.isFinite(m.m))) { toast('Add at least one subject and mark.'); return; }
    const names = marks.filter(m => m.s).map(m => m.s);
    if (new Set(names).size !== names.length) { toast('Each subject can only be used once.'); return; }
    state.marks = marks; state.confirmed = true; save(); showAPS(); toast('Marks confirmed. Eligibility checks now use your APS.');
    $('#career-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#load-sample').addEventListener('click', () => { fillSubjects(SAMPLE_RESULTS); state.marks = readSubjects(); state.confirmed = false; save(); showAPS(); });
  $('#clear-subjects').addEventListener('click', () => { state.marks = []; state.confirmed = false; save(); fillSubjects([]); resetAPSCard(); });

  // apply
  $$('#stepper button').forEach(b => b.addEventListener('click', () => {
    const target = Number(b.closest('li').dataset.step);
    if (target > 1 && !state.details.firstName) { toast('Complete your details first.'); return; }
    goStep(target); history.replaceState(null, '', `#/apply?step=${target}`);
  }));
  $('#details-form').addEventListener('submit', e => { e.preventDefault(); nextStep(); });
  $('#details-form').addEventListener('input', e => {
    e.target.classList.remove('invalid');
    if (e.target.name === 'idNumber') idHint();
    state.details = readDetails(); save();
  });
  $('#demo-fill').addEventListener('click', () => {
    Object.assign(state.details, { firstName:'Thandiwe', lastName:'Mokoena', email:'thandiwe.demo@example.com', cell:'072 555 0142', idNumber: makeDemoID(), province:'Gauteng', school:'Soweto High School', status:'gr12', nsfas:true });
    save(); hydrateDetails(); toast('Demo details filled in');
  });
  $('#course1').addEventListener('change', e => { state.c1 = e.target.value; save(); renderPickList(); renderSummary(); });
  $('#course2').addEventListener('change', e => { state.c2 = e.target.value; save(); });
  $('#pick-list').addEventListener('change', e => {
    const id = e.target.dataset.pick; if (!id) return;
    if (!toggleCart(id, e.target.checked)) e.target.checked = false;
  });
  $('#doc-list').addEventListener('change', e => {
    const id = e.target.dataset.doc; const file = e.target.files?.[0]; if (!id || !file) return;
    if (file.size > 10 * 1048576) { toast('That file is over 10 MB. Please compress it.'); return; }
    state.docs[id] = { name: file.name, size: file.size }; save(); renderDocs();
  });
  $('#next-btn').addEventListener('click', nextStep);
  $('#back-btn').addEventListener('click', () => { const s = Math.max(1, state.step - 1); goStep(s); history.replaceState(null, '', `#/apply?step=${s}`); });

  window.addEventListener('hashchange', router);
}

// ─────────────────────────── boot
function decorate() {
  $$('[data-logo-mark]').forEach(el => el.outerHTML = ART.logoMark(30));
  document.documentElement.style.setProperty('--ndebele', ART.ndebeleTile());
  $$('.fund').forEach(el => el.classList.add('spot'));

  // Spotlight: follow the pointer inside any .spot card
  document.addEventListener('pointermove', e => {
    const card = e.target.closest?.('.spot'); if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  // Parallax on the hero's floating cards
  const hero = $('#hero-visual');
  if (hero && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
      $$('.float-card', hero).forEach(c => { const d = +c.dataset.depth; c.style.transform = `translate(${-dx * d}px, ${-dy * d}px)`; });
    });
    hero.addEventListener('pointerleave', () => $$('.float-card', hero).forEach(c => c.style.transform = ''));
  }

  // Grid / map view
  $$('.seg-btn').forEach(b => b.addEventListener('click', () => {
    const map = b.dataset.view === 'map';
    $$('.seg-btn').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    $('#uni-grid').hidden = map; $('#uni-map').hidden = !map;
    store.set('view', b.dataset.view);
  }));
  if (store.get('view', 'grid') === 'map') $('.seg-btn[data-view="map"]').click();

  $('#copy-email').addEventListener('click', e => copyText(e.currentTarget.dataset.email, 'Email address copied'));
  document.addEventListener('click', e => { if (e.target.id === 'copy-checklist') copyChecklist(); });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('li[data-open]')) openDrawer(e.target.dataset.open); });
  window.addEventListener('scroll', hideTip, { passive: true });
}

function boot() {
  decorate();
  $$('[data-intake]').forEach(el => el.textContent = INTAKE_YEAR);
  $$('[data-verified]').forEach(el => el.textContent = DATA_VERIFIED);
  initTheme(); bind(); refreshCartViews(); router();
}
boot();
})();
