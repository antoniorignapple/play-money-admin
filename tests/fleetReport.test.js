import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFleetReport, recordMatchesVehicle } from '../src/lib/fleetReport.js';
import { generateFleetPdf } from '../src/lib/generateFleetPdf.js';
const today = '2026-10-02';
const vehicles = [{id:'one', name:'Caddy', plate:'FK634HC'}, {id:'two',name:'Fiorino',plate:'AB123CD'}, {id:'off',name:'Disattivo',active:false}];
test('solo mezzi selezionati, lettura più recente non massimo, storico fuori periodo', () => {
  const records = [{vehicle_id:'one',km:10000,work_date:'2026-08-29'}, {vehicle_id:'one',km:9000,work_date:'2026-09-30'}, {vehicle_id:'two',km:777,work_date:'2026-10-02'}];
  const rows=buildFleetReport(vehicles, records, ['one','off'], today);
  assert.equal(rows.length,1); assert.equal(rows[0].reading.km,9000); assert.equal(rows[0].reading.date,'2026-09-30');
});
test('zeri, vuoti, date future, eliminati ignorati; nessuna lettura non inventa zero', () => {
  const records=[{vehicle_id:'one',km:'12.345',work_date:'2026-09-30'}, {vehicle_id:'one',km:0,work_date:today}, {vehicle_id:'one',km:null,work_date:today}, {vehicle_id:'one',km:13000,work_date:'2026-10-03'}, {vehicle_id:'one',km:15000,work_date:today,deleted_at:today}];
  const rows=buildFleetReport(vehicles,records,['one','two'],today);
  assert.equal(rows[0].reading.km,12345); assert.equal(rows[1].reading,null);
});
test('stesso giorno: ultima registrazione; id mezzo prioritario rispetto a targa legacy', () => {
  assert.equal(recordMatchesVehicle({vehicle_id:'two',vehicle_plate_snapshot:'FK634HC'}, vehicles[0]),false);
  assert.equal(recordMatchesVehicle({mezzo:'Caddy - FK 634 HC'},vehicles[0]),true);
  const rows=buildFleetReport(vehicles,[{vehicle_id:'one',km:10,work_date:today,created_at:'2026-10-02T08:00:00Z'}, {vehicle_id:'one',km:20,work_date:today,created_at:'2026-10-02T09:00:00Z'}],['one'],today);
  assert.equal(rows[0].reading.km,20);
});
test('PDF font incorporato, selezione vuota bloccata, paginazione per liste lunghe',()=>{
  assert.throws(()=>generateFleetPdf([],today),/Seleziona/);
  const rows=Array.from({length:40},(_,i)=>({name:`MEZZO ${i}`,plate:'AB123CD',reading:{km:100000+i,date:today}}));
  const doc=generateFleetPdf(rows,today);
  assert.ok(doc.getNumberOfPages()>1); assert.equal(doc.internal.getFont().fontName,'Manrope');
});
