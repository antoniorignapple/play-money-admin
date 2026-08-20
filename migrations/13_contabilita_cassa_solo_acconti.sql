-- Play Money Admin 8.1
-- La cassa generata considera esclusivamente gli Acconti.
-- Recuperi e Da Riportare restano disponibili nel riepilogo, ma non incidono
-- più sul contatore della Contabilità Cassa.

create or replace function public._cassa_period_summary(p_period_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
with p as (
  select *
  from public.conteggi_periods
  where id = p_period_id
), m as (
  select
    coalesce(sum(coalesce(acconto, 0)), 0) as acconti,
    coalesce(sum(coalesce(recupero, 0)), 0) as recuperi,
    coalesce(sum(coalesce(da_riportare, 0)), 0) as da_riportare,
    coalesce(sum(coalesce(acconto, 0)), 0) as cassa_generata,
    count(*) as movimenti_count
  from public.movements_cassa x, p
  where x.deleted_at is null
    and x.work_date between p.date_from and p.date_to
), t as (
  select
    coalesce(sum(amount), 0) as trasferimenti_totale,
    count(*) as trasferimenti_count
  from public.cassa_trasferimenti
  where period_id = p_period_id
)
select jsonb_build_object(
  'period_id', p.id,
  'date_from', p.date_from,
  'date_to', p.date_to,
  'status', p.status,
  'is_active', p.is_active,
  'acconti', m.acconti,
  'recuperi', m.recuperi,
  'da_riportare', m.da_riportare,
  'cassa_generata', m.cassa_generata,
  'trasferimenti_totale', t.trasferimenti_totale,
  'cassa_disponibile', m.cassa_generata - t.trasferimenti_totale,
  'movimenti_count', m.movimenti_count,
  'trasferimenti_count', t.trasferimenti_count
)
from p
cross join m
cross join t;
$function$;
