import test from 'node:test';
import assert from 'node:assert/strict';
import { getPeriodFinale, withAutomaticShortage } from '../src/lib/conteggiAccounting.js';
import { accountingTotals } from '../src/lib/officeCash.js';
const period = { date_to: '2026-09-30' };
test('ammanco netto comprende rettifiche e depositi del proprietario, non del sostituto', () => {
  const rows = [{ id:'a', giro_id:'g', giro_name_snapshot:'QUITADAMO', operator_name:'DI BARI', totale_finale: -79, carta:1000, monete:0, uso_cassa:0, esattore:1200 },
    { id:'b', giro_id:'g', giro_name_snapshot:'QUITADAMO', totale_finale:0, carta:100, esattore:100 }];
  const finale = getPeriodFinale(rows, [{operator_name:'QUITADAMO', esattore_override:1700}], [{id:'g',name:'QUITADAMO',code:'D04'}], [], [{venue_id:'D04',acconto:1100},{venue_id:'D03',acconto:2000}]);
  assert.equal(finale,-479);
  assert.equal(withAutomaticShortage([],[],finale,period)[0].amount,479);
  assert.equal(withAutomaticShortage([],[],12,period)[0].amount,0);
});
test('debiti originali immutati: solo selezionati, zero e centesimi rispettati', () => {
  const rows=[{id:'a',debito:250,esattore:1000},{id:'b',debito:100},{id:'c',debito:500}];
  const copy=structuredClone(rows);
  const totals=accountingTotals(rows,[],['a','b'],[{amount:479}],[],{a:125.5,b:0,c:1});
  assert.equal(totals.recuperi,125.5); assert.equal(totals.globale,1125.5); assert.equal(totals.saldo,646.5);assert.deepEqual(rows,copy);
  assert.equal(accountingTotals(rows,[],['a'],[],[],{}).recuperi,250);
});
test('vecchio ammanco manuale conservato ma escluso, senza duplicazioni al refresh', () => {
  const manual=[{id:'m',description:'AMMANCO CONTEGGI',amount:479,work_date:period.date_to},{id:'x',description:'ACCONTO',amount:100,work_date:period.date_to}];
  const first=withAutomaticShortage(manual,[],-479,period);
  assert.equal(first.reduce((sum,r)=>sum+r.amount,0),579);
  assert.equal(first.find(r=>r.id==='m').originalAmount,479);
  assert.deepEqual(withAutomaticShortage(manual,[],-479,period),first);
  assert.equal(manual[0].amount,479);
});
