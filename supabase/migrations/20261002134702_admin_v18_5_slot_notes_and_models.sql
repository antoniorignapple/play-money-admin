-- Admin 18.5: notes per venue and compatible slot model names.
-- Keep MARIM TOUCH in storage for older clients; display MARIK TOUCH in Admin.
create table if not exists public.venue_slot_notes (
  venue_id text primary key references public.venues(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.venue_slot_notes enable row level security;
drop policy if exists venue_slot_notes_admin_read on public.venue_slot_notes;
create policy venue_slot_notes_admin_read on public.venue_slot_notes
  for select to authenticated using ((select public.is_play_money_admin_secure()));
revoke all on public.venue_slot_notes from public, anon, authenticated;
grant select on public.venue_slot_notes to authenticated;
grant all on public.venue_slot_notes to service_role;

create or replace function public.set_venue_slots(p_venue_id text, p_slots jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  item jsonb;
  model_name text;
  qty integer;
  normalized jsonb := '[]'::jsonb;
  result jsonb;
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then
    raise exception 'Operazione consentita esclusivamente a un amministratore.' using errcode = '42501';
  end if;
  -- Serialize changes to the same venue, including the notes transaction.
  perform 1 from public.venues where id = p_venue_id for update;
  if not found then raise exception 'Locale non trovato.'; end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'Elenco Slot non valido.';
  end if;
  for item in select value from jsonb_array_elements(p_slots) loop
    model_name := upper(trim(coalesce(item->>'model', '')));
    model_name := case model_name
      when 'QUEEN' then 'QUEEN 1' when 'QUEEN I' then 'QUEEN 1'
      when 'QUEEN II' then 'QUEEN 2' when 'MARIK TOUCH' then 'MARIM TOUCH'
      else model_name end;
    if model_name not in ('QUEEN 1','QUEEN 2','JACK','GAMINATOR','MARIM TOUCH')
      or jsonb_typeof(item->'quantity') is distinct from 'number'
      or (item->>'quantity') !~ '^[0-9]{1,3}$' then
      raise exception 'Modello o quantità Slot non validi.';
    end if;
    qty := (item->>'quantity')::integer;
    if exists (select 1 from jsonb_array_elements(normalized) x where x->>'model' = model_name) then
      raise exception 'Lo stesso modello Slot è presente più di una volta.';
    end if;
    normalized := normalized || jsonb_build_array(jsonb_build_object('model', model_name, 'quantity', qty));
  end loop;
  delete from public.venue_slots where venue_id = p_venue_id;
  insert into public.venue_slots (venue_id, model, quantity, updated_at, updated_by)
    select p_venue_id, x.model, x.quantity, now(), auth.uid()
    from jsonb_to_recordset(normalized) as x(model text, quantity integer)
    where x.quantity > 0;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.model), '[]'::jsonb) into result
    from public.venue_slots s where s.venue_id = p_venue_id;
  return result;
end;
$$;
revoke all on function public.set_venue_slots(text, jsonb) from public, anon, authenticated;
grant execute on function public.set_venue_slots(text, jsonb) to authenticated, service_role;

-- A single RPC commits quantities and the note together, or neither.
create or replace function public.set_venue_slot_configuration(p_venue_id text, p_slots jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  saved_slots jsonb;
  clean_note text := trim(coalesce(p_note, ''));
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then
    raise exception 'Operazione consentita esclusivamente a un amministratore.' using errcode = '42501';
  end if;
  if char_length(clean_note) > 2000 then raise exception 'La nota può contenere al massimo 2000 caratteri.'; end if;
  saved_slots := public.set_venue_slots(p_venue_id, p_slots);
  insert into public.venue_slot_notes (venue_id, note, updated_at, updated_by)
    values (p_venue_id, clean_note, now(), auth.uid())
    on conflict (venue_id) do update set note = excluded.note, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return jsonb_build_object('slots', saved_slots, 'note', clean_note);
end;
$$;
revoke all on function public.set_venue_slot_configuration(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.set_venue_slot_configuration(text, jsonb, text) to authenticated, service_role;
notify pgrst, 'reload schema';
