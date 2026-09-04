-- S11 - Impedisce alle viste pubbliche di aggirare RLS e privilegi del chiamante.
--
-- PRECONDIZIONI DI RILASCIO:
-- 1. backup verificato;
-- 2. applicazione esclusivamente nella finestra di manutenzione;
-- 3. test immediato con i ruoli anon, dipendente e Admin;
-- 4. rollback mediante ripristino della migrazione precedente se una vista usata
--    dall'app non restituisce i dati autorizzati.

begin;

do $$
begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'S11 richiede PostgreSQL 15 o superiore per security_invoker';
  end if;

  if to_regprocedure('public.is_play_money_admin_secure()') is null then
    raise exception 'Prerequisito mancante: public.is_play_money_admin_secure()';
  end if;
end
$$;

-- La vecchia vista leggeva direttamente auth.users ed era esposta anche ad anon.
-- Il nome dell'operatore viene ora risolto dalla directory applicativa, senza
-- attraversare lo schema Auth.
create or replace view public.change_daily_logs_view
with (security_invoker = true, security_barrier = true)
as
select distinct on (
  mlh.machine_id,
  (mlh.updated_at at time zone 'Europe/Rome')::date
)
  mlh.machine_id,
  (mlh.updated_at at time zone 'Europe/Rome')::date as log_date,
  mlh.new_level as level,
  upper(
    coalesce(nullif(btrim(d.full_name), ''), '—')
  )::character varying(255) as operator,
  mlh.updated_at
from public.machine_level_history mlh
left join public.dipendenti d on d.auth_user_id = mlh.updated_by
order by
  mlh.machine_id,
  (mlh.updated_at at time zone 'Europe/Rome')::date,
  mlh.updated_at desc;

-- Queste due viste restano interrogabili dall'app Admin, ma restituiscono righe
-- soltanto quando il ruolo Admin è verificato dalla fonte server-controlled.
create or replace view public.conteggi_admin_rows
with (security_invoker = true, security_barrier = true)
as
select
  id,
  user_id,
  venue_id,
  conteggio_date,
  esattore,
  acconti,
  carta,
  monete,
  riporto,
  rec_sosp,
  debito,
  debito_virt,
  bonus,
  note,
  created_at,
  updated_at,
  uso_cassa,
  assegno,
  totale_finale,
  period_id,
  operator_name,
  locked,
  admin_note
from public.conteggi_tool
where (select public.is_play_money_admin_secure());

create or replace view public.conteggi_admin_summary
with (security_invoker = true, security_barrier = true)
as
select
  p.id as period_id,
  p.title,
  p.date_from,
  p.date_to,
  p.status,
  count(c.id) as conteggi_totali,
  count(distinct c.venue_id) as locali_conteggiati,
  count(distinct c.user_id) as operatori_totali,
  coalesce(sum(c.esattore), 0::numeric) as totale_esattore,
  coalesce(sum(c.acconti), 0::numeric) as totale_ricevute,
  coalesce(sum(c.riporto), 0::numeric) as totale_da_riportare,
  coalesce(sum(c.assegno), 0::numeric) as totale_assegni,
  coalesce(sum(c.debito), 0::numeric) as totale_debiti,
  coalesce(
    sum(
      coalesce(c.carta, 0::numeric)
      + coalesce(c.monete, 0::numeric)
      - coalesce(c.uso_cassa, 0::numeric)
    ),
    0::numeric
  ) as totale_cassa_depositi,
  coalesce(sum(c.totale_finale), 0::numeric) as totale_finale
from public.conteggi_periods p
left join public.conteggi_tool c on c.period_id = p.id
where (select public.is_play_money_admin_secure())
group by p.id, p.title, p.date_from, p.date_to, p.status
order by p.date_from desc;

-- Le altre viste devono sempre applicare i privilegi e le RLS del chiamante.
alter view public.active_conteggi_period
  set (security_invoker = true, security_barrier = true);
alter view public.conteggi_active_period
  set (security_invoker = true, security_barrier = true);
alter view public.conteggi_by_giro_summary
  set (security_invoker = true, security_barrier = true);
alter view public.conteggi_duplicati_periodo
  set (security_invoker = true, security_barrier = true);
alter view public.movements_cassa_view
  set (security_invoker = true, security_barrier = true);

-- Riparte da zero: nessuna vista conserva privilegi di scrittura o accesso anon.
revoke all privileges on table public.active_conteggi_period from public, anon, authenticated;
revoke all privileges on table public.change_daily_logs_view from public, anon, authenticated;
revoke all privileges on table public.conteggi_active_period from public, anon, authenticated;
revoke all privileges on table public.conteggi_admin_rows from public, anon, authenticated;
revoke all privileges on table public.conteggi_admin_summary from public, anon, authenticated;
revoke all privileges on table public.conteggi_by_giro_summary from public, anon, authenticated;
revoke all privileges on table public.conteggi_duplicati_periodo from public, anon, authenticated;
revoke all privileges on table public.movements_cassa_view from public, anon, authenticated;

-- Periodo ufficiale: lettura necessaria a entrambe le app dopo il login.
grant select on table public.active_conteggi_period to authenticated;
grant select on table public.conteggi_active_period to authenticated;

-- Riepiloghi Admin: il GRANT permette la query, il filtro server-side decide se
-- il chiamante è davvero Admin. Un dipendente riceve sempre zero righe.
grant select on table public.conteggi_admin_rows to authenticated;
grant select on table public.conteggi_admin_summary to authenticated;

-- La service role mantiene esclusivamente la lettura di tutte le viste.
grant select on table
  public.active_conteggi_period,
  public.change_daily_logs_view,
  public.conteggi_active_period,
  public.conteggi_admin_rows,
  public.conteggi_admin_summary,
  public.conteggi_by_giro_summary,
  public.conteggi_duplicati_periodo,
  public.movements_cassa_view
to service_role;

comment on view public.change_daily_logs_view is
  'S11: storico Change senza accesso diretto ad auth.users; security_invoker; riservato alla service role.';
comment on view public.conteggi_admin_rows is
  'S11: righe conteggi visibili soltanto all Admin verificato; security_invoker.';
comment on view public.conteggi_admin_summary is
  'S11: riepilogo conteggi visibile soltanto all Admin verificato; security_invoker.';

-- Controlli automatici prima del COMMIT: qualsiasi anomalia annulla l'intera S11.
do $$
declare
  secured_views constant text[] := array[
    'active_conteggi_period',
    'change_daily_logs_view',
    'conteggi_active_period',
    'conteggi_admin_rows',
    'conteggi_admin_summary',
    'conteggi_by_giro_summary',
    'conteggi_duplicati_periodo',
    'movements_cassa_view'
  ];
begin
  if exists (
    select 1
    from unnest(secured_views) expected(view_name)
    left join pg_class c
      on c.relname = expected.view_name
     and c.relnamespace = 'public'::regnamespace
     and c.relkind = 'v'
    where c.oid is null
       or not coalesce(c.reloptions @> array['security_invoker=true'], false)
  ) then
    raise exception 'Verifica S11 fallita: vista mancante o senza security_invoker';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = any(secured_views)
      and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'Verifica S11 fallita: una vista conserva privilegi pubblici o anon';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = any(secured_views)
      and grantee in ('authenticated', 'service_role')
      and privilege_type <> 'SELECT'
  ) then
    raise exception 'Verifica S11 fallita: una vista conserva privilegi diversi da SELECT';
  end if;

  if exists (
    select 1
    from pg_rewrite rw
    join pg_class view_class on view_class.oid = rw.ev_class
    join pg_namespace view_schema on view_schema.oid = view_class.relnamespace
    join pg_depend dep on dep.objid = rw.oid and dep.deptype = 'n'
    join pg_class source_class on source_class.oid = dep.refobjid
    join pg_namespace source_schema on source_schema.oid = source_class.relnamespace
    where view_schema.nspname = 'public'
      and view_class.relname = 'change_daily_logs_view'
      and source_schema.nspname = 'auth'
  ) then
    raise exception 'Verifica S11 fallita: change_daily_logs_view dipende ancora dallo schema auth';
  end if;
end
$$;

commit;
