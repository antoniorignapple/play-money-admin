import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLocaliReport, readAllReportRows, normalizeReportSlots } from '../src/lib/localiReportData.js';
function client(tables, failOffset = -1) {
  return { from(table) { return { select() { return this; }, order() { return this; }, async range(from, to) {
    if (from === failOffset) return { error: { message: 'Errore test' } };
    const rows = tables[table];
    return { data: rows.slice(from, Math.min(to + 1, from + 2)), count: rows.length, error: null };
  } }; } };
}
test('Report completo con limite API basso, ordine e soli locali con Change', async () => {
  const report = await loadLocaliReport(client({ venues: [{ id:'K02' }, { id:'K01' }, { id:'K03' }], machines: Array.from({length:7}, (_,i)=>({id:i,venue_id:i===0?'K02':'K01',name:`Pocket ${i}`})), venue_slots: [{venue_id:'K01',model:'QUEEN',quantity:2},{venue_id:'K02',model:'JACK',quantity:3},{venue_id:'K01',model:'MARIM TOUCH',quantity:1},{venue_id:'K03',model:'JACK',quantity:9}] }));
  assert.deepEqual(report.map(v=>v.id), ['K01','K02']);
  assert.equal(report.flatMap(v=>v.machines).length,7);
  assert.deepEqual(report[0].slots, [{model:'QUEEN 1',quantity:2},{model:'MARIK TOUCH',quantity:1}]);
  assert.deepEqual(report[1].slots, [{model:'JACK',quantity:3}]);
});
test('Parco slot: alias, somma, ordine e zero escluso senza modificare i dati', () => {
  const rows = [{model:'queen i',quantity:2},{model:'QUEEN 1',quantity:3},{model:'JACK',quantity:0},{model:'MARIM TOUCH',quantity:1}];
  assert.deepEqual(normalizeReportSlots(rows), [{model:'QUEEN 1',quantity:5},{model:'MARIK TOUCH',quantity:1}]);
  assert.equal(rows[0].model, 'queen i');
  assert.deepEqual(normalizeReportSlots(), []);
  assert.throws(() => normalizeReportSlots([{model:'JACK',quantity:'errato'}]), /non validi/);
});
test('Slot paginate usando la chiave composta, non una colonna id inesistente', async () => {
  const orders = [];
  const mock = client({venue_slots: [{venue_id:'K01',model:'JACK',quantity:1}]});
  const from = mock.from;
  mock.from = table => { const query = from(table); query.order = column => { orders.push(column); return query; }; return query; };
  await readAllReportRows(mock, 'venue_slots', '*', ['venue_id', 'model']);
  assert.deepEqual(orders, ['venue_id', 'model']);
});
test('Errore su pagina successiva blocca il report incompleto', async () => {
  await assert.rejects(readAllReportRows(client({machines:[1,2,3]},2),'machines','*'), /Errore test/);
});
