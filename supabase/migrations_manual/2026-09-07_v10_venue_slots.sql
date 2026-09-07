-- Play Money Admin v10.0
-- Slot installate per locale + salvataggio atomico.
-- Eseguire nel SQL Editor Supabase prima di usare la nuova sezione SLOT.

create table if not exists public.venue_slots (
  venue_id text not null references public.venues(id) on delete cascade,
  model text not null,
  quantity integer not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint venue_slots_pkey primary key (venue_id, model),
  constraint venue_slots_model_check check (
    model in ('QUEEN 1','QUEEN 2','JACK','GAMINATOR','MARIM TOUCH')
  ),
  constraint venue_slots_quantity_check check (quantity between 1 and 999)
);

create index if not exists venue_slots_venue_id_idx
  on public.venue_slots(venue_id);

alter table public.venue_slots enable row level security;

drop policy if exists venue_slots_read on public.venue_slots;
create policy venue_slots_read
  on public.venue_slots
  for select
  to authenticated
  using (true);

-- Le scritture passano esclusivamente dalla RPC protetta set_venue_slots.
revoke insert, update, delete on table public.venue_slots from anon, authenticated;
grant select on table public.venue_slots to authenticated, service_role;

create or replace function public.set_venue_slots(
  p_venue_id text,
  p_slots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then
    raise exception 'Operazione consentita esclusivamente a un amministratore.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.venues where id::text = p_venue_id
  ) then
    raise exception 'Locale non trovato.';
  end if;

  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'Elenco Slot non valido.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_slots) as x(model text, quantity integer)
    where upper(trim(coalesce(x.model, ''))) not in (
      'QUEEN 1','QUEEN 2','JACK','GAMINATOR','MARIM TOUCH'
    )
       or x.quantity is null
       or x.quantity < 1
       or x.quantity > 999
  ) then
    raise exception 'Modello o quantità Slot non validi.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_slots) as x(model text, quantity integer)
    group by upper(trim(x.model))
    having count(*) > 1
  ) then
    raise exception 'Lo stesso modello Slot è presente più di una volta.';
  end if;

  -- DELETE + INSERT avvengono nella stessa transazione della funzione:
  -- in caso di errore il precedente stato resta intatto.
  delete from public.venue_slots
  where venue_id::text = p_venue_id;

  insert into public.venue_slots (
    venue_id,
    model,
    quantity,
    updated_at,
    updated_by
  )
  select
    p_venue_id,
    upper(trim(x.model)),
    x.quantity,
    now(),
    auth.uid()
  from jsonb_to_recordset(p_slots) as x(model text, quantity integer);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'venue_id', s.venue_id,
        'model', s.model,
        'quantity', s.quantity,
        'updated_at', s.updated_at,
        'updated_by', s.updated_by
      ) order by s.model
    ),
    '[]'::jsonb
  )
  into result
  from public.venue_slots s
  where s.venue_id::text = p_venue_id;

  return result;
end;
$$;

revoke all on function public.set_venue_slots(text, jsonb) from public, anon, authenticated;
grant execute on function public.set_venue_slots(text, jsonb) to authenticated, service_role;

-- Aggiorna anche l'anteprima/cancellazione definitiva del locale
-- includendo le Slot installate nel conteggio e nella rimozione atomica.
create or replace function public.preview_venue_deletion(p_venue_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb := '{}'::jsonb;
  t_name text;
  row_count bigint;
  machine_count bigint := 0;
  history_count bigint := 0;
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then
    raise exception 'Operazione consentita esclusivamente a un amministratore.'
      using errcode = '42501';
  end if;
  if upper(p_venue_id) in ('D01','D02','D03','D04','D05') then
    raise exception 'I locali deposito D01-D05 sono protetti.';
  end if;
  if not exists (select 1 from public.venues where id::text = p_venue_id) then
    raise exception 'Locale non trovato.';
  end if;

  select count(*) into machine_count from public.machines where venue_id::text = p_venue_id;
  if to_regclass('public.machine_level_history') is not null then
    execute 'select count(*) from public.machine_level_history h where h.machine_id in (select id from public.machines where venue_id::text = $1)'
      into history_count using p_venue_id;
  end if;
  result := result || jsonb_build_object('machines', machine_count, 'change_reports', history_count);

  foreach t_name in array array[
    'venue_slots','movements_cassa','conteggi_tool','conteggi_admin_rows','calendario_conteggi','giro_venue_assignments','change_favorites','codici_favorites',
    'debiti_movimenti','bonus_movimenti','debiti','bonus','note_generiche','simulazioni','simulazioni_richieste'
  ] loop
    if to_regclass('public.' || t_name) is not null and exists (
      select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=t_name and c.column_name='venue_id'
    ) then
      execute format('select count(*) from public.%I where venue_id::text = $1', t_name) into row_count using p_venue_id;
      result := result || jsonb_build_object(t_name, row_count);
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.delete_venue_permanently(p_venue_id text, p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t_name text;
  deleted_count bigint := 0;
  affected bigint;
  is_admin boolean := false;
begin
  select auth.uid() is not null and public.is_play_money_admin_secure() into is_admin;
  if not is_admin then
    raise exception 'Operazione consentita esclusivamente a un amministratore.'
      using errcode = '42501';
  end if;
  if upper(p_venue_id) in ('D01','D02','D03','D04','D05') then raise exception 'I locali deposito D01-D05 sono protetti.'; end if;
  if p_confirmation is distinct from p_venue_id then raise exception 'Conferma non valida.'; end if;
  if not exists (select 1 from public.venues where id::text = p_venue_id) then raise exception 'Locale non trovato.'; end if;

  if to_regclass('public.machine_level_history') is not null then
    execute 'delete from public.machine_level_history h where h.machine_id in (select id from public.machines where venue_id::text = $1)' using p_venue_id;
    get diagnostics affected = row_count; deleted_count := deleted_count + affected;
  end if;

  foreach t_name in array array[
    'venue_slots','debiti_movimenti','bonus_movimenti','change_favorites','codici_favorites','giro_venue_assignments',
    'movements_cassa','conteggi_tool','conteggi_admin_rows','calendario_conteggi','simulazioni_richieste','simulazioni','note_generiche','debiti','bonus'
  ] loop
    if to_regclass('public.' || t_name) is not null and exists (
      select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=t_name and c.column_name='venue_id'
    ) then
      execute format('delete from public.%I where venue_id::text = $1', t_name) using p_venue_id;
      get diagnostics affected = row_count; deleted_count := deleted_count + affected;
    end if;
  end loop;

  delete from public.machines where venue_id::text = p_venue_id;
  get diagnostics affected = row_count; deleted_count := deleted_count + affected;
  delete from public.venues where id::text = p_venue_id;
  get diagnostics affected = row_count; deleted_count := deleted_count + affected;

  return jsonb_build_object('venue_id', p_venue_id, 'deleted_rows', deleted_count, 'deleted', true);
end;
$$;

revoke all on function public.preview_venue_deletion(text) from public, anon, authenticated;
revoke all on function public.delete_venue_permanently(text,text) from public, anon, authenticated;
grant execute on function public.preview_venue_deletion(text) to authenticated, service_role;
grant execute on function public.delete_venue_permanently(text,text) to authenticated, service_role;
