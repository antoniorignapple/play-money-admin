-- Play Money Admin 6.7 / Dipendenti 13.7
-- Finalizzazione atomica del periodo e trasferimento controllato dei Da Riportare.

begin;

alter table public.movements_cassa
  add column if not exists source_conteggio_id uuid null,
  add column if not exists source_period_id uuid null;

alter table public.conteggi_archive_snapshots
  add column if not exists finalization_data jsonb not null default '{}'::jsonb;

create unique index if not exists movements_cassa_finalizzazione_unique
  on public.movements_cassa (source_period_id, source_conteggio_id)
  where origine = 'chiusura_conteggio'
    and source_period_id is not null
    and source_conteggio_id is not null;

create unique index if not exists conteggi_periods_one_active_idx
  on public.conteggi_periods ((1))
  where status = 'open' and is_active = true;

alter table public.conteggi_periods
  drop constraint if exists conteggi_periods_dates_check;
alter table public.conteggi_periods
  add constraint conteggi_periods_dates_check check (date_to >= date_from) not valid;

create or replace function public.attach_conteggio_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  matched_period uuid;
  matched_count integer;
begin
  select count(*)
    into matched_count
  from public.conteggi_periods
  where new.conteggio_date between date_from and date_to
    and status = 'open'
    and is_active = true;

  if matched_count <> 1 then
    raise exception 'Nessun periodo attivo univoco per la data del conteggio';
  end if;

  select id into matched_period
  from public.conteggi_periods
  where new.conteggio_date between date_from and date_to
    and status = 'open'
    and is_active = true;

  new.period_id = matched_period;
  if new.user_id is null then new.user_id = auth.uid(); end if;

  if tg_op = 'UPDATE' and old.locked = true then
    raise exception 'Questo conteggio è bloccato e non può essere modificato';
  end if;

  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.active_conteggi_period_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.date_to < new.date_from then
    raise exception 'La data finale non può precedere la data iniziale';
  end if;

  if new.status = 'open' and new.is_active = true and exists (
    select 1 from public.conteggi_periods p
    where p.id <> new.id
      and p.status = 'open'
      and p.is_active = true
  ) then
    raise exception 'Esiste già un periodo aperto e attivo';
  end if;

  if new.status = 'open' and exists (
    select 1 from public.conteggi_periods p
    where p.id <> new.id
      and daterange(p.date_from, p.date_to, '[]') && daterange(new.date_from, new.date_to, '[]')
  ) then
    raise exception 'Le date del periodo si sovrappongono a un periodo esistente';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_active_conteggi_period_guard on public.conteggi_periods;
create trigger trg_active_conteggi_period_guard
before insert or update of date_from, date_to, status, is_active
on public.conteggi_periods
for each row execute function public.active_conteggi_period_guard();

create or replace view public.active_conteggi_period as
select id, title, date_from, date_to, status, note
from public.conteggi_periods
where status = 'open' and is_active = true
order by date_from desc
limit 1;

create or replace function public._finalizzazione_preview(p_period_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with selected_period as (
  select * from public.conteggi_periods where id = p_period_id
), employee_totals as (
  select
    d.auth_user_id,
    d.full_name,
    coalesce(sum(case when coalesce(ct.riporto, 0) > 0 then trunc(ct.riporto) else 0 end), 0) as total_da_riportare,
    count(ct.id) as conteggi_count
  from public.dipendenti d
  left join public.conteggi_tool ct
    on ct.user_id = d.auth_user_id and ct.period_id = p_period_id
  where coalesce(d.active, true) = true
    and d.role <> 'admin'
    and d.auth_user_id is not null
  group by d.auth_user_id, d.full_name
), missing_venues as (
  select v.id, v.name
  from public.venues v
  where coalesce(v.active, true) = true
    and upper(v.id) not like 'D%'
    and not exists (
      select 1 from public.conteggi_tool ct
      where ct.period_id = p_period_id and ct.venue_id = v.id
    )
), fingerprint_source as (
  select md5(jsonb_build_object(
    'period', (select jsonb_build_object('id', p.id, 'date_from', p.date_from, 'date_to', p.date_to, 'status', p.status, 'is_active', p.is_active, 'updated_at', p.updated_at) from selected_period p),
    'conteggi', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'venue_id', c.venue_id, 'riporto', c.riporto, 'updated_at', c.updated_at) order by c.id) from public.conteggi_tool c where c.period_id = p_period_id), '[]'::jsonb),
    'overrides', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'operator_name', o.operator_name, 'esattore_override', o.esattore_override, 'updated_at', o.updated_at) order by o.id) from public.conteggi_admin_overrides o where o.period_id = p_period_id), '[]'::jsonb),
    'movements', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'work_date', m.work_date, 'venue_id', m.venue_id, 'acconto', m.acconto, 'recupero', m.recupero, 'da_riportare', m.da_riportare, 'deleted_at', m.deleted_at) order by m.id) from public.movements_cassa m, selected_period p where m.work_date between p.date_from and p.date_to), '[]'::jsonb),
    'employees', coalesce((select jsonb_agg(jsonb_build_object('auth_user_id', d.auth_user_id, 'full_name', d.full_name, 'role', d.role, 'active', d.active) order by d.id) from public.dipendenti d), '[]'::jsonb),
    'venues', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'active', v.active) order by v.id) from public.venues v), '[]'::jsonb)
  )::text) as value
)
select jsonb_build_object(
  'period_id', p.id,
  'date_from', p.date_from,
  'date_to', p.date_to,
  'new_date_from', p.date_to + 1,
  'suggested_date_to', p.date_to + (p.date_to - p.date_from) + 1,
  'conteggi_count', (select count(*) from public.conteggi_tool c where c.period_id = p_period_id),
  'employee_totals', coalesce((select jsonb_agg(to_jsonb(e) order by e.full_name) from employee_totals e), '[]'::jsonb),
  'missing_venues', coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from missing_venues m), '[]'::jsonb),
  'total_da_riportare', coalesce((select sum(e.total_da_riportare) from employee_totals e), 0),
  'fingerprint', (select value from fingerprint_source)
)
from selected_period p;
$function$;

create or replace function public.prepara_finalizzazione_conteggi(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.is_play_money_admin() then
    raise exception 'Operazione riservata agli Admin';
  end if;

  if not exists (
    select 1 from public.conteggi_periods
    where id = p_period_id and status = 'open' and is_active = true
  ) then
    raise exception 'Il periodo non è aperto e attivo';
  end if;

  if exists (select 1 from public.conteggi_tool where period_id = p_period_id and coalesce(riporto, 0) < 0) then
    raise exception 'Esiste un Da Riportare negativo: correggilo prima di proseguire';
  end if;

  if exists (
    select venue_id from public.conteggi_tool
    where period_id = p_period_id
    group by venue_id having count(*) > 1
  ) then
    raise exception 'Esiste più di un conteggio per lo stesso locale';
  end if;

  select public._finalizzazione_preview(p_period_id) into result;
  if result is null then raise exception 'Periodo non trovato'; end if;
  return result;
end;
$function$;

create or replace function public.finalizza_periodo_conteggi(
  p_period_id uuid,
  p_new_date_to date,
  p_preview_fingerprint text,
  p_missing_venues_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_period public.conteggi_periods%rowtype;
  v_preview jsonb;
  v_snapshot_id uuid;
  v_new_period_id uuid;
  v_new_date_from date;
  v_movimenti_count integer;
  v_transfer_count integer;
  v_transfer_total numeric;
begin
  if auth.uid() is null or not public.is_play_money_admin() then
    raise exception 'Operazione riservata agli Admin';
  end if;

  select * into v_period
  from public.conteggi_periods
  where id = p_period_id
  for update;

  if not found or v_period.status <> 'open' or v_period.is_active is not true then
    raise exception 'Il periodo non è aperto e attivo';
  end if;

  if exists (select 1 from public.conteggi_archive_snapshots where period_id = p_period_id) then
    raise exception 'Questo periodo è già stato finalizzato';
  end if;

  v_preview := public.prepara_finalizzazione_conteggi(p_period_id);
  if coalesce(v_preview->>'fingerprint', '') <> coalesce(p_preview_fingerprint, '') then
    raise exception 'I dati del periodo sono cambiati. Controlla nuovamente i Da Riportare';
  end if;

  if jsonb_array_length(coalesce(v_preview->'missing_venues', '[]'::jsonb)) > 0
     and p_missing_venues_confirmed is not true then
    raise exception 'Devi confermare i locali non conteggiati';
  end if;

  v_new_date_from := v_period.date_to + 1;
  if p_new_date_to is null or p_new_date_to < v_new_date_from then
    raise exception 'Data finale del nuovo periodo non valida';
  end if;

  if exists (
    select 1 from public.conteggi_periods p
    where p.id <> p_period_id
      and daterange(p.date_from, p.date_to, '[]') && daterange(v_new_date_from, p_new_date_to, '[]')
  ) then
    raise exception 'Il nuovo periodo si sovrappone a un periodo esistente';
  end if;

  select count(*) into v_movimenti_count
  from public.movements_cassa
  where work_date between v_period.date_from and v_period.date_to;

  insert into public.conteggi_archive_snapshots (
    period_id, date_from, date_to, title, period_data, conteggi_data,
    movimenti_cassa_data, overrides_data, riepilogo_data, finalization_data, closed_by
  ) values (
    v_period.id, v_period.date_from, v_period.date_to, v_period.title, to_jsonb(v_period),
    jsonb_build_object(
      'conteggi_tool', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.conteggi_tool c where c.period_id = p_period_id), '[]'::jsonb),
      'conteggi_admin_rows', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.conteggi_admin_rows c where c.period_id = p_period_id), '[]'::jsonb)
    ),
    coalesce((select jsonb_agg(to_jsonb(m) order by m.work_date, m.created_at) from public.movements_cassa m where m.work_date between v_period.date_from and v_period.date_to), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from public.conteggi_admin_overrides o where o.period_id = p_period_id), '[]'::jsonb),
    coalesce((select to_jsonb(s) from public.conteggi_admin_summary s where s.period_id = p_period_id), '{}'::jsonb),
    v_preview || jsonb_build_object('finalized_by', auth.uid(), 'finalized_at', now(), 'missing_venues_confirmed', p_missing_venues_confirmed),
    auth.uid()
  ) returning id into v_snapshot_id;

  insert into public.movements_cassa (
    client_id, work_date, venue_id, acconto, recupero, da_riportare,
    note, created_by, origine, source_conteggio_id, source_period_id
  )
  select
    'finalize-' || p_period_id::text || '-' || c.id::text,
    v_new_date_from,
    c.venue_id,
    0, 0, trunc(c.riporto),
    'Trasferimento automatico da finalizzazione • Conteggio ' || c.id::text,
    auth.uid(),
    'chiusura_conteggio',
    c.id,
    p_period_id
  from public.conteggi_tool c
  where c.period_id = p_period_id and coalesce(c.riporto, 0) > 0;

  get diagnostics v_transfer_count = row_count;
  select coalesce(sum(trunc(riporto)), 0) into v_transfer_total
  from public.conteggi_tool where period_id = p_period_id and coalesce(riporto, 0) > 0;

  delete from public.movements_cassa
  where work_date between v_period.date_from and v_period.date_to;
  delete from public.conteggi_admin_overrides where period_id = p_period_id;
  delete from public.conteggi_tool where period_id = p_period_id;

  update public.conteggi_periods
  set status = 'closed', is_active = false, updated_at = now()
  where id = p_period_id;

  insert into public.conteggi_periods (
    title, date_from, date_to, status, note, created_by, is_active
  ) values (
    'Conteggi ' || to_char(v_new_date_from, 'DD/MM/YYYY') || ' - ' || to_char(p_new_date_to, 'DD/MM/YYYY'),
    v_new_date_from, p_new_date_to, 'open', null, auth.uid(), true
  ) returning id into v_new_period_id;

  return jsonb_build_object(
    'success', true,
    'closed_period_id', p_period_id,
    'snapshot_id', v_snapshot_id,
    'new_period_id', v_new_period_id,
    'new_date_from', v_new_date_from,
    'new_date_to', p_new_date_to,
    'conteggi_archiviati', coalesce((v_preview->>'conteggi_count')::integer, 0),
    'movimenti_archiviati_eliminati', v_movimenti_count,
    'da_riportare_creati', v_transfer_count,
    'da_riportare_trasferiti', v_transfer_total
  );
end;
$function$;

revoke all on function public._finalizzazione_preview(uuid) from public, anon, authenticated;
revoke all on function public.prepara_finalizzazione_conteggi(uuid) from public, anon;
revoke all on function public.finalizza_periodo_conteggi(uuid, date, text, boolean) from public, anon;
grant execute on function public.prepara_finalizzazione_conteggi(uuid) to authenticated;
grant execute on function public.finalizza_periodo_conteggi(uuid, date, text, boolean) to authenticated;

-- Archivio in sola lettura per gli utenti autenticati. La RPC SECURITY DEFINER crea lo snapshot.
drop policy if exists "conteggi_archive_snapshots_all" on public.conteggi_archive_snapshots;
create policy conteggi_archive_snapshots_read
  on public.conteggi_archive_snapshots for select to authenticated using (true);

-- I periodi non sono più eliminabili dall'app e gli anonimi non possono modificarli.
drop policy if exists anon_can_delete_conteggi_periods on public.conteggi_periods;
drop policy if exists anon_can_insert_conteggi_periods on public.conteggi_periods;
drop policy if exists anon_can_update_conteggi_periods on public.conteggi_periods;
drop policy if exists authenticated_can_insert_conteggi_periods on public.conteggi_periods;
drop policy if exists conteggi_periods_admin_delete on public.conteggi_periods;

commit;
