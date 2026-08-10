-- Play Money · Un solo conteggio per locale in ciascun periodo ufficiale
-- Eseguire una sola volta nel SQL Editor DOPO programmazione_conteggi.sql.
-- Non elimina né modifica eventuali doppioni già presenti.

create or replace function public.prevent_duplicate_conteggio_in_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_id text;
  v_date_from date;
  v_date_to date;
  v_existing_id text;
begin
  if new.venue_id is null or new.conteggio_date is null then
    return new;
  end if;

  select p.id::text, p.date_from, p.date_to
    into v_period_id, v_date_from, v_date_to
  from public.conteggi_periods p
  where new.conteggio_date between p.date_from and p.date_to
  order by case when p.status = 'active' then 0 else 1 end, p.date_from desc
  limit 1;

  if v_period_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Nessun periodo conteggi contiene la data selezionata.';
  end if;

  -- Serializza i salvataggi dello stesso locale/periodo: protegge anche
  -- da due telefoni che confermano nello stesso istante.
  perform pg_advisory_xact_lock(hashtextextended(v_period_id::text || ':' || new.venue_id::text, 0));

  select c.id::text into v_existing_id
  from public.conteggi_tool c
  where c.venue_id = new.venue_id
    and c.conteggio_date between v_date_from and v_date_to
    and (tg_op = 'INSERT' or c.id <> new.id)
  order by c.conteggio_date, c.updated_at nulls last, c.id
  limit 1;

  if v_existing_id is not null then
    raise exception using
      errcode = '23505',
      message = 'LOCALE_GIA_CONTEGGIATO_NEL_PERIODO',
      detail = 'Conteggio esistente: ' || v_existing_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_conteggio_in_period on public.conteggi_tool;
create trigger trg_prevent_duplicate_conteggio_in_period
before insert or update of venue_id, conteggio_date on public.conteggi_tool
for each row execute function public.prevent_duplicate_conteggio_in_period();

-- Vista diagnostica: mostra soltanto eventuali doppioni storici.
create or replace view public.conteggi_duplicati_periodo as
select
  p.id as period_id,
  p.title as periodo,
  p.date_from,
  p.date_to,
  c.venue_id,
  count(*) as numero_conteggi,
  array_agg(c.id order by c.conteggio_date, c.updated_at nulls last) as conteggio_ids,
  array_agg(c.conteggio_date order by c.conteggio_date, c.updated_at nulls last) as date_conteggi
from public.conteggi_periods p
join public.conteggi_tool c on c.conteggio_date between p.date_from and p.date_to
group by p.id, p.title, p.date_from, p.date_to, c.venue_id
having count(*) > 1;

grant select on public.conteggi_duplicati_periodo to authenticated;

-- Dopo l'esecuzione puoi controllare senza cancellare nulla:
-- select * from public.conteggi_duplicati_periodo order by date_from desc, venue_id;
