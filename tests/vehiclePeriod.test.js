import test from 'node:test';
import assert from 'node:assert/strict';
import { currentMonthRange, vehicleDistance, inDateRange, odometer } from '../src/lib/vehiclePeriod.js';
const range = { from: '2026-09-01', to: '2026-09-30' };
const row = (date, km) => ({ work_date: date, km });
test('Mese corrente: Roma, mesi corti, bisestile e cambio anno', () => {
  assert.deepEqual(currentMonthRange('2026-08-31T22:30:00Z'), range);
  assert.equal(currentMonthRange('2024-02-15').to, '2024-02-29');
  assert.equal(currentMonthRange('2026-02-15').to, '2026-02-28');
  assert.equal(currentMonthRange('2026-12-15').to, '2026-12-31');
});
test('Solo letture nel range: letture esterne escluse anche se molto distanti', () => {
  const result = vehicleDistance([row('2026-08-29', 950), row('2026-08-31', 1000), row('2026-09-01', 1080), row('2026-09-16', 1450), row('2026-10-01', 2000)], range);
  assert.equal(result.km, 370); assert.equal(result.status, 'complete');
  assert.deepEqual(result.start, { date: '2026-09-01', km: 1080 });
  assert.deepEqual(result.end, { date: '2026-09-16', km: 1450 });
});
test('Regressione Caddy FK634HC: foto 10–29 agosto = 1630 km, non 5855', () => {
  const readings = [[10,367007],[11,367086],[12,367171],[13,367250],[14,367339],[17,367422],[18,367488],[19,367555],[21,367985],[22,368087],[24,368088],[25,368166],[26,368293],[27,368426],[28,368530],[29,368637]];
  // Hypothetical prior reading reproduces the old 5855 result; it must be ignored.
  const rows = [row('2026-07-31',362782), ...readings.map(([day,km]) => row(`2026-08-${day}`,km))];
  const result = vehicleDistance(rows.reverse(), { from: '2026-08-01', to: '2026-08-31' });
  assert.equal(result.km,1630); assert.equal(result.status,'complete');
  assert.equal(vehicleDistance(rows,{from:'2026-08-24',to:'2026-08-29'}).km,549);
});
test('Letture mancanti, un solo utilizzo e anomalie dentro/fuori range', () => {
  assert.equal(vehicleDistance([row('2026-09-01', 1000), row('2026-09-03', 1300)], range).status, 'complete');
  assert.equal(vehicleDistance([row('2026-09-01', 1000)], range).km, null);
  assert.equal(vehicleDistance([row('2026-08-31', 1000), row('2026-09-01', 1300)], range).km, null);
  assert.equal(vehicleDistance([row('2026-09-01', 1000), row('2026-09-02', 900)], range).status, 'anomaly');
  assert.equal(vehicleDistance([row('2026-08-31', 999999), row('2026-09-01', 1000), row('2026-09-02',1100)], range).km,100);
  assert.equal(vehicleDistance([row('2026-09-01', '')], range).status, 'missing');
  assert.equal(vehicleDistance([], range).km, 0);
  assert.equal(vehicleDistance([row('2026-09-01', 1000), row('2026-09-02', ''), row('2026-09-03', 1200)], range).status, 'partial');
  assert.equal(vehicleDistance([row('2026-09-01', 1000), row('2026-09-02', 1000)], range).km,0);
});
test('Range inclusivo e letture legacy italiane', () => {
  assert.equal(inDateRange(row('2026-09-30', 0), range), true);
  assert.equal(inDateRange(row('2026-08-31', 0), range), false);
  assert.equal(inDateRange(row('2026-09-30', 0), { from: '2026-10-01', to: '2026-09-01' }), false);
  assert.equal(odometer('370.940'), 370940); assert.equal(odometer('0'), 0); assert.equal(odometer(''), null);
});

test('Caddy FX045RR: zero intermedio ignorato, 1460 km come nelle foto', () => {
  const readings = [[10,363091],[11,363174],[12,363272],[13,363275],[22,363722],[24,363815],[25,363879],[26,363959],[27,364036],[29,0],[31,364551]];
  const result = vehicleDistance(readings.map(([day,km]) => row(`2026-08-${day}`,km)).reverse(), {from:'2026-08-01',to:'2026-08-31'});
  assert.equal(result.km,1460); assert.equal(result.status,'partial');
  assert.deepEqual(result.start,{date:'2026-08-10',km:363091});
  assert.deepEqual(result.end,{date:'2026-08-31',km:364551});
});
test('Zeri e vuoti anche agli estremi: prima e ultima lettura positiva nel range', () => {
  const result=vehicleDistance([row('2026-08-31',900),row('2026-09-01',0),row('2026-09-02',''),row('2026-09-03',1000),row('2026-09-05','0'),row('2026-09-10',null),row('2026-09-20',1400),row('2026-09-30',0),row('2026-10-01',2000)],range);
  assert.equal(result.km,400); assert.equal(result.start.date,'2026-09-03'); assert.equal(result.end.date,'2026-09-20');
  assert.equal(vehicleDistance([row('2026-09-01',0),row('2026-09-02','')],range).status,'missing');
  assert.equal(vehicleDistance([row('2026-09-01',0),row('2026-09-02',1000),row('2026-09-03',0)],range).km,null);
  assert.equal(vehicleDistance([row('2026-09-01',1000),row('2026-09-02',0),row('2026-09-03',900)],range).status,'anomaly');
});
