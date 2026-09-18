import test from 'node:test';
import assert from 'node:assert/strict';
import { accountingTotals, officeCashTotals, latestClosedPeriod, parseEuroInput } from '../src/lib/officeCash.js';

test('office cash adds exactly four components without subtracting transfers twice', () => {
  assert.deepEqual(officeCashTotals(10000, { cassa_disponibile: 25000, trasferimenti_totale: 5000, da_riportare: 8000, recuperi: 3000 }, 12000),
    { fondo: 10000, acconti: 25000, daRientrare: 5000, residuo: 12000, totale: 52000 });
});
test('fund starts at zero, negative balances keep their sign, cents are preserved', () => {
  assert.equal(officeCashTotals(0, null, 0).totale, 0);
  assert.equal(officeCashTotals(0, { cassa_disponibile: -100, da_riportare: 50, recuperi: 75 }, -150).totale, -275);
  assert.equal(officeCashTotals(0.1, { cassa_disponibile: 0.2 }, 0).totale, 0.3);
});
test('latest closed period uses period end, not update date or open periods', () => {
  const rows = [{ id: 'a', status: 'closed', date_from: '2026-08-01', date_to: '2026-08-30', updated_at: '2026-10-01' },
    { id: 'b', status: 'closed', date_from: '2026-08-31', date_to: '2026-09-16' }, { id: 'c', status: 'open', date_from: '2026-09-17', date_to: '2026-09-30' }];
  assert.equal(latestClosedPeriod(rows).id, 'b'); assert.equal(latestClosedPeriod([]), null);
  assert.equal(rows[0].id, 'a');
});
test('Italian euro entry rejects empty and ambiguous values instead of silent conversions', () => {
  for (const [input, expected] of [['10.000', 10000], ['10.000,50', 10000.5], ['10000,50', 10000.5], ['-25,75', -25.75], ['0', 0], ['', null], [' ', null], ['1.5', null], ['NaN', null], ['1,234', null], ['9999999999', null]])
    assert.equal(parseEuroInput(input), expected, input);
});
test('company balance: corrected giro, selected debts, cash transfers and manual adjustments', () => {
  const rows = [{ id: 'one', giro_name_snapshot: 'QUITADAMO', executor_name_snapshot: 'DI BARI', esattore: 117196, debito: 1470 }, { id: 'two', giro_name_snapshot: 'PAPAGNI', executor_name_snapshot: 'DI BARI', esattore: 4260, debito: 300 }];
  const result = accountingTotals(rows, [{ operator_name: 'QUITADAMO', esattore_override: 117202 }], ['one'], [{ amount: 10000 }, { amount: -500 }]);
  assert.deepEqual(result, { esattore: 121462, recuperi: 1470, globale: 122932, movimenti: 9500, saldo: 113432 });
  assert.equal(officeCashTotals(0, null, result.saldo).residuo, 113432);
});
