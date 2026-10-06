import { supabase as base } from './mobileV19Supabase.js';
export const ledgerFixture={calls:[]};
const date='2026-09-10';
const debt={id:'debt-qa',venue_id:'K1',importo_originario:1000,importo_iniziale:1500,residuo:1400,data_erogazione:'2026-09-01',created_at:'2026-09-01T10:00:00Z',updated_at:'2026-09-10T10:00:00Z',status:'attivo',modalita:'bonifico'};
const tables={debiti:[debt],debiti_erogazioni:[{id:'e-qa',debito_id:debt.id,data:date,importo:500,created_at:date+'T10:00:00Z'}],debiti_movimenti:[{id:'r-qa',debito_id:debt.id,data:date,importo:100,origine:'manuale',created_at:date+'T11:00:00Z'}],bonus:[],note_generiche:[]};
function query(table){let single=false;let from=0,to=Infinity;const filters=[];const q={select(){return q;},order(){return q;},range(a,b){from=a;to=b;return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},single(){single=true;return q;},then(resolve,reject){const rows=tables[table].filter(r=>filters.every(fn=>fn(r))).slice(from,to+1);return Promise.resolve({data:structuredClone(single?rows[0]:rows),error:null}).then(resolve,reject);}};return q;}
export const supabase={...base,from:table=>table in tables?query(table):base.from(table),rpc:async(name,p)=>{
 if(name!=='admin_v19_7_debt_movement')return base.rpc(name,p);
 ledgerFixture.calls.push(structuredClone(p));
 const rows=p.p_kind==='disbursement'?tables.debiti_erogazioni:tables.debiti_movimenti;
 const row=rows.find(r=>r.id===p.p_movement);
 const old=p.p_kind==='initial'?debt.importo_originario:row.importo;
 const amount=p.p_delete?0:p.p_amount,delta=amount-old;
 if(p.p_kind==='repayment')debt.residuo-=delta;else{debt.importo_iniziale+=delta;debt.residuo+=delta;}
 if(p.p_kind==='initial')debt.importo_originario=amount;
 else if(p.p_delete)rows.splice(rows.indexOf(row),1);else Object.assign(row,{importo:amount,data:p.p_date});
 debt.updated_at=new Date().toISOString();return{data:structuredClone(debt),error:null};
}};
