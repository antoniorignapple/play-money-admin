process.chdir(import.meta.dirname);
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
const A = "00000000-0000-0000-0000-000000000001",
  U = "00000000-0000-0000-0000-000000000002",
  V = "00000000-0000-0000-0000-000000000003",
  G = "10000000-0000-0000-0000-000000000001",
  P = "20000000-0000-0000-0000-000000000001",
  C = "30000000-0000-0000-0000-000000000001";
let fixture = `create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function public.is_play_money_admin_secure() returns boolean language sql stable as $$select auth.uid()='${A}'::uuid$$;
create table conteggi_periods(id uuid primary key,date_from date,date_to date,status text,is_active boolean);
create table dipendenti(id uuid primary key,auth_user_id uuid,full_name text,active boolean default true,email text);
create table venues(id text primary key,name text,city text,code text,active boolean default true);
create table giri(id uuid primary key,name text,active boolean,default_employee_id uuid,sort_order integer);
create table giro_venue_assignments(id uuid default gen_random_uuid(),giro_id uuid,venue_id text,valid_to date);
create table conteggi_tool(id uuid primary key,venue_id text,giro_id uuid,executed_by uuid,user_id uuid,conteggio_date date,period_id uuid,locked boolean default false,created_at timestamptz default now(),esattore numeric default 0,acconti numeric default 0,carta numeric default 0,monete numeric default 0,riporto numeric default 0,uso_cassa numeric default 0,debito numeric default 0,debito_virt numeric default 0,assegno numeric default 0,bonus numeric default 0,rp_day2 numeric default 0,rp_day3 numeric default 0,rp_day4 numeric default 0,totale_finale numeric default 0,updated_at timestamptz default now(),giro_name_snapshot text,executor_name_snapshot text);
create table movements_cassa(id uuid primary key default gen_random_uuid(),client_id text unique,work_date date,venue_id text,giro_id uuid,executed_by uuid,acconto numeric,recupero numeric,da_riportare numeric,note text,created_by uuid,origine text,source_conteggio_id uuid,source_period_id uuid,deleted_at timestamptz);
create table debiti(id uuid primary key,venue_id text,status text,modalita text,residuo numeric,updated_at timestamptz);
create table debiti_movimenti(id uuid default gen_random_uuid(),debito_id uuid,venue_id text,data date,user_id uuid,operator_name text,importo numeric,residuo_prima numeric,residuo_dopo numeric,origine text,conteggio_id uuid);
create table bonus(id uuid primary key,venue_id text,status text);
create table bonus_movimenti(id uuid default gen_random_uuid(),bonus_id uuid,venue_id text,data date,user_id uuid,operator_name text,importo numeric,origine text,conteggio_id uuid);
create table simulazioni(id uuid primary key,venue_id text,venue_name text,work_date date,user_id uuid,created_by uuid,operator_name text,utile_lordo numeric,acconti numeric,carta numeric,monete numeric,da_riportare numeric,da_riportare_sospeso numeric,total numeric,note text);
create table automezzi(id uuid primary key,name text,plate text,active boolean);
create table fondo_cassa_giornaliero(id uuid primary key,work_date date,created_by uuid,vehicle_id uuid,vehicle_name_snapshot text,vehicle_plate_snapshot text,mezzo text,km text,rifornimento numeric);
create table machines(id uuid primary key,name text,level numeric,fondo numeric,active boolean);
create function attach_conteggio_period() returns trigger language plpgsql as $$begin return new;end$$;
create function guard_conteggio_giro() returns trigger language plpgsql as $$begin return new;end$$;
create trigger trg_attach before insert or update on conteggi_tool for each row execute function attach_conteggio_period();
create trigger trg_giro before insert or update of giro_id,venue_id,executed_by on conteggi_tool for each row execute function guard_conteggio_giro();
grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;grant select,insert,update,delete on all tables in schema public to authenticated;
insert into conteggi_periods values('${P}','2026-09-01','2026-09-15','open',true),('20000000-0000-0000-0000-000000000002','2026-08-16','2026-08-31','closed',false);
insert into dipendenti(id,auth_user_id,full_name) values('${A}','${A}','Admin'),('${U}','${U}','Uno'),('${V}','${V}','Due');
insert into venues(id,name) values('K01','Locale Uno'),('K02','Locale Due');
insert into giri values('${G}','Giro Uno',true,'${U}',1);
insert into giro_venue_assignments(giro_id,venue_id) values('${G}','K01');
insert into conteggi_tool(id,venue_id,giro_id,executed_by,user_id,conteggio_date,period_id,esattore,acconti,carta,riporto,totale_finale) values('${C}','K01','${G}','${U}','${U}','2026-09-10','${P}',1000,500,400,100,0);`;
if (process.argv.includes("--generated"))
  fixture = fixture
    .replace(
      "totale_finale numeric default 0",
      "totale_finale numeric generated always as (acconti+carta+monete+riporto+assegno-esattore-uso_cassa-debito) stored",
    )
    .replace("riporto,totale_finale) values", "riporto) values")
    .replace("400,100,0);", "400,100);");
await db.exec(fixture);
const sql = fs.readFileSync(
  "../../supabase/migrations/" +
    fs.readdirSync("../../supabase/migrations").find((f) => f.includes("v11")),
  "utf8",
);
await db.exec(sql);
await db.exec(sql);
const get = async () =>
  (await db.query("select to_jsonb(c) r from conteggi_tool c where id=$1", [C]))
    .rows[0].r;
const user = async (id) =>
  db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
const edit = async (patch, expected) =>
  (
    await db.query("select admin_v11_edit_conteggio($1,$2,$3,$4) r", [
      C,
      expected ?? (await get()),
      patch,
      "Correzione di verifica",
    ])
  ).rows[0].r;
const generic = async (table, id, patch, expected) =>
  (
    await db.query("select admin_v11_edit_record($1,$2,$3,$4,$5) r", [
      table,
      id,
      expected ??
        (
          await db.query(
            `select to_jsonb(t) r from ${table} t where id::text=$1`,
            [id],
          )
        ).rows[0].r,
      patch,
      "Correzione di verifica",
    ])
  ).rows[0].r;
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
await user(A);
await db.exec("set role authenticated");
await test("ricalcolo e attribuzione separata dal giro", async () => {
  const r = await edit({ carta: 425, executed_by: V });
  assert.equal(r.row.totale_finale, 25);
  assert.equal(r.row.user_id, V);
  assert.equal(r.row.giro_id, G);
});
await test("un solo audit prima/dopo", async () => {
  const a = (
    await db.query("select admin_v11_history($1,$2) h", ["conteggi_tool", C])
  ).rows[0].h;
  assert.equal(a.length, 1);
  assert.equal(a[0].after_data.totale_finale, 25);
});
await test("conflitto concorrente", async () => {
  const old = await get();
  await edit({ monete: 10 });
  await assert.rejects(edit({ monete: 20 }, old), /altro dispositivo/);
});
await test("validazione importi e whitelist", async () => {
  await assert.rejects(edit({ carta: 0.5 }), /Importo/);
  await assert.rejects(edit({ user_id: A }), /Campo/);
  await assert.rejects(edit({ rp_day2: -1 }), /negativo/);
});
await test("data fuori periodo", async () => {
  await assert.rejects(edit({ conteggio_date: "2020-01-01" }), /Data fuori/);
});
await test("recuperi mantengono totale", async () => {
  const old = await get();
  const r = await edit({
    rp_day2: 30,
    carta: old.carta + 30,
    riporto: old.riporto - 30,
  });
  assert.equal(r.row.totale_finale, old.totale_finale);
});
await test("dipendente non autorizzato e audit privato", async () => {
  await user(U);
  await assert.rejects(edit({ carta: 500 }), /riservata/);
  await assert.rejects(
    db.query("select admin_v11_history($1,$2)", ["conteggi_tool", C]),
    /riservat/,
  );
  await assert.rejects(
    db.query("select * from private.admin_v11_audit"),
    /permission denied/,
  );
  await user(A);
});
await test("periodo chiuso crea e aggiorna un solo riporto", async () => {
  await edit({ conteggio_date: "2026-08-30" });
  await edit({ riporto: 80 });
  const m = (
    await db.query(
      "select * from movements_cassa where source_conteggio_id=$1",
      [C],
    )
  ).rows;
  assert.equal(m.length, 1);
  assert.equal(Number(m[0].da_riportare), 80);
});
await test("riporto derivato protetto nel centro modifiche", async () => {
  const m = (
    await db.query(
      "select * from movements_cassa where source_conteggio_id=$1",
      [C],
    )
  ).rows[0];
  await assert.rejects(
    generic("movements_cassa", m.id, { da_riportare: 10 }),
    /conteggio originale/,
  );
});
await test("spostamento periodo con riporto: rollback", async () => {
  const old = await get();
  await assert.rejects(
    edit({ conteggio_date: "2026-09-10" }),
    /riporto trasferito/,
  );
  assert.deepEqual(await get(), old);
});
await test("debito rettificato senza doppia decurtazione", async () => {
  await db.exec(
    "insert into debiti values('40000000-0000-0000-0000-000000000001','K01','attivo','contanti',100,now())",
  );
  await edit({ debito: 20 });
  await edit({ debito: 30 });
  assert.equal(
    Number((await db.query("select residuo from debiti")).rows[0].residuo),
    70,
  );
  assert.equal(
    (await db.query("select count(*) n from debiti_movimenti")).rows[0].n,
    1,
  );
});
await test("debito eccessivo: rollback completo", async () => {
  const old = await get();
  await assert.rejects(edit({ debito: 999 }), /residuo/);
  assert.deepEqual(await get(), old);
});
await test("bonus rettificato senza duplicati", async () => {
  await db.exec(
    "insert into bonus values('50000000-0000-0000-0000-000000000001','K01','attivo')",
  );
  await edit({ bonus: 10 });
  await edit({ bonus: 20 });
  assert.equal(
    (await db.query("select count(*) n from bonus_movimenti")).rows[0].n,
    1,
  );
  assert.equal(
    Number(
      (await db.query("select importo from bonus_movimenti")).rows[0].importo,
    ),
    20,
  );
});
await test("azzeramento ripristina il residuo", async () => {
  await edit({ debito: 0 });
  assert.equal(
    Number((await db.query("select residuo from debiti")).rows[0].residuo),
    100,
  );
});
await test("vecchio salvataggio offline rifiutato", async () => {
  await user(U);
  await assert.rejects(
    db.query("update conteggi_tool set carta=1,updated_at=$1 where id=$2", [
      "2020-01-01",
      C,
    ]),
    /rettificato/,
  );
  await user(A);
});
await test("blocco dipendente", async () => {
  await edit({ locked: true });
  await user(U);
  await assert.rejects(
    db.query(
      "update conteggi_tool set carta=1,updated_at=clock_timestamp() where id=$1",
      [C],
    ),
    /bloccato/,
  );
  await user(A);
  await edit({ locked: false });
});
await test("centro modifiche whitelist e concorrenza", async () => {
  await generic("venues", "K01", { name: "Locale Corretto" });
  await assert.rejects(
    generic("dipendenti", U, { role: "admin" }),
    /non autorizzato/,
  );
  await assert.rejects(
    generic("venues", "K01", { name: "Altro" }, { id: "K01", name: "Vecchio" }),
    /Dati cambiati/,
  );
});
await test("simulazione ricalcolata e riassegnata", async () => {
  const id = "60000000-0000-0000-0000-000000000001";
  await db.query(
    "insert into simulazioni(id,venue_id,user_id,utile_lordo,acconti,carta,monete,da_riportare,da_riportare_sospeso) values($1,$2,$3,100,50,30,20,10,0)",
    [id, "K01", U],
  );
  await generic("simulazioni", id, { carta: 50, user_id: V });
  const r = (await db.query("select * from simulazioni where id=$1", [id]))
    .rows[0];
  assert.equal(Number(r.total), 30);
  assert.equal(r.operator_name, "Due");
  assert.equal(r.created_by, V);
});
await test("anonimo non può eseguire RPC", async () => {
  await db.exec("reset role;set role anon");
  await assert.rejects(
    db.query("select admin_v11_history($1,$2)", ["conteggi_tool", C]),
    /permission denied/,
  );
  await db.exec("reset role");
});
console.log(
  `${passed} database tests passed: PostgreSQL PGlite fixture, not production schema`,
);
await db.close();
