import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePeriodAccountingPdf, accountingText } from '../src/lib/generatePeriodAccountingPdf.js';
const period={date_from:'2026-09-17',date_to:'2026-09-30'};
const data={movements:[{destination:'sede',note:'acconto 3',workDate:'2026-09-20',amount:10},{source:'automatic',destination:'AMMANCO CONTEGGI',note:'Automatico · saldo finale dei conteggi del periodo',workDate:'2026-09-30',amount:5}],rows:[{id:'a',venue_id:'K1',debito:250,operator_name:'Rignanese',conteggio_date:'2026-09-29'},{id:'b',venue_id:'K2',debito:99}],selectedIds:['a'],debtAmounts:{a:125.5},totals:{esattore:1000,recuperi:125.5,globale:1125.5,movimenti:15,saldo:1110.5}};
test('PDF moderno: testi maiuscoli, ammanco pulito, cifra applicata e solo selezionati',()=>{
 const doc=generatePeriodAccountingPdf(data,period,{K1:'Beverly Hills',K2:'NON SELEZIONATO'});
 assert.equal(doc.getNumberOfPages(),2);
 assert.equal(doc.internal.getFont().fontName,'Manrope');
 assert.ok(doc.output('arraybuffer').byteLength>10000);
 assert.equal(accountingText('caffè sede'),'CAFFÈ SEDE');
 assert.equal(data.rows[0].debito,250);
});
test('PDF: movimenti lunghi e molti debiti passano su più pagine senza troncamenti',()=>{
 const long='NOTA MOLTO LUNGA '.repeat(180)+'FINE NOTA';
 const many={...data,movements:[{destination:'sede',note:long,workDate:'2026-09-20',amount:10}],rows:Array.from({length:60},(_,i)=>({id:String(i),venue_id:String(i),debito:100,operator_name:'Operaio',conteggio_date:'2026-09-29'})),selectedIds:Array.from({length:60},(_,i)=>String(i))};
 const doc=generatePeriodAccountingPdf(many,period);
 assert.ok(doc.getNumberOfPages()>3);
 assert.equal(many.movements[0].note,long);
});
