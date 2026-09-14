import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSimulationArchive, filterSimulations } from '../src/lib/simulationArchive.js';

test('storico completo oltre 3000 righe e limite server inferiore alla pagina richiesta', async () => {
  const source = Array.from({ length: 3102 }, (_, id) => ({ id, work_date: '2026-08-20' }));
  const client = { from() { return this; }, select() { return this; }, order() { return this; },
    async range(from, to) { return { data: source.slice(from, Math.min(to + 1, from + 200)) }; } };
  assert.deepEqual(await loadSimulationArchive(client), source);
});
test('errore su pagina successiva non restituisce uno storico incompleto', async () => {
  const client = { from() { return this; }, select() { return this; }, order() { return this; },
    async range(from) { return from ? { error: new Error('rete') } : { data: [{ id: 1 }] }; } };
  await assert.rejects(loadSimulationArchive(client), /rete/);
});
test('Tutte include agosto; filtri inclusivi, aperti e dipendente', () => {
  const rows = [
    { id: 1, work_date: '2026-08-31', created_at: '2026-09-01T10:00:00Z', operator_name: 'Antonio' },
    { id: 2, work_date: '2026-09-01', operator_name: 'Marco' },
    { id: 3, created_at: '2026-08-01T10:00:00Z', operator_name: 'ANTONIO' },
  ];
  assert.deepEqual(filterSimulations(rows, '', '', 'all'), rows);
  assert.deepEqual(filterSimulations(rows, '2026-08-31', '2026-08-31', 'antonio'), [rows[0]]);
  assert.deepEqual(filterSimulations(rows, '', '2026-08-31', 'all'), [rows[0], rows[2]]);
  assert.deepEqual(filterSimulations(rows, '2026-09-01', '', 'all'), [rows[1]]);
});
