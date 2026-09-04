begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.venue_deletion_audit (
  id bigint generated always as identity primary key,
  venue_id text not null,
  action text not null check (action in ('previewed', 'deleted')),
  actor_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
revoke all on table private.venue_deletion_audit from public, anon, authenticated;

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
    raise exception 'Operazione consentita esclusivamente a un amministratore.' using errcode = '42501';
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
    'movements_cassa','conteggi_tool','conteggi_admin_rows','calendario_conteggi','giro_venue_assignments',
    'change_favorites','codici_favorites','debiti_movimenti','bonus_movimenti','debiti','bonus',
    'note_generiche','simulazioni','simulazioni_richieste'
  ] loop
    if to_regclass('public.' || t_name) is not null and exists (
      select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name=t_name and c.column_name='venue_id'
    ) then
      execute format('select count(*) from public.%I where venue_id::text = $1', t_name)
        into row_count using p_venue_id;
      result := result || jsonb_build_object(t_name, row_count);
    end if;
  end loop;

  insert into private.venue_deletion_audit(venue_id, action, actor_id, details)
  values (p_venue_id, 'previewed', auth.uid(), result);
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
  result jsonb;
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then
    raise exception 'Operazione consentita esclusivamente a un amministratore.' using errcode = '42501';
  end if;
  if upper(p_venue_id) in ('D01','D02','D03','D04','D05') then
    raise exception 'I locali deposito D01-D05 sono protetti.';
  end if;
  if p_confirmation is distinct from p_venue_id then raise exception 'Conferma non valida.'; end if;
  if not exists (select 1 from public.venues where id::text = p_venue_id) then
    raise exception 'Locale non trovato.';
  end if;

  if to_regclass('public.machine_level_history') is not null then
    execute 'delete from public.machine_level_history h where h.machine_id in (select id from public.machines where venue_id::text = $1)' using p_venue_id;
    get diagnostics affected = row_count; deleted_count := deleted_count + affected;
  end if;

  foreach t_name in array array[
    'debiti_movimenti','bonus_movimenti','change_favorites','codici_favorites','giro_venue_assignments',
    'movements_cassa','conteggi_tool','conteggi_admin_rows','calendario_conteggi',
    'simulazioni_richieste','simulazioni','note_generiche','debiti','bonus'
  ] loop
    if to_regclass('public.' || t_name) is not null and exists (
      select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name=t_name and c.column_name='venue_id'
    ) then
      execute format('delete from public.%I where venue_id::text = $1', t_name) using p_venue_id;
      get diagnostics affected = row_count; deleted_count := deleted_count + affected;
    end if;
  end loop;

  delete from public.machines where venue_id::text = p_venue_id;
  get diagnostics affected = row_count; deleted_count := deleted_count + affected;
  delete from public.venues where id::text = p_venue_id;
  get diagnostics affected = row_count; deleted_count := deleted_count + affected;

  result := jsonb_build_object('venue_id', p_venue_id, 'deleted_rows', deleted_count, 'deleted', true);
  insert into private.venue_deletion_audit(venue_id, action, actor_id, details)
  values (p_venue_id, 'deleted', auth.uid(), result);
  return result;
end;
$$;

revoke all on function public.preview_venue_deletion(text) from public, anon, authenticated;
revoke all on function public.delete_venue_permanently(text,text) from public, anon, authenticated;
grant execute on function public.preview_venue_deletion(text) to authenticated, service_role;
grant execute on function public.delete_venue_permanently(text,text) to authenticated, service_role;

commit;
