import { supabase as base } from './debtMovementsSupabase.js';
const rows = {
  bonus: [{ id:'bonus-search', venue_id:'K2', importo:250, periodicita:'ogni_conteggio', agent_name:'José', status:'attivo' }],
  note_generiche: [{ id:'note-search', venue_id:'K1', testo:'Fondo cassa aggiornato', status:'attiva', conteggi_totali:null }],
};
function query(table) {
  let start=0,end=Infinity;
  const q={select(){return q;},order(){return q;},range(a,b){start=a;end=b;return q;},then(resolve,reject){return Promise.resolve({data:rows[table].slice(start,end+1),error:null}).then(resolve,reject);}};
  return q;
}
export const supabase={...base,from:table => table in rows ? query(table) : base.from(table)};
