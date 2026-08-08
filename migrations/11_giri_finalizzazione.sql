-- Compatibilita dei Giri con salvataggio e finalizzazione atomica esistente.
begin;
alter table public.movements_cassa add column if not exists giro_id uuid references public.giri(id);
alter table public.movements_cassa add column if not exists executed_by uuid references auth.users(id);
create index if not exists movements_cassa_giro_date_idx on public.movements_cassa(giro_id,work_date);

create or replace function public.guard_conteggio_giro()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_executor_name text;
begin
  if new.executed_by is null then new.executed_by := auth.uid(); end if;
  if auth.uid() is not null and new.executed_by <> auth.uid() and not public.is_admin() then
    raise exception 'L''esecutore deve coincidere con l''account autenticato';
  end if;
  if new.giro_id is null then raise exception 'Seleziona un Giro prima di salvare il conteggio'; end if;
  if not exists(select 1 from public.giri where id=new.giro_id and active=true) then raise exception 'Il Giro selezionato non è attivo'; end if;
  if not exists(select 1 from public.giro_venue_assignments where giro_id=new.giro_id and venue_id=new.venue_id and valid_to is null) then
    raise exception 'Il locale non appartiene al Giro selezionato';
  end if;
  select full_name into v_executor_name from public.dipendenti where auth_user_id=new.executed_by;
  select name into new.giro_name_snapshot from public.giri where id=new.giro_id;
  new.executor_name_snapshot := coalesce(v_executor_name, new.executor_name_snapshot);
  return new;
end $$;
drop trigger if exists trg_guard_conteggio_giro on public.conteggi_tool;
create trigger trg_guard_conteggio_giro before insert or update of giro_id,venue_id,executed_by on public.conteggi_tool
for each row execute function public.guard_conteggio_giro();

create or replace function public.attach_finalized_movement_giro()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.origine='chiusura_conteggio' and new.source_conteggio_id is not null then
    select giro_id, executed_by into new.giro_id, new.executed_by
    from public.conteggi_tool where id=new.source_conteggio_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_attach_finalized_movement_giro on public.movements_cassa;
create trigger trg_attach_finalized_movement_giro before insert on public.movements_cassa
for each row execute function public.attach_finalized_movement_giro();

create or replace view public.conteggi_by_giro_summary as
select c.period_id,c.giro_id,g.name as giro_name,count(*)::int as conteggi_count,
 count(distinct c.venue_id)::int as locali_count,coalesce(sum(c.riporto),0) as total_da_riportare
from public.conteggi_tool c join public.giri g on g.id=c.giro_id
group by c.period_id,c.giro_id,g.name;
grant select on public.conteggi_by_giro_summary to authenticated;
commit;
