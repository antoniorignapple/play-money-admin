-- Periodo ufficiale dei conteggi, gestito esclusivamente dall'app Admin.
-- La view espone ai Dipendenti un solo intervallo attivo e non consente scritture.
create or replace view public.active_conteggi_period as
select id, title, date_from, date_to, status, note
from public.conteggi_periods
where status = 'open'
order by date_from desc
limit 1;

revoke all on public.active_conteggi_period from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.active_conteggi_period from authenticated;
grant select on public.active_conteggi_period to authenticated;

comment on view public.active_conteggi_period is
  'Periodo ufficiale in sola lettura utilizzato da Play Money Dipendenti.';
