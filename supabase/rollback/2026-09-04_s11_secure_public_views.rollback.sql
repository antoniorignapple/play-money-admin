-- Rollback di emergenza S11. Ripristina definizioni e ACL fotografate prima del rilascio.
begin;

create or replace view public.change_daily_logs_view as
select distinct on (mlh.machine_id, ((mlh.updated_at at time zone 'Europe/Rome')::date))
  mlh.machine_id,
  (mlh.updated_at at time zone 'Europe/Rome')::date as log_date,
  mlh.new_level as level,
  upper(split_part(coalesce(u.email, '—'), '@', 1))::character varying(255) as operator,
  mlh.updated_at
from public.machine_level_history mlh
left join auth.users u on u.id = mlh.updated_by
order by mlh.machine_id, ((mlh.updated_at at time zone 'Europe/Rome')::date), mlh.updated_at desc;

create or replace view public.conteggi_admin_rows as
select id, user_id, venue_id, conteggio_date, esattore, acconti, carta, monete,
  riporto, rec_sosp, debito, debito_virt, bonus, note, created_at, updated_at,
  uso_cassa, assegno, totale_finale, period_id, operator_name, locked, admin_note
from public.conteggi_tool;

create or replace view public.conteggi_admin_summary as
select p.id as period_id, p.title, p.date_from, p.date_to, p.status,
  count(c.id) as conteggi_totali,
  count(distinct c.venue_id) as locali_conteggiati,
  count(distinct c.user_id) as operatori_totali,
  coalesce(sum(c.esattore), 0::numeric) as totale_esattore,
  coalesce(sum(c.acconti), 0::numeric) as totale_ricevute,
  coalesce(sum(c.riporto), 0::numeric) as totale_da_riportare,
  coalesce(sum(c.assegno), 0::numeric) as totale_assegni,
  coalesce(sum(c.debito), 0::numeric) as totale_debiti,
  coalesce(sum(coalesce(c.carta, 0::numeric) + coalesce(c.monete, 0::numeric) - coalesce(c.uso_cassa, 0::numeric)), 0::numeric) as totale_cassa_depositi,
  coalesce(sum(c.totale_finale), 0::numeric) as totale_finale
from public.conteggi_periods p
left join public.conteggi_tool c on c.period_id = p.id
group by p.id, p.title, p.date_from, p.date_to, p.status
order by p.date_from desc;

alter view public.active_conteggi_period reset (security_invoker, security_barrier);
alter view public.change_daily_logs_view reset (security_invoker, security_barrier);
alter view public.conteggi_active_period reset (security_invoker, security_barrier);
alter view public.conteggi_admin_rows reset (security_invoker, security_barrier);
alter view public.conteggi_admin_summary reset (security_invoker, security_barrier);
alter view public.conteggi_by_giro_summary reset (security_invoker, security_barrier);
alter view public.conteggi_duplicati_periodo reset (security_invoker, security_barrier);
alter view public.movements_cassa_view reset (security_invoker, security_barrier);

grant all privileges on table
  public.active_conteggi_period,
  public.change_daily_logs_view,
  public.conteggi_active_period,
  public.conteggi_admin_rows,
  public.conteggi_admin_summary,
  public.conteggi_by_giro_summary,
  public.conteggi_duplicati_periodo,
  public.movements_cassa_view
to anon, authenticated, service_role;

commit;
