-- Realtime necessario per configurazioni che devono aggiornarsi senza riavvio.
begin;
do $$ declare t text;
begin
  foreach t in array array['giri','giro_venue_assignments','automezzi','conteggi_periods','daily_edit_locks','simulazioni_richieste'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
commit;

-- Verifiche finali (devono restituire zero righe salvo i Locali volutamente non assegnati).
select client_id,count(*) from public.movements_cassa group by client_id having count(*)>1;
select period_id,venue_id,count(*) from public.conteggi_tool where period_id is not null group by period_id,venue_id having count(*)>1;
select venue_id,count(*) from public.giro_venue_assignments where valid_to is null group by venue_id having count(*)>1;
