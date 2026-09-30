// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// Demo backend: everything is stored in this browser (localStorage, files in IndexedDB) with
// made-up students and admissions officers. It follows the same rules as supabase/schema.sql
// so the app can be tried without any setup. It is NOT secure: anyone can switch user.
import {
  byId, makeRef, makeSAID, validSAID, basketProblems, actionError, OFFICER_ACTIONS, STUDENT_ACTIONS,
} from '../logic.js';
import { SAMPLE_RESULTS, DOCUMENTS, CAO } from '../data.js';

const KEY = 'imbizo-demo-v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const clone = (x) => JSON.parse(JSON.stringify(x));
const daysAgo = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 15, 0, 0); return d.toISOString(); };

// ───────────────────────── files (IndexedDB, falls back to memory)
const memFiles = new Map();
function idb() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('imbizo-demo-files', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function putFile(key, blob) {
  const db = await idb();
  if (!db) { memFiles.set(key, blob); return; }
  await new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(blob, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
async function getFile(key) {
  const db = await idb();
  if (!db) return memFiles.get(key) || null;
  return new Promise((res) => { const r = db.transaction('files').objectStore('files').get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
}
async function delFile(key) {
  const db = await idb();
  if (!db) { memFiles.delete(key); return; }
  await new Promise((res) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete(key); tx.oncomplete = res; tx.onerror = res; });
}
async function clearFiles() {
  memFiles.clear();
  const db = await idb();
  if (db) await new Promise((res) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').clear(); tx.oncomplete = res; tx.onerror = res; });
}

/** A one-page PDF placeholder for seeded demo documents. */
function demoPdf(title, lines) {
  const safe = (s) => String(s).replace(/[\\()]/g, (c) => '\\' + c);
  const text = [`BT /F1 20 Tf 60 770 Td (${safe(title)}) Tj ET`, 'BT /F1 11 Tf 60 740 Td (DEMO DOCUMENT - not a real record) Tj ET',
    ...lines.map((l, i) => `BT /F1 12 Tf 60 ${700 - i * 20} Td (${safe(l)}) Tj ET`)].join('\n');
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${text.length}>>\nstream\n${text}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: 'application/pdf' });
}

// ───────────────────────── seed
function seed() {
  const P = (id, role, first_names, surname, extra = {}) => ({
    id, role, first_names, surname, full_name: `${first_names} ${surname}`,
    email: `${first_names.split(' ')[0].toLowerCase()}.${surname.toLowerCase().replace(/\s/g, '')}@example.org`,
    phone: '', id_number: '', province: '', address: '', city: '', postal_code: '', home_language: '',
    guardian_name: '', guardian_phone: '', guardian_relation: '', school: '', school_status: 'gr12', matric_year: 2026,
    nsfas: false, disability: false, marks: [], marks_term: 'gr11', marks_confirmed_at: null, institution_id: null,
    job_title: '', created_at: daysAgo(60), ...extra,
  });
  const marks = (m) => SAMPLE_RESULTS.map((x, i) => ({ s: x.s, m: m[i] }));
  const complete = (seq, dob, male, extra) => ({
    id_number: makeSAID(dob, seq, male), phone: `07${2 + (seq % 7)} 555 0${String(100 + seq).slice(-3)}`,
    guardian_relation: 'Mother', school_status: 'gr12', nsfas: seq % 2 === 0, ...extra,
  });
  const profiles = [
    P('s-thandiwe', 'student', 'Thandiwe', 'Mokoena', complete(142, '080315', false, {
      province: 'Gauteng', address: '12 Vilakazi Street, Orlando West', city: 'Soweto', postal_code: '1804', home_language: 'English',
      guardian_name: 'Palesa Mokoena', guardian_phone: '082 555 0199', school: 'Morris Isaacson High School',
      marks: marks([72, 78, 65, 58, 68, 71, 80]), marks_confirmed_at: daysAgo(20), nsfas: true,
    })),
    P('s-sipho', 'student', 'Sipho', 'Dlamini', {
      province: 'KwaZulu-Natal', city: 'Durban', home_language: 'IsiZulu', school: 'Umlazi Comtech High School', phone: '071 555 0133',
    }),
    P('s-aisha', 'student', 'Aisha', 'Petersen', complete(88, '070722', false, {
      province: 'Western Cape', address: '4 Rose Street, Bo-Kaap', city: 'Cape Town', postal_code: '8001', home_language: 'Afrikaans',
      guardian_name: 'Yusuf Petersen', guardian_phone: '083 555 0120', guardian_relation: 'Father', school: 'Harold Cressy High School',
      school_status: 'matric', matric_year: 2025,
      marks: [{ s: 'Afrikaans Home Language', m: 84 }, { s: 'English First Additional Language', m: 81 }, { s: 'Mathematics', m: 82 },
        { s: 'Physical Sciences', m: 79 }, { s: 'Life Sciences', m: 88 }, { s: 'Geography', m: 76 }, { s: 'Life Orientation', m: 85 }],
      marks_term: 'final', marks_confirmed_at: daysAgo(70),
    })),
    // Further applicants, so admissions queues look like a real intake.
    ...[
      ['s-kabelo', 'Kabelo', 'Molefe', 'North West', 'Mahikeng', [64, 70, 74, 69, 55, 60, 75], true],
      ['s-lerato', 'Lerato', 'Nkosi', 'Gauteng', 'Tembisa', [81, 75, 84, 80, 72, 77, 82], false],
      ['s-ruan', 'Ruan', 'van der Merwe', 'Free State', 'Bloemfontein', [58, 61, 52, 49, 63, 66, 70], true],
      ['s-nomvula', 'Nomvula', 'Zulu', 'KwaZulu-Natal', 'Pietermaritzburg', [70, 82, 61, 57, 66, 73, 78], false],
      ['s-ayanda', 'Ayanda', 'Mthembu', 'Mpumalanga', 'Mbombela', [55, 68, 47, 45, 58, 62, 71], true],
    ].map(([id, f, s, prov, city, m, male], k) => P(id, 'student', f, s, complete(300 + k * 17, `08${String(1 + k * 2).padStart(2, '0')}1${k}`, male, {
      province: prov, city, address: `${20 + k} Main Road`, postal_code: String(2000 + k * 311), home_language: 'English',
      guardian_name: `Parent of ${f}`, guardian_phone: '079 555 0170', school: `${city} Secondary School`,
      marks: marks(m), marks_confirmed_at: daysAgo(30 - k),
    }))),
    P('o-wits', 'officer', 'Naledi', 'Khumalo', { institution_id: 'wits', job_title: 'Admissions Officer, Wits', email: 'n.khumalo@example.org' }),
    P('o-uj', 'officer', 'Johan', 'Pretorius', { institution_id: 'uj', job_title: 'Admissions Officer, UJ', email: 'j.pretorius@example.org' }),
    P('o-ukzn', 'officer', 'Priya', 'Naidoo', { institution_id: 'ukzn', job_title: 'Admissions Officer, UKZN (via CAO)', email: 'p.naidoo@example.org' }),
    P('a-admin', 'admin', 'Lwazi', 'Ndlovu', { job_title: 'Platform administrator', email: 'admin@example.org' }),
  ];

  const docs = [];
  const addDoc = (owner, kind, days) => {
    const d = DOCUMENTS.find((x) => x.id === kind);
    docs.push({ id: uid(), owner_id: owner, kind, name: `${kind}-${owner.slice(2)}.pdf`, size: 48000 + kind.length * 1200, type: 'application/pdf', demo: d.name, uploaded_at: daysAgo(days) });
  };
  for (const p of profiles.filter((x) => x.role === 'student' && x.marks_confirmed_at)) { addDoc(p.id, 'id', 25); addDoc(p.id, 'gr11', 24); }
  addDoc('s-thandiwe', 'photo', 22); addDoc('s-thandiwe', 'income', 21);
  addDoc('s-aisha', 'res', 60); addDoc('s-aisha', 'photo', 60);

  const state = { currentUser: null, profiles, docs, applications: [], events: [], counters: { ref: 1 } };
  const name = (id) => profiles.find((p) => p.id === id)?.full_name || 'ImbizoConnect';
  const log = (app, actor, action, note, at) => state.events.push({ id: uid(), application_id: app.id, actor_id: actor, actor_name: name(actor), action, note: note || '', at });

  // Applications with a history, in the order things happened.
  const A = (student, inst, c1, c2, steps, group) => {
    const i = byId[inst];
    const app = { id: uid(), ref: makeRef(state.counters.ref++), student_id: student, institution_id: inst, choice1: c1, choice2: c2 || null,
      status: 'submitted', fee: i.cao ? 0 : i.fee, cao_group: group || null, payment_ref: null, paid_at: null, offer_choice: null, decision_note: '',
      submitted_at: null, updated_at: null };
    state.applications.push(app);
    for (const [status, days, actor, action, note, extra] of steps) {
      Object.assign(app, { status, updated_at: daysAgo(days) }, extra || {});
      if (action === 'submit') app.submitted_at = daysAgo(days);
      log(app, actor || student, action, note, daysAgo(days));
    }
    return app;
  };
  const paid = (days, ref) => ['submitted', days, null, 'pay', `Paid online · ${ref}`, { paid_at: daysAgo(days), payment_ref: ref }];

  A('s-thandiwe', 'wits', 'acc', 'mgmt', [['awaiting_payment', 18, null, 'submit'], paid(18, 'PF-83412'), ['under_review', 9, 'o-wits', 'review']]);
  A('s-thandiwe', 'uj', 'acc', 'econ', [['submitted', 18, null, 'submit'], ['under_review', 12, 'o-uj', 'review'],
    ['offer', 3, 'o-uj', 'offer', 'Congratulations! Provisional offer for BCom Accounting (CA stream), subject to your final NSC results.', { offer_choice: 'acc', decision_note: 'Provisional offer, subject to final NSC results.' }]]);
  const g = uid();
  const u1 = A('s-thandiwe', 'ukzn', 'acc', 'is', [['awaiting_payment', 2, null, 'submit']], g);
  u1.fee = 250;
  A('s-thandiwe', 'dut', 'is', null, [['awaiting_payment', 2, null, 'submit']], g);

  A('s-aisha', 'uct', 'mbchb', 'physio', [['awaiting_payment', 80, null, 'submit'], paid(80, 'PF-55120'), ['under_review', 60, null, 'review'],
    ['declined', 40, null, 'decline', 'The MBChB programme was oversubscribed this year. Your application was strong but not ranked high enough for a place.', { decision_note: 'Not ranked high enough in MBChB selection.' }]]);
  A('s-aisha', 'su', 'bsc', 'physio', [['awaiting_payment', 79, null, 'submit'], paid(79, 'PF-55188'), ['under_review', 55, null, 'review'],
    ['offer', 35, null, 'offer', 'Welcome to Stellenbosch! Offer for BSc Biological Sciences.', { offer_choice: 'bsc' }], ['accepted', 33, null, 'accept']]);
  A('s-aisha', 'uwc', 'physio', null, [['submitted', 78, null, 'submit'], ['offer', 30, null, 'offer', 'Offer for BSc Physiotherapy.', { offer_choice: 'physio' }], ['offer_declined', 29, null, 'decline_offer', 'Accepted a place elsewhere.']]);

  A('s-kabelo', 'wits', 'civil', 'elec', [['awaiting_payment', 14, null, 'submit'], paid(14, 'PF-60311')]);
  A('s-lerato', 'wits', 'cs', 'ds', [['awaiting_payment', 16, null, 'submit'], paid(16, 'PF-60102'), ['under_review', 10, 'o-wits', 'review'],
    ['offer', 5, 'o-wits', 'offer', 'Provisional offer for BSc Computer Science.', { offer_choice: 'cs' }]]);
  A('s-ruan', 'wits', 'econ', null, [['awaiting_payment', 11, null, 'submit'], paid(11, 'PF-60877'), ['docs_requested', 6, 'o-wits', 'request_docs', 'Please upload your Grade 12 June results so we can complete the assessment.']]);
  A('s-ayanda', 'wits', 'nursing', null, [['awaiting_payment', 8, null, 'submit'], paid(7, 'PF-61240')]);
  A('s-lerato', 'uj', 'cs', null, [['submitted', 15, null, 'submit']]);
  A('s-kabelo', 'uj', 'civil', null, [['submitted', 13, null, 'submit'], ['under_review', 4, 'o-uj', 'review']]);
  A('s-ayanda', 'uj', 'nursing', 'mgmt', [['submitted', 8, null, 'submit']]);
  const g2 = uid();
  const n1 = A('s-nomvula', 'ukzn', 'llb', 'psych', [['awaiting_payment', 12, null, 'submit'], paid(12, 'CAO-448812')], g2);
  n1.fee = 250;
  A('s-nomvula', 'unizulu', 'llb', null, [['awaiting_payment', 12, null, 'submit'], paid(12, 'CAO-448812')], g2);
  A('s-ruan', 'ukzn', 'agri', null, [['awaiting_payment', 9, null, 'submit'], paid(9, 'CAO-449901'), ['under_review', 3, 'o-ukzn', 'review']]).fee = 250;
  state.events.sort((a, b) => a.at.localeCompare(b.at));
  return state;
}

let state = null;
function load() {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
  if (!state) { state = seed(); save(); }
  return state;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked: keep in memory */ } }
const me = () => load().profiles.find((p) => p.id === state.currentUser) || null;
function need(role) {
  const m = me();
  if (!m) throw new Error('Please sign in.');
  if (role && !role.includes(m.role)) throw new Error('You do not have access to that.');
  return m;
}
function visibleApps(m) {
  const s = load();
  if (m.role === 'admin') return s.applications;
  if (m.role === 'officer') return s.applications.filter((a) => a.institution_id === m.institution_id && a.status !== 'awaiting_payment');
  return s.applications.filter((a) => a.student_id === m.id);
}
function log(app, action, note = '') {
  const m = me();
  state.events.push({ id: uid(), application_id: app.id, actor_id: m.id, actor_name: m.full_name, action, note, at: new Date().toISOString() });
}

export const demoApi = {
  kind: 'demo',
  enforceDates: false, // the demo lets you try every institution, even after closing dates
  async init() { load(); },
  async session() { return clone(me()); },
  async demoUsers() { return clone(load().profiles.filter((p) => !['s-kabelo', 's-lerato', 's-ruan', 's-nomvula', 's-ayanda'].includes(p.id))); },
  async demoLogin(id) { load().currentUser = id; save(); },
  async demoReset() { state = seed(); save(); await clearFiles(); },
  async signOut() { load().currentUser = null; save(); },
  async signIn() { throw new Error('The demo has no passwords. Pick a person to sign in as.'); },
  async signUp(email, password, full_name) {
    const s = load();
    if (s.profiles.some((p) => p.email === email)) throw new Error('That email already has an account.');
    const [first, ...rest] = String(full_name || '').trim().split(/\s+/);
    const p = { id: uid(), role: 'student', email, first_names: first || '', surname: rest.join(' '), full_name, marks: [], created_at: new Date().toISOString() };
    s.profiles.push(p); s.currentUser = p.id; save();
    return { needsConfirmation: false };
  },

  async profiles() {
    const m = need();
    const s = load();
    if (m.role === 'admin') return clone(s.profiles);
    if (m.role === 'officer') {
      const ids = new Set(visibleApps(m).map((a) => a.student_id));
      return clone(s.profiles.filter((p) => ids.has(p.id) || p.id === m.id));
    }
    return clone([m]);
  },
  async saveProfile(patch) {
    const m = need();
    const allowed = { ...patch };
    delete allowed.id; delete allowed.role; delete allowed.institution_id; delete allowed.email;
    if (allowed.id_number && !validSAID(allowed.id_number).ok) throw new Error('That SA ID number is not valid.');
    if ('first_names' in allowed || 'surname' in allowed) allowed.full_name = `${allowed.first_names ?? m.first_names} ${allowed.surname ?? m.surname}`.trim();
    Object.assign(m, allowed);
    save();
    return clone(m);
  },
  async setRole(userId, role, institution_id) {
    need(['admin']);
    const p = load().profiles.find((x) => x.id === userId);
    if (!p) throw new Error('No such user.');
    if (p.id === state.currentUser && role !== 'admin') throw new Error("You can't remove your own admin role.");
    if (role === 'officer' && !byId[institution_id]) throw new Error('Choose the institution this officer works for.');
    Object.assign(p, { role, institution_id: role === 'officer' ? institution_id : null });
    save();
  },

  async documents(ownerId) {
    const m = need();
    const owner = ownerId || m.id;
    if (owner !== m.id && m.role === 'student') throw new Error('You do not have access to that.');
    if (m.role === 'officer' && owner !== m.id && !visibleApps(m).some((a) => a.student_id === owner)) throw new Error('You do not have access to that.');
    return clone(load().docs.filter((d) => d.owner_id === owner));
  },
  async uploadDocument(kind, file) {
    const m = need(['student']);
    if (!DOCUMENTS.some((d) => d.id === kind)) throw new Error('Unknown document type.');
    if (file.size > 10 * 1048576) throw new Error('That file is over 10 MB. Please compress it.');
    const s = load();
    for (const old of s.docs.filter((d) => d.owner_id === m.id && d.kind === kind)) await delFile(old.id);
    s.docs = s.docs.filter((d) => !(d.owner_id === m.id && d.kind === kind));
    const doc = { id: uid(), owner_id: m.id, kind, name: file.name, size: file.size, type: file.type, uploaded_at: new Date().toISOString() };
    await putFile(doc.id, file);
    s.docs.push(doc); save();
    return clone(doc);
  },
  async removeDocument(id) {
    const m = need(['student']);
    const s = load();
    s.docs = s.docs.filter((d) => !(d.id === id && d.owner_id === m.id));
    await delFile(id); save();
  },
  async documentUrl(doc) {
    const blob = doc.demo ? demoPdf(doc.demo, [`Applicant: ${load().profiles.find((p) => p.id === doc.owner_id)?.full_name}`, `File: ${doc.name}`, `Uploaded: ${doc.uploaded_at.slice(0, 10)}`]) : await getFile(doc.id);
    if (!blob) throw new Error('That file is no longer stored in this browser.');
    return URL.createObjectURL(blob);
  },

  async applications() { return clone(visibleApps(need())); },
  async events() {
    const m = need();
    const ids = new Set(visibleApps(m).map((a) => a.id));
    return clone(load().events.filter((e) => ids.has(e.application_id)));
  },

  async submitApplications(items) {
    const m = need(['student']);
    const s = load();
    const existing = s.applications.filter((a) => a.student_id === m.id);
    const docs = s.docs.filter((d) => d.owner_id === m.id);
    const problems = basketProblems(items, { profile: m, docs, existing, enforceDates: this.enforceDates });
    if (problems.length) throw new Error(problems.join(' '));
    // One CAO fee per student: the first CAO application carries it, later ones share its payment.
    const caoApps = existing.filter((a) => byId[a.institution_id].cao);
    const group = caoApps[0]?.cao_group || uid();
    const caoPaid = caoApps.find((a) => a.paid_at);
    let caoFeeTaken = caoApps.length > 0;
    const created = [];
    for (const it of items) {
      const inst = byId[it.institution_id];
      let fee = inst.fee, status = inst.fee > 0 ? 'awaiting_payment' : 'submitted';
      if (inst.cao) {
        fee = caoFeeTaken ? 0 : CAO.fee;
        caoFeeTaken = true;
        status = caoPaid ? 'submitted' : 'awaiting_payment';
      }
      const now = new Date().toISOString();
      const app = {
        id: uid(), ref: makeRef(s.counters.ref++), student_id: m.id, institution_id: inst.id, choice1: it.choice1, choice2: it.choice2 || null,
        status, fee, cao_group: inst.cao ? group : null,
        payment_ref: inst.cao && caoPaid ? caoPaid.payment_ref : null, paid_at: inst.cao && caoPaid ? caoPaid.paid_at : null,
        offer_choice: null, decision_note: '', submitted_at: now, updated_at: now,
      };
      s.applications.push(app);
      log(app, 'submit', inst.cao ? 'Sent through the CAO' : '');
      created.push(app);
    }
    save();
    return clone(created);
  },

  /** Student actions. `pay` settles every unpaid application in the same CAO group too. */
  async studentAction(appId, action, note = '', extra = {}) {
    const m = need(['student']);
    const s = load();
    const app = s.applications.find((a) => a.id === appId && a.student_id === m.id);
    if (!app) throw new Error('Application not found.');
    const mine = s.applications.filter((a) => a.student_id === m.id);
    const err = actionError(STUDENT_ACTIONS, action, app, { note, all: mine });
    if (err) throw new Error(err);
    const targets = action === 'pay' && app.cao_group ? mine.filter((a) => a.cao_group === app.cao_group && a.status === 'awaiting_payment') : [app];
    for (const t of targets) {
      t.status = STUDENT_ACTIONS[action].to;
      t.updated_at = new Date().toISOString();
      if (action === 'pay') Object.assign(t, { paid_at: t.updated_at, payment_ref: extra.payment_ref || `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}` });
      log(t, action, action === 'pay' ? `Paid · ${t.payment_ref}` : note);
    }
    if (action === 'accept') {
      for (const other of mine.filter((a) => a.id !== app.id && a.status === 'offer')) {
        other.status = 'offer_declined'; other.updated_at = app.updated_at;
        log(other, 'decline_offer', `Declined automatically: accepted an offer from ${byId[app.institution_id].short}.`);
      }
    }
    save();
  },

  async officerAction(appId, action, note = '', extra = {}) {
    const m = need(['officer', 'admin']);
    const app = visibleApps(m).find((a) => a.id === appId);
    if (!app) throw new Error('Application not found.');
    const err = actionError(OFFICER_ACTIONS, action, app, { note });
    if (err) throw new Error(err);
    if (action === 'offer') {
      const choice = extra.offer_choice || app.choice1;
      if (![app.choice1, app.choice2].includes(choice)) throw new Error('The offer must be for one of the applicant\'s choices.');
      app.offer_choice = choice;
    }
    app.status = OFFICER_ACTIONS[action].to;
    app.updated_at = new Date().toISOString();
    if (['offer', 'decline', 'waitlist'].includes(action)) app.decision_note = note;
    log(app, action, note);
    save();
  },
};
