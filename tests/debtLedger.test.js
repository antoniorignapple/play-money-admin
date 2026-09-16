import test from 'node:test';
import assert from 'node:assert/strict';
import { debtLedger, debtTotals, validAmount } from '../src/lib/debtLedger.js';
import { fetchAllRows } from '../src/lib/fetchAllRows.js';
const debt = { importo_originario: 3000, importo_iniziale: 3500, residuo: 2348, created_at: '2026-08-31T22:30:00Z', data_erogazione: '2026-09-01' };
test('Erogazioni distinte, iniziale immutato, totale e residuo coerenti', () => {
  assert.deepEqual(debtTotals(debt), { initial: 3000, total: 3500, remaining: 2348, added: 500, repaid: 1152, percent: 33 });
  const ledger = debtLedger(debt, [{ id: 1, data: '2026-09-08', importo: 1152 }], [{ id: 2, data: '2026-09-16', importo: 500 }]);
  assert.deepEqual(ledger.rows.map(r => r.paid || -r.repaid), [3000, -1152, 500]);
  assert.equal(ledger.difference, 0);
});
test('Storico incompleto segnalato senza inventare rimborsi', () => {
  const ledger = debtLedger(debt);
  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.repaid, 0);
  assert.notEqual(ledger.difference, 0);
});
test('Euro interi, niente importi negativi, NaN o troncamenti silenziosi', () => {
  for (const v of ['', null, NaN, Infinity, 1.5, -1, 1000000000]) assert.equal(validAmount(v), false);
  assert.equal(validAmount(0, true), true); assert.equal(validAmount('500'), true);
});
test('Paginazione completa anche con limite server inferiore a 500', async () => {
  const source = Array.from({ length: 1255 }, (_, id) => ({ id }));
  const result = await fetchAllRows(() => ({ range: async (from, to) => ({ data: source.slice(from, Math.min(to + 1, from + 150)), error: null }) }));
  assert.deepEqual(result, source);
});
