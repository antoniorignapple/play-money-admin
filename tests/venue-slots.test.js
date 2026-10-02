import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-0000-0000-000000000001';
const U = '00000000-0000-0000-0000-000000000002';
const migration = fs.readFileSync(new URL('../supabase/migrations/20261002134702_admin_v18_5_slot_notes_and_models.sql', import.meta.url), 'utf8');
test('Slot e note: regressione cambio modelli, compatibilità, atomicità e permessi', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function public.is_play_money_admin_secure() returns boolean language sql stable as $$select coalesce(auth.uid()='${A}'::uuid,false)$$;
      create table public.venues(id text primary key);
      create table public.venue_slots(venue_id text references venues(id) on delete cascade,model text check(model in ('QUEEN 1','QUEEN 2','JACK','GAMINATOR','MARIM TOUCH')),quantity integer check(quantity between 1 and 999),updated_at timestamptz,updated_by uuid,primary key(venue_id,model));
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
      grant select on venues,venue_slots to authenticated;
      insert into venues values('K01'),('K02');
      insert into venue_slots values('K01','QUEEN 1',8,now(),'${A}');`);
    await db.exec(migration);
    await db.exec(migration); // Idempotent upgrade.
    const user = id => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    const save = (venue, slots, note) => db.query('select public.set_venue_slot_configuration($1,$2::jsonb,$3) result', [venue, JSON.stringify(slots), note]);
    const state = async () => (await db.query("select jsonb_build_object('slots',(select jsonb_agg(to_jsonb(s) order by model) from venue_slots s where venue_id='K01'),'note',(select note from venue_slot_notes where venue_id='K01')) data")).rows[0].data;
    await user(A);
    const result = (await save('K01', [{model:'QUEEN 1',quantity:7},{model:'MARIK TOUCH',quantity:1},{model:'QUEEN 2',quantity:0}], ' Fondo cassa 500 € per slot\nVerificare al conteggio. ')).rows[0].result;
    assert.deepEqual(result.slots.map(({model,quantity})=>({model,quantity})), [{model:'MARIM TOUCH',quantity:1},{model:'QUEEN 1',quantity:7}]);
    assert.equal(result.note, 'Fondo cassa 500 € per slot\nVerificare al conteggio.');
    const snapshot = await state();
    for (const slots of [
      [{model:'MARIK TOUCH',quantity:1},{model:'MARIM TOUCH',quantity:1}],
      [{model:'JACK',quantity:1.5}], [{model:'JACK',quantity:1000}],
      [{model:'JACK',quantity:-1}], [{model:'JACK',quantity:null}],
      [{model:'NON ESISTE',quantity:1}],
    ]) {
      await assert.rejects(save('K01', slots, 'Non deve salvare'));
      assert.deepEqual(await state(), snapshot);
    }
    await assert.rejects(save('K01', [], 'a'.repeat(2001)), /2000/);
    assert.deepEqual(await state(), snapshot);
    await save('K02', [{model:'MARIM TOUCH',quantity:2}], 'Fondo cassa 700 €');
    assert.deepEqual(await state(), snapshot); // Notes stay attached to the venue.
    await db.query('select set_venue_slots($1,$2::jsonb)', ['K01', JSON.stringify([{model:'MARIM TOUCH',quantity:2}])]);
    assert.equal((await state()).note, snapshot.note); // Older callers preserve the note.
    await db.exec('set role authenticated');
    await user(U);
    await assert.rejects(save('K01', [], 'Non consentito'), /amministratore/);
    assert.equal((await db.query('select * from venue_slot_notes')).rows.length, 0);
    await assert.rejects(db.query("insert into venue_slot_notes(venue_id,note) values('K01','Non consentito')"), /permission denied/);
    await user(A);
    assert.equal((await db.query('select * from venue_slot_notes')).rows.length, 2);
    await save('K01', [], ''); // Clear all slots and clear note deliberately.
    assert.deepEqual((await db.query("select * from venue_slots where venue_id='K01'")).rows, []);
    assert.equal((await db.query("select note from venue_slot_notes where venue_id='K01'")).rows[0].note, '');
    await db.exec('reset role; set role anon');
    await assert.rejects(save('K01', [], ''), /permission denied/);
    await db.exec('reset role');
    await db.query("delete from venues where id='K02'");
    assert.equal((await db.query("select * from venue_slot_notes where venue_id='K02'")).rows.length, 0);
  } finally { await db.close(); }
});
