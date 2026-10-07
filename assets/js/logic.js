// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// Application rules shared by the pages, both backends and the tests: APS, NSC pass
// types, SA ID numbers, eligibility estimates, fees (with the CAO charged once),
// the application workflow and profile completeness. No DOM access in this file.
import { INSTITUTIONS, CAO, DOCUMENTS, INTAKE_YEAR } from './data.js';
import { PROGRAMMES, progById, programmesOf } from './programmes.js';

export const byId = Object.fromEntries(INSTITUTIONS.map((i) => [i.id, i]));
// Each institution's faculties follow from the programmes it actually offers.
for (const inst of INSTITUTIONS) inst.fields = [...new Set(programmesOf(inst.id).map((p) => p.field))];
/** Programmes by id. Application choices store programme ids. */
export const courseById = progById;
export { PROGRAMMES, progById, programmesOf };
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Most institutions a student can apply to in one intake. */
export const MAX_INSTITUTIONS = 8;

// ───────────────────────── dates
export function iso(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const today = () => iso();
export function daysUntil(date, from = today()) {
  const [y, m, d] = date.split('-').map(Number);
  const [fy, fm, fd] = from.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}
export function fmtDate(value, withYear = true) {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ' ' + y : ''}`;
}
export function fmtDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${fmtDate(iso(d))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Closing-date status of an institution on `on` (defaults to today). */
export function closingStatus(inst, on = today()) {
  const days = daysUntil(inst.closes, on);
  if (days < 0) return { key: 'closed', days, label: 'Applications closed' };
  if (days === 0) return { key: 'soon', days, label: 'Closes today' };
  if (days <= 14) return { key: 'soon', days, label: `${days} day${days === 1 ? '' : 's'} left` };
  return { key: 'open', days, label: `Open · ${days} days left` };
}
export const isOpen = (inst, on = today()) => daysUntil(inst.closes, on) >= 0;

// ───────────────────────── money
export const rand = (n) => (n === 0 ? 'Free' : 'R' + Number(n).toLocaleString('en-ZA'));
export const feeOf = (inst) => (inst.cao ? CAO.fee : inst.fee);

/**
 * Fee lines for a set of institutions. KwaZulu-Natal institutions share one CAO
 * application, so the CAO fee is charged once however many of them are chosen.
 * `alreadyPaidCao` is true when the student already has a CAO application this intake.
 */
export function feeBreakdown(ids, { alreadyPaidCao = false } = {}) {
  const insts = [...new Set(ids)].map((id) => byId[id]).filter(Boolean)
    .sort((a, b) => (b.cao ? 1 : 0) - (a.cao ? 1 : 0) || a.short.localeCompare(b.short));
  const lines = [];
  let total = 0;
  let caoCharged = alreadyPaidCao;
  for (const inst of insts) {
    if (inst.cao) {
      if (!caoCharged) { lines.push({ inst, amount: CAO.fee, label: 'CAO fee (covers all KZN choices)' }); total += CAO.fee; caoCharged = true; }
      else lines.push({ inst, amount: 0, included: true, label: 'Included in your CAO fee' });
    } else {
      lines.push({ inst, amount: inst.fee, label: inst.fee === 0 ? 'No application fee' : 'Application fee' });
      total += inst.fee;
    }
  }
  const naive = insts.reduce((s, i) => s + i.fee, 0);
  return { lines, total, naive, caoCount: insts.filter((i) => i.cao).length };
}

// ───────────────────────── APS and NSC pass
export const points = (pct) => (pct >= 80 ? 7 : pct >= 70 ? 6 : pct >= 60 ? 5 : pct >= 50 ? 4 : pct >= 40 ? 3 : pct >= 30 ? 2 : 1);
export const isLO = (s) => /life orientation/i.test(s);

/** APS (standard 7-point scale, Life Orientation excluded) and the key subject marks. */
export function analyse(marks = []) {
  const valid = marks.filter((e) => e && e.s && Number.isFinite(e.m) && e.m >= 0 && e.m <= 100);
  const scored = valid.filter((e) => !isLO(e.s));
  const aps = scored.reduce((sum, e) => sum + points(e.m), 0);
  const find = (re) => Math.max(0, ...scored.filter((e) => re.test(e.s)).map((e) => e.m));
  const subj = {
    math: find(/^(Mathematics|Technical Mathematics)$/),
    lit: find(/^Mathematical Literacy$/),
    sci: find(/^(Physical Sciences|Technical Sciences)$/),
    life: find(/^Life Sciences$/),
    eng: find(/^English/),
    acc: find(/^Accounting$/),
  };
  subj.mathOrLit = Math.max(subj.math, subj.lit);
  return { aps, subj, count: scored.length, pass: passType(valid) };
}

/** NSC pass level (simplified: Home Language ≥ 40 plus counts of other subjects, LO excluded). */
export function passType(entries) {
  const scored = entries.filter((e) => !isLO(e.s));
  if (scored.length < 6) return null;
  const hl = scored.find((e) => /Home Language/.test(e.s));
  if (!hl || hl.m < 40) return { key: 'none', label: 'Home Language below 40%, so no NSC pass yet' };
  const others = scored.filter((e) => e !== hl);
  const n50 = others.filter((e) => e.m >= 50).length;
  const n40 = others.filter((e) => e.m >= 40).length;
  const n30 = others.filter((e) => e.m >= 30).length;
  if (n50 >= 4 && n30 >= others.length) return { key: 'bachelor', label: "Bachelor's pass: you can apply for degrees" };
  if (n40 >= 4 && n30 >= others.length) return { key: 'diploma', label: 'Diploma pass: diplomas and higher certificates' };
  if (n40 >= 2 && n30 >= 5) return { key: 'hc', label: 'Higher Certificate pass' };
  return { key: 'none', label: 'Below NSC pass requirements' };
}

/** Problems with a set of marks before they can be confirmed. */
export function marksProblems(marks) {
  const filled = marks.filter((e) => e.s);
  const problems = [];
  if (filled.length < 7) problems.push('Add all seven subjects.');
  if (filled.some((e) => !Number.isFinite(e.m) || e.m < 0 || e.m > 100)) problems.push('Every subject needs a mark from 0 to 100.');
  const names = filled.map((e) => e.s);
  if (new Set(names).size !== names.length) problems.push('Each subject can only be listed once.');
  if (filled.length && !filled.some((e) => isLO(e.s))) problems.push('Include Life Orientation.');
  if (filled.length && !filled.some((e) => /Home Language/.test(e.s))) problems.push('Include your Home Language.');
  if (filled.filter((e) => /^(Mathematics|Mathematical Literacy|Technical Mathematics)$/.test(e.s)).length > 1) problems.push('Choose only one of Mathematics, Technical Mathematics or Mathematical Literacy.');
  return problems;
}

export const REQ_LABEL = { math: 'Maths', mathOrLit: 'Maths / Maths Lit', sci: 'Physical Sci', life: 'Life Sci', eng: 'English', acc: 'Accounting' };
export function checkReqs(course, subj) {
  return Object.entries(course.req).map(([k, min]) => ({ key: k, label: REQ_LABEL[k], min, have: subj[k] || 0, ok: (subj[k] || 0) >= min }));
}

/** Minimum shown to students: the institution's own measure where it has one. */
export const minLabel = (prog) => prog.min || `APS ${prog.aps}`;

/**
 * Estimated eligibility for a programme from an analyse() result. The cut-off is the
 * programme's own minimum (converted to the standard APS scale where the institution uses
 * its own scoring). `inst` is optional and only used to check the programme belongs to it.
 */
export function eligibility(course, inst, a) {
  if (!course) return null;
  if (inst && course.institution_id && course.institution_id !== inst.id) return { key: 'na', label: 'Not offered', cutoff: null, reqs: [] };
  const cutoff = course.aps;
  const reqs = checkReqs(course, a.subj);
  const subjectsOk = reqs.every((r) => r.ok);
  const nearSubjects = reqs.every((r) => r.have >= r.min - 5);
  let key;
  if (a.aps >= cutoff && subjectsOk) key = 'yes';
  else if (a.aps >= cutoff - 2 && nearSubjects) key = 'maybe';
  else key = 'no';
  const label = { yes: 'Likely eligible', maybe: 'Borderline', no: 'Unlikely' }[key];
  return { key, label, cutoff, reqs, diploma: course.qual !== 'degree' };
}

// ───────────────────────── SA ID numbers
/** Validates a 13-digit SA ID number (date of birth + Luhn check digit). */
export function validSAID(id, now = new Date()) {
  id = String(id || '').replace(/\s/g, '');
  if (!/^\d{13}$/.test(id)) return { ok: false, msg: 'Must be exactly 13 digits.' };
  const yy = +id.slice(0, 2), mm = +id.slice(2, 4), dd = +id.slice(4, 6);
  const year = yy + (yy <= now.getFullYear() % 100 ? 2000 : 1900);
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  if (dob.getUTCMonth() !== mm - 1 || dob.getUTCDate() !== dd) return { ok: false, msg: 'The first six digits are not a valid date of birth.' };
  let sum = 0;
  for (let k = 0; k < 13; k++) {
    let d = +id[k];
    if (k % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  if (sum % 10 !== 0) return { ok: false, msg: 'Check digit does not match. Please re-check the number.' };
  const gender = +id[6] >= 5 ? 'male' : 'female';
  const citizen = id[10] === '0';
  const dobIso = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return { ok: true, dob: dobIso, gender, citizen, msg: `Valid · born ${dd} ${MONTHS[mm - 1]} ${year}${citizen ? ' · SA citizen' : ' · permanent resident'}` };
}
/** Builds a valid ID number from a date of birth and a sequence, for demo data. */
export function makeSAID(dobYYMMDD, seq = 123, male = false) {
  const base = dobYYMMDD + String(male ? 5000 + seq : seq).padStart(4, '0') + '08';
  for (let c = 0; c <= 9; c++) if (validSAID(base + c).ok) return base + c;
  return null;
}
export const maskID = (id) => (id ? String(id).slice(0, 6) + '•••••' + String(id).slice(-2) : '');

// ───────────────────────── profile
export const PROFILE_REQUIRED = [
  ['first_names', 'First names'], ['surname', 'Surname'], ['id_number', 'SA ID number'], ['phone', 'Cellphone'],
  ['province', 'Province'], ['address', 'Home address'], ['school', 'High school'], ['guardian_name', 'Parent or guardian'],
];

/** What a student still needs before applying. */
export function profileChecklist(profile = {}, docs = []) {
  const kinds = new Set(docs.map((d) => d.kind));
  const personal = PROFILE_REQUIRED.every(([k]) => String(profile[k] || '').trim()) && validSAID(profile.id_number).ok;
  const marks = !!profile.marks_confirmed_at && analyse(profile.marks || []).count >= 6;
  const reqDocs = DOCUMENTS.filter((d) => d.required);
  const documents = reqDocs.every((d) => kinds.has(d.id));
  const items = [
    { key: 'personal', label: 'Personal and school details', done: personal, route: 'profile' },
    { key: 'marks', label: 'Marks confirmed', done: marks, route: 'profile?tab=marks' },
    { key: 'documents', label: `Required documents (${reqDocs.filter((d) => kinds.has(d.id)).length}/${reqDocs.length})`, done: documents, route: 'profile?tab=documents' },
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { items, percent, ready: items.every((i) => i.done) };
}

// ───────────────────────── applications
export const STATUS = {
  awaiting_payment: { label: 'Awaiting payment', tone: 'warn', step: 1 },
  submitted: { label: 'Submitted', tone: 'info', step: 2 },
  under_review: { label: 'Under review', tone: 'info', step: 3 },
  docs_requested: { label: 'Documents requested', tone: 'warn', step: 3 },
  waitlisted: { label: 'Waitlisted', tone: 'warn', step: 4 },
  offer: { label: 'Provisional offer', tone: 'good', step: 4 },
  declined: { label: 'Unsuccessful', tone: 'bad', step: 4 },
  accepted: { label: 'Offer accepted', tone: 'good', step: 5 },
  offer_declined: { label: 'Offer declined', tone: 'muted', step: 5 },
  withdrawn: { label: 'Withdrawn', tone: 'muted', step: 5 },
};
export const TIMELINE = ['Applied', 'Fee paid', 'Under review', 'Decision', 'Your response'];
export const ACTIVE = ['awaiting_payment', 'submitted', 'under_review', 'docs_requested', 'waitlisted', 'offer'];

/** Actions an admissions officer can take, by current status. */
export const OFFICER_ACTIONS = {
  review: { label: 'Start review', from: ['submitted', 'docs_requested'], to: 'under_review' },
  request_docs: { label: 'Request documents', from: ['submitted', 'under_review'], to: 'docs_requested', note: true },
  offer: { label: 'Make provisional offer', from: ['submitted', 'under_review', 'waitlisted'], to: 'offer' },
  waitlist: { label: 'Waitlist', from: ['submitted', 'under_review'], to: 'waitlisted' },
  decline: { label: 'Decline', from: ['submitted', 'under_review', 'waitlisted', 'docs_requested'], to: 'declined', note: true },
};
/** Actions a student can take on their own application. */
export const STUDENT_ACTIONS = {
  pay: { label: 'Pay fee', from: ['awaiting_payment'], to: 'submitted' },
  respond: { label: 'Send documents / reply', from: ['docs_requested'], to: 'under_review', note: true },
  accept: { label: 'Accept offer', from: ['offer'], to: 'accepted' },
  decline_offer: { label: 'Decline offer', from: ['offer'], to: 'offer_declined' },
  withdraw: { label: 'Withdraw', from: ['awaiting_payment', 'submitted', 'under_review', 'docs_requested', 'waitlisted'], to: 'withdrawn' },
};

/** Checks a workflow action. Returns an error message, or '' when allowed. */
export function actionError(actions, action, app, { note = '', all = [] } = {}) {
  const a = actions[action];
  if (!a) return 'Unknown action.';
  if (!a.from.includes(app.status)) return `You can't ${a.label.toLowerCase()} when the application is ${STATUS[app.status]?.label.toLowerCase() || app.status}.`;
  if (a.note && !String(note).trim()) return 'Please add a note explaining this.';
  if (action === 'accept' && all.some((x) => x.id !== app.id && x.status === 'accepted')) return 'You have already accepted another offer. Decline it first.';
  return '';
}

/** Next reference number, e.g. IC27-000042. */
export const makeRef = (n) => `IC${String(INTAKE_YEAR).slice(2)}-${String(n).padStart(6, '0')}`;

/**
 * Validates a basket of choices before submitting.
 * items: [{ institution_id, choice1, choice2 }]; existing: the student's current applications.
 */
export function basketProblems(items, { profile = {}, docs = [], existing = [], on = today(), enforceDates = true } = {}) {
  const problems = [];
  if (!profileChecklist(profile, docs).ready) problems.push('Complete your profile first: personal details, confirmed marks and required documents.');
  if (!items.length) problems.push('Choose at least one institution.');
  const active = existing.filter((a) => a.status !== 'withdrawn');
  const taken = new Set(active.map((a) => a.institution_id));
  if (taken.size + items.filter((i) => !taken.has(i.institution_id)).length > MAX_INSTITUTIONS) problems.push(`You can apply to at most ${MAX_INSTITUTIONS} institutions per intake.`);
  let caoChoices = active.filter((a) => byId[a.institution_id]?.cao).reduce((n, a) => n + (a.choice2 ? 2 : 1), 0);
  for (const it of items) {
    const inst = byId[it.institution_id];
    if (!inst) { problems.push('Unknown institution.'); continue; }
    if (taken.has(inst.id)) problems.push(`You already applied to ${inst.short}.`);
    if (enforceDates && !isOpen(inst, on)) problems.push(`${inst.short} closed on ${fmtDate(inst.closes)}.`);
    const c1 = courseById[it.choice1];
    if (!c1) problems.push(`Choose a first-choice programme for ${inst.short}.`);
    else if (c1.institution_id !== inst.id) problems.push(`${inst.short} doesn't offer ${c1.name}.`);
    const c2 = it.choice2 ? courseById[it.choice2] : null;
    if (it.choice2 && (!c2 || c2.institution_id !== inst.id)) problems.push(`${inst.short} doesn't offer your second choice.`);
    if (c2 && c2 === c1) problems.push(`Your two choices at ${inst.short} are the same.`);
    if (inst.cao) caoChoices += c2 ? 2 : 1;
  }
  if (caoChoices > CAO.maxChoices) problems.push(`The CAO allows ${CAO.maxChoices} programme choices in total across UKZN, DUT, MUT and UNIZULU.`);
  return [...new Set(problems)];
}

/** Estimated strength of an application, for the admissions queue. */
export function applicantSummary(app, profile) {
  const a = analyse(profile?.marks || []);
  const inst = byId[app.institution_id];
  const e1 = eligibility(courseById[app.choice1], inst, a);
  const e2 = app.choice2 ? eligibility(courseById[app.choice2], inst, a) : null;
  return { aps: a.aps, pass: a.pass, e1, e2, confirmed: !!profile?.marks_confirmed_at };
}

// ─────────────────────────── opening alerts
export const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
/** South African mobile number for WhatsApp, as +27XXXXXXXXX, or null. Accepts 082 123 4567, 27821234567, +27 82 123 4567. */
export function normaliseWhatsApp(s) {
  const d = String(s || '').replace(/[\s()-]/g, '');
  const m = d.match(/^(?:\+?27|0)([6-8]\d{8})$/);
  return m ? `+27${m[1]}` : null;
}
/** Checks an alert request: at least one institution and at least one valid way to reach the person. */
export function alertProblems({ institution_ids = [], email = '', whatsapp = '' }) {
  const p = [];
  if (!institution_ids.length) p.push('Choose at least one institution.');
  if (!email && !whatsapp) p.push('Give an email address or a WhatsApp number.');
  if (email && !validEmail(email)) p.push('That email address doesn\'t look right.');
  if (whatsapp && !normaliseWhatsApp(whatsapp)) p.push('Use a South African cellphone number, like 082 123 4567.');
  return p;
}
