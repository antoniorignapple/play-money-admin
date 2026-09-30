import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLocaliReport, readAllReportRows } from '../src/lib/localiReportData.js';
function client(tables, failOffset = -1) {
  return { from(table) { return { select() { return this; }, order() { return this; }, async range(from, to) {
    if (from === failOffset) return { error: { message: 'Errore test' } };
    const rows = tables[table];
    return { data: rows.slice(from, Math.min(to + 1, from + 2)), count: rows.length, error: null };
  } }; } };
}
test('Report completo con limite API basso, ordine e soli locali con Change', async () => {
  const report = await loadLocaliReport(client({ venues: [{ id:'K02' }, { id:'K01' }, { id:'K03' }], machines: Array.from({length:7}, (_,i)=>({id:i,venue_id:i===0?'K02':'K01',name:`Pocket ${i}`})) }));
  assert.deepEqual(report.map(v=>v.id), ['K01','K02']);
  assert.equal(report.flatMap(v=>v.machines).length,7);
});
test('Errore su pagina successiva blocca il report incompleto', async () => {
  await assert.rejects(readAllReportRows(client({machines:[1,2,3]},2),'machines','*'), /Errore test/);
});
