import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validDate, validateRecord, validateBackup, parseCents, importPlan, readLegacy, LEGACY_KEY, toCSV } from '../src/ledger.js';
const record = { date: '2026-01-01', opening: 10000, cash: 2000, card: 9000, expenses: 500, withdrawals: 1000 };
test('validation checks real calendar dates and integer cents, including zero', () => {
  for (const date of ['2024-02-29','2000-02-29','2026-04-30']) assert.equal(validDate(date), true);
  for (const date of ['0000-01-01','2026-02-29','1900-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','2026-1-01','invalid']) assert.equal(validDate(date), false);
  assert.equal(validateRecord({ ...record, actual: 0 }).actual, 0);
  for (const value of [-1, 0.5, '0', null, NaN, Infinity, 10000000001]) {
    for (const field of ['opening','cash','card','expenses','withdrawals','actual']) assert.throws(() => validateRecord({ ...record, [field]: value }));
  }
  assert.throws(() => validateRecord({ ...record, notes: 'a'.repeat(301) }));
  assert.equal(validateRecord({ ...record, notes: '😀'.repeat(300) }).notes.length,600);
  assert.throws(() => validateRecord({ ...record, notes: '😀'.repeat(301) }));
  assert.throws(() => validateRecord({ ...record, notes: 1 }));
  assert.throws(() => validateRecord({ ...record, extra: true }));
  assert.equal(parseCents('0', true), 0); assert.equal(parseCents('', true), undefined);
  assert.equal(parseCents('1.01'), 101); assert.equal(parseCents('0.29'), 29);
  for (const input of ['', '-1', '1.001', 'Infinity', '1e2', '100000001']) assert.throws(() => parseCents(input));
});
test('older backups and explicit import previews preserve source and skip existing dates', () => {
  const local = [record, { ...record, date:'2026-01-02', actual:0 }];
  const before = JSON.stringify(local);
  const plan = importPlan(local, [record]);
  assert.equal(plan.eligible.length,1); assert.equal(plan.duplicates.length,1);
  assert.equal(plan.eligible[0].actual,0); assert.equal(JSON.stringify(local),before);
  assert.equal(validateBackup({version:1,records:[record]})[0].actual,undefined);
  assert.throws(() => validateBackup({version:1,records:[record,record]}),/duplicate/);
  const storage={getItem:key=>{assert.equal(key,LEGACY_KEY);return before;}};
  assert.equal(readLegacy(storage).length,2);
  assert.equal(readLegacy({getItem:()=>null}),null);
  assert.throws(() => readLegacy({getItem:()=>'{bad'}));
});
test('CSV retains zero actual counts, signed differences and quoted multiline notes', () => {
  const csv=toCSV([{...record,actual:0,notes:'supplier, "paid"\nnext day'}]);
  assert.match(csv,/105\.00,0\.00,-105\.00,Short by \$105\.00/);
  assert.match(csv,/"supplier, ""paid""\nnext day"/);
  assert.match(toCSV([{...record,notes:'=1+1'}]),/"'=1\+1"/);
});
