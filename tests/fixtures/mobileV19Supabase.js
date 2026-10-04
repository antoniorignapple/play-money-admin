// Isolated test data: this module is only loaded by the mobile QA Vite server.
import { supabase as accounting } from './accountingV18Supabase.js';
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
const now = `${today}T10:30:00+02:00`;
const employee = { id:'demo-agent', auth_user_id:'demo-agent', full_name:'Agente dimostrativo', email:'demo@example.test', active:true, deposit_venue_id:'D01' };
const venue = { id:'K1', name:'Locale dimostrativo con un nome lungo', active:true, code:'123456', address:'Via Esempio 10', city:'Manfredonia' };
const period = { id:'open', date_from:today.slice(0,8)+'01', date_to:today.slice(0,8)+'31', status:'open', is_active:true, title:'Periodo dimostrativo' };
const movement = { id:'demo-movement', venue_id:'K1', created_by:'demo-agent', acconto:1250, recupero:150, da_riportare:400, work_date:today, created_at:now, deleted_at:null, origine:'dipendente', note:'Nota dimostrativa' };
const count = { id:'demo-count', period_id:'open', venue_id:'K2', created_by:'demo-agent', executor_name_snapshot:employee.full_name, giro_name_snapshot:'Giro dimostrativo', giro_id:'demo-giro', conteggio_date:today, esattore:10000, debito:250, totale_finale:-479, carta:0, monete:0, uso_cassa:0 };
const datasets = {
  venues:[venue,{...venue,id:'K2',name:'Secondo locale'}], dipendenti:[employee], profiles:[],
  movements_cassa:[movement], fondo_cassa_giornaliero:[{ id:'fund',created_by:'demo-agent',work_date:today,monete:500,mezzo:'Furgone 1',km:125000,rifornimento:50,note:'Giornata dimostrativa',created_at:now }],
  conteggi_periods:[period], conteggi_admin_summary:[{period_id:'open',esattore:10000,debito:250,totale_finale:-479}], conteggi_admin_rows:[count],conteggi_tool:[count],
  giri:[{id:'demo-giro',name:'Giro dimostrativo',code:'D01',active:true,default_employee_id:'demo-agent'}],
  giro_venue_assignments:[{id:'assignment',giro_id:'demo-giro',venue_id:'K1',valid_to:null}],
  automezzi:[{id:'vehicle',name:'Furgone 1',targa:'AA123BB',active:true}],
  machines:[{id:'machine',venue_id:'K1',model:'APEX',name:'APEX',current_level:500,initial_level:500,active:true}],
  venue_slots:[{id:'slot',venue_id:'K1',model:'QUEEN 1',quantity:2}], venue_slot_notes:[{venue_id:'K1',note:'Fondo cassa slot: 500 €'}],
  machine_level_history:[], calendario_conteggi:[{data_conteggio:today}],
};
export const mobileFixture = { calls:[], authMode:typeof location !== 'undefined' ? new URLSearchParams(location.search).get('auth') || 'admin' : 'admin' };
function query(table) {
  let one=false, start=0, end=Infinity, payload, operation='read'; const filters=[];
  const result = () => {
    mobileFixture.calls.push({table,operation,payload});
    let rows = [...(datasets[table] || [])].filter(row => filters.every(test => test(row)));
    if(operation==='update') rows.forEach(row=>Object.assign(row,payload));
    if(operation==='insert') { const items=(Array.isArray(payload)?payload:[payload]).map(row=>({id:`test-${Date.now()}`,...row})); datasets[table] ||= [];datasets[table].push(...items);rows=items; }
    rows=rows.slice(start,end+1);return {data:one?rows[0]||null:rows,error:null};
  };
  const q = {
    select(){return q;},order(){return q;},limit(n){end=n-1;return q;},range(a,b){start=a;end=b;return q;},
    eq(k,v){filters.push(r=>r[k]===v);return q;},neq(k,v){filters.push(r=>r[k]!==v);return q;},is(k,v){filters.push(r=>(r[k]??null)===v);return q;},
    in(k,vs){filters.push(r=>vs.includes(r[k]));return q;},gte(k,v){filters.push(r=>r[k]>=v);return q;},lte(k,v){filters.push(r=>r[k]<=v);return q;},not(){return q;},or(){return q;},ilike(){return q;},
    single(){one=true;return q;},maybeSingle(){one=true;return q;},
    update(p){operation='update';payload=p;return q;},insert(p){operation='insert';payload=p;return q;},upsert(p){operation='insert';payload=p;return q;},delete(){operation='delete';return q;},
    then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);},
  };return q;
}
const user={id:'demo-admin',email:'admin@example.test'};
let onAuthChange;
export const supabase = {
  ...accounting,
  from:table => table in datasets ? query(table) : accounting.from(table),
  rpc:async(name,params)=> name==='is_play_money_admin_secure'?{data:mobileFixture.authMode!=='denied',error:null}:accounting.rpc(name,params),
  auth:{
    getSession:async()=>({data:{session:mobileFixture.authMode==='login'?null:{user,access_token:'isolated-test'}}}),
    getUser:async()=>({data:{user}}),onAuthStateChange:fn=>{onAuthChange=fn;return {data:{subscription:{unsubscribe(){}}}};},
    signInWithPassword:async credentials=>{mobileFixture.calls.push({auth:'signIn',credentials});return {error:['invalid','1234'].includes(credentials.password)?{message:'invalid'}:null};},
    signOut:async()=>{mobileFixture.authMode='login';onAuthChange?.('SIGNED_OUT',null);return {};},
  },
};
