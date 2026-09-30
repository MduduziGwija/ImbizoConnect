// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
// Rules tests: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  points, analyse, passType, marksProblems, eligibility, validSAID, makeSAID, feeBreakdown, closingStatus,
  daysUntil, profileChecklist, basketProblems, actionError, OFFICER_ACTIONS, STUDENT_ACTIONS, makeRef, byId, courseById,
  PROGRAMMES, programmesOf,
} from '../assets/js/logic.js';
import { INSTITUTIONS, COURSES, CAO, SAMPLE_RESULTS, BRAND } from '../assets/js/data.js';

const sample = SAMPLE_RESULTS.map((x) => ({ ...x }));

test('APS points follow the 7-point NSC scale', () => {
  assert.deepEqual([100, 80, 79, 70, 60, 50, 40, 30, 29, 0].map(points), [7, 7, 6, 6, 5, 4, 3, 2, 1, 1]);
});

test('APS excludes Life Orientation and finds key subjects', () => {
  const a = analyse(sample);
  assert.equal(a.aps, 32);
  assert.equal(a.count, 6);
  assert.equal(a.subj.math, 65);
  assert.equal(a.subj.eng, 72);
  assert.equal(a.subj.mathOrLit, 65);
});

test('NSC pass type', () => {
  assert.equal(passType(sample).key, 'bachelor');
  const weak = sample.map((e) => ({ ...e, m: e.s.includes('Home') ? 45 : 42 }));
  assert.equal(passType(weak).key, 'diploma');
  const noHL = sample.map((e) => ({ ...e, m: e.s.includes('Home') ? 35 : e.m }));
  assert.equal(passType(noHL).key, 'none');
  assert.equal(passType(sample.slice(0, 4)), null);
});

test('marks need seven unique subjects including LO and a Home Language', () => {
  assert.deepEqual(marksProblems(sample), []);
  assert.ok(marksProblems(sample.slice(0, 6)).some((p) => /seven/.test(p)));
  const dup = [...sample.slice(0, 6), { s: 'Mathematics', m: 50 }];
  assert.ok(marksProblems(dup).some((p) => /once/.test(p)));
  const both = [...sample.slice(0, 6).filter((e) => e.s !== 'Accounting'), { s: 'Mathematical Literacy', m: 70 }, { s: 'Life Orientation', m: 60 }];
  assert.ok(marksProblems(both).some((p) => /only one of Mathematics/.test(p)));
});

test('eligibility uses each programme\'s own minimum and subject requirements', () => {
  const a = analyse(sample); // APS 32, Maths 65, English 72
  assert.equal(eligibility(courseById['uj-bacc-ca'], byId.uj, a).key, 'maybe');        // needs APS 33
  assert.equal(eligibility(courseById['uj-bcom-acc'], byId.uj, a).key, 'yes');          // APS 28, Maths 50
  assert.equal(eligibility(courseById['up-bcom-acc'], byId.up, a).key, 'maybe');        // APS 34 and Maths 70%: close
  assert.equal(eligibility(courseById['uct-mbchb'], byId.uct, a).key, 'no');
  assert.equal(eligibility(courseById['wits-bcom-acc'], byId.uj, a).key, 'na');         // wrong institution
  const noMaths = analyse(sample.map((e) => (e.s === 'Mathematics' ? { s: 'Mathematical Literacy', m: 90 } : e)));
  assert.equal(eligibility(courseById['tut-dip-acc'], byId.tut, noMaths).key, 'yes');   // Maths Lit accepted
  assert.equal(eligibility(courseById['tut-bengtech-civil'], byId.tut, noMaths).key, 'no');
});

test('programme catalogues are institution-specific', () => {
  const offers = (inst, kind) => PROGRAMMES.some((p) => p.institution_id === inst && p.kind === kind);
  assert.ok(offers('up', 'vet') && !PROGRAMMES.some((p) => p.kind === 'vet' && p.institution_id !== 'up'), 'only UP trains vets');
  assert.ok(!offers('up', 'bpharm'), 'UP has no pharmacy');
  assert.ok(!offers('uct', 'bedfp') && !offers('uct', 'bedsp'), 'UCT has no undergraduate BEd');
  assert.ok(offers('ru', 'bpharm') && offers('uwc', 'bpharm'));
  assert.ok(PROGRAMMES.filter((p) => p.institution_id === 'vut').every((p) => p.qual !== 'degree' || /BEngTech/.test(p.name)), 'VUT offers diplomas and BEngTech');
  for (const i of INSTITUTIONS) assert.ok(programmesOf(i.id).length >= 10, `${i.short} needs a programme list`);
  assert.equal(new Set(PROGRAMMES.map((p) => p.id)).size, PROGRAMMES.length, 'programme ids are unique');
});

test('SA ID numbers: date of birth and Luhn check digit', () => {
  const id = makeSAID('080315', 123);
  assert.ok(validSAID(id).ok);
  assert.equal(validSAID(id).dob, '2008-03-15');
  assert.equal(validSAID(id).gender, 'female');
  assert.equal(validSAID(makeSAID('080315', 123, true)).gender, 'male');
  assert.equal(validSAID('123').ok, false);
  assert.equal(validSAID('0813450123086').ok, false); // month 13
  const bad = id.slice(0, 12) + ((+id[12] + 1) % 10);
  assert.equal(validSAID(bad).ok, false);
});

test('CAO fee is charged once for KZN institutions', () => {
  const f = feeBreakdown(['ukzn', 'dut', 'mut', 'wits', 'uj']);
  assert.equal(f.total, CAO.fee + 100);
  assert.equal(f.lines.filter((l) => l.included).length, 2);
  assert.equal(f.naive - f.total, CAO.fee * 2);
  assert.equal(feeBreakdown(['dut'], { alreadyPaidCao: true }).total, 0);
});

test('closing status', () => {
  assert.equal(daysUntil('2026-10-01', '2026-09-30'), 1);
  assert.equal(closingStatus(byId.wits, '2026-09-30').label, 'Closes today');
  assert.equal(closingStatus(byId.up, '2026-09-30').key, 'closed');
  assert.equal(closingStatus(byId.spu, '2026-09-01').key, 'open');
});

const readyProfile = {
  first_names: 'Thandiwe', surname: 'Mokoena', id_number: makeSAID('080315', 123), phone: '0725550142', province: 'Gauteng',
  address: '12 Vilakazi St, Orlando West', school: 'Soweto High School', guardian_name: 'Palesa Mokoena',
  marks: sample, marks_confirmed_at: '2026-09-01T10:00:00Z',
};
const readyDocs = [{ kind: 'id' }, { kind: 'gr11' }];

test('profile checklist', () => {
  assert.equal(profileChecklist(readyProfile, readyDocs).ready, true);
  assert.equal(profileChecklist({ ...readyProfile, marks_confirmed_at: null }, readyDocs).ready, false);
  assert.equal(profileChecklist(readyProfile, [{ kind: 'id' }]).percent, 67);
  assert.equal(profileChecklist({ ...readyProfile, id_number: '1234567890123' }, readyDocs).items[0].done, false);
});

test('basket rules: dates, duplicates, offered programmes and CAO choice limit', () => {
  const opts = { profile: readyProfile, docs: readyDocs, on: '2026-09-30' };
  assert.deepEqual(basketProblems([{ institution_id: 'wits', choice1: 'wits-bcom-acc', choice2: 'wits-bcom' }], opts), []);
  assert.ok(basketProblems([{ institution_id: 'up', choice1: 'up-bcom-acc' }], opts).some((p) => /closed/.test(p)));
  assert.deepEqual(basketProblems([{ institution_id: 'up', choice1: 'up-bcom-acc' }], { ...opts, enforceDates: false }), []);
  assert.ok(basketProblems([{ institution_id: 'mut', choice1: 'wits-llb' }], opts).some((p) => /doesn't offer/.test(p)));
  assert.ok(basketProblems([{ institution_id: 'wits', choice1: 'wits-bcom-acc' }], { ...opts, existing: [{ institution_id: 'wits', status: 'submitted' }] }).some((p) => /already/.test(p)));
  const cao = ['ukzn', 'dut', 'mut', 'unizulu'].map((id) => ({ institution_id: id, choice1: programmesOf(id)[0].id, choice2: programmesOf(id)[1].id }));
  assert.ok(basketProblems(cao, opts).some((p) => /CAO allows 6/.test(p)));
  assert.ok(basketProblems([{ institution_id: 'wits', choice1: 'wits-bcom-acc' }], { ...opts, docs: [] }).some((p) => /Complete your profile/.test(p)));
});

test('workflow actions', () => {
  assert.equal(actionError(OFFICER_ACTIONS, 'offer', { status: 'under_review' }), '');
  assert.match(actionError(OFFICER_ACTIONS, 'offer', { status: 'awaiting_payment' }), /can't/);
  assert.match(actionError(OFFICER_ACTIONS, 'decline', { status: 'under_review' }), /note/);
  assert.equal(actionError(OFFICER_ACTIONS, 'decline', { status: 'under_review' }, { note: 'APS too low' }), '');
  const all = [{ id: 1, status: 'accepted' }, { id: 2, status: 'offer' }];
  assert.match(actionError(STUDENT_ACTIONS, 'accept', all[1], { all }), /already accepted/);
  assert.equal(actionError(STUDENT_ACTIONS, 'withdraw', { status: 'offer' }) !== '', true);
  assert.equal(makeRef(42), 'IC27-000042');
});

test('reference data is complete', () => {
  assert.equal(INSTITUTIONS.length, 26);
  for (const i of INSTITUTIONS) {
    assert.ok(i.web && i.apply, `${i.id} needs a website and apply link`);
    assert.ok(BRAND[i.id], `${i.id} needs a brand palette`);
    assert.match(i.closes, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.ok(COURSES.every((c) => Object.keys(c.req).length));
});
