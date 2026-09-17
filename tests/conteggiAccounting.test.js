import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEsattoreTotal, getAccountingName } from '../src/lib/conteggiAccounting.js';

const row = (giro, executor, amount) => ({ giro_name_snapshot: giro, executor_name_snapshot: executor, esattore: amount });
const override = (name, value) => ({ operator_name: name, esattore_override: value });

test('30/08–16/09: Quitadamo executed by Di Bari is replaced, not counted twice', () => {
  const rows = [row('RIGNANESE', 'RIGNANESE', 122930), row('PAPAGNI', 'DI BARI', 4260),
    row('QUITADAMO', 'DI BARI', 117196), row('PAPAGNI', 'PAPAGNI', 29750), row("D'APRILE", "D'APRILE", 144048)];
  const overrides = [override("D'APRILE", 144052), override('QUITADAMO', 117202), override('RIGNANESE', 122934)];
  assert.equal(calculateEsattoreTotal(rows, []), 418184);
  assert.equal(calculateEsattoreTotal(rows, overrides), 418198);
  assert.equal(calculateEsattoreTotal([...rows].reverse(), overrides), 418198);
});

test('giro snapshot has precedence over operator and current giro name', () => {
  assert.equal(getAccountingName({ giro_name_snapshot: 'GIRO: QUITADAMO', operator_name: 'DI BARI', giro_id: '1' },
    { 1: { name: 'Renamed' } }), 'QUITADAMO');
});

test('linked giro fallback and legacy executor fallback', () => {
  assert.equal(getAccountingName({ giro_id: '1', operator_name: 'DI BARI' }, { 1: { name: 'GIRO - QUITADAMO' } }), 'QUITADAMO');
  assert.equal(calculateEsattoreTotal([{ giro_id: '1', esattore: 10 }], [override('QUITADAMO', 12)], { 1: { name: 'QUITADAMO' } }), 12);
  assert.equal(getAccountingName({ executor_name_snapshot: 'DI BARI' }), 'DI BARI');
  assert.equal(getAccountingName({}, {}, () => 'Legacy operator'), 'Legacy operator');
});

test('zero override is honored; orphan override does not create income', () => {
  assert.equal(calculateEsattoreTotal([row('A', 'B', 100)], [override('A', 0), override('B', 250)]), 0);
  assert.equal(calculateEsattoreTotal([], [override('A', 100)]), 0);
});

test('same executor across multiple giri: correction touches only its giro', () => {
  const rows = [row('A', 'Worker', 100), row('B', 'Worker', 200), row('A', 'Other', 50)];
  assert.equal(calculateEsattoreTotal(rows, [override('A', 170)]), 370);
  assert.equal(calculateEsattoreTotal(rows, [override('A', 180)]), 380);
});

test('names normalize case, accents, punctuation; inputs are not modified', () => {
  const rows = Object.freeze([Object.freeze(row('GIRO: D’APRILE', 'Other', '100'))]);
  const overrides = Object.freeze([Object.freeze(override("d'aprile", '104'))]);
  assert.equal(calculateEsattoreTotal(rows, overrides), 104);
  assert.equal(calculateEsattoreTotal(rows, overrides), 104);
});
