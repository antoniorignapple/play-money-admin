import test from 'node:test';
import assert from 'node:assert/strict';
import {getRomeISODate,shiftDateKey,firstDayOfRomeMonth} from '../src/lib/dates.js';
test('mezzanotte italiana, estate e inverno',()=>{
  assert.equal(getRomeISODate('2026-09-04T22:30:00Z'),'2026-09-05');
  assert.equal(getRomeISODate('2026-12-31T23:30:00Z'),'2027-01-01');
});
test('primo mese e date già calendariali',()=>{
  assert.equal(firstDayOfRomeMonth('2026-09-05T08:00:00Z'),'2026-09-01');
  assert.equal(getRomeISODate('2026-09-05'),'2026-09-05');
});
test('cambio ora legale e calendario non dipendono dal fuso macchina',()=>{
  assert.equal(getRomeISODate('2026-03-29T01:30:00Z'),'2026-03-29');
  assert.equal(getRomeISODate('2026-10-25T01:30:00Z'),'2026-10-25');
  assert.equal(shiftDateKey('2026-03-30',-1),'2026-03-29');
  assert.equal(shiftDateKey('2026-01-01',-1),'2025-12-31');
  assert.equal(shiftDateKey('2028-03-01',-1),'2028-02-29');
});
