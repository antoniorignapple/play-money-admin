export const fixture = {
  vehicles: [{id:'one',name:'Caddy',plate:'FK634HC',active:true},{id:'two',name:'Fiorino',plate:'AB123CD',active:true}],
  records: [{id:'r1',vehicle_id:'one',km:120000,work_date:'2020-01-01',created_at:'2020-01-01T10:00:00Z'}], calls:[], fail:false,
};
export const supabase = { from(table) {
  let range;
  const q={select(){return q;},order(){return q;},range(a,b){range=[a,b];return q;},then(resolve,reject){
    fixture.calls.push(table);
    const rows=table==='automezzi'?fixture.vehicles:table==='fondo_cassa_giornaliero'?fixture.records:[];
    return Promise.resolve(fixture.fail ? {error:{message:'Errore lettura di prova'}} : {data:range?rows.slice(range[0],range[1]+1):rows,error:null}).then(resolve,reject);
  }};return q;
}};
