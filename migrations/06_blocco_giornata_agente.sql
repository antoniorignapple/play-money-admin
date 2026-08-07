-- Play Money Admin 6.8 / Dipendenti 13.8
-- Blocco sicuro dei movimenti e del fondo cassa per agente e giornata.

begin;

create table if not exists public.daily_edit_locks (
  work_date date not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (work_date, created_by)
);

alter table public.daily_edit_locks enable row level security;

drop policy if exists daily_edit_locks_select on public.daily_edit_locks;
create policy daily_edit_locks_select
on public.daily_edit_locks for select to authenticated
using (created_by = auth.uid() or public.is_admin());

drop policy if exists daily_edit_locks_admin_all on public.daily_edit_locks;
create policy daily_edit_locks_admin_all
on public.daily_edit_locks for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.set_daily_edit_lock(
  p_work_date date,
  p_created_by uuid,
  p_locked boolean
)
returns public.daily_edit_locks
language plpgsql
security definer
set search_path = public
as $function$
declare
  result public.daily_edit_locks;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Operazione riservata agli Admin';
  end if;

  insert into public.daily_edit_locks (
    work_date, created_by, locked, locked_at, locked_by, updated_at
  ) values (
    p_work_date, p_created_by, p_locked,
    case when p_locked then now() else null end,
    case when p_locked then auth.uid() else null end,
    now()
  )
  on conflict (work_date, created_by) do update set
    locked = excluded.locked,
    locked_at = excluded.locked_at,
    locked_by = excluded.locked_by,
    updated_at = now()
  returning * into result;

  return result;
end;
$function$;

revoke all on function public.set_daily_edit_lock(date, uuid, boolean) from public;
grant execute on function public.set_daily_edit_lock(date, uuid, boolean) to authenticated;

create or replace function public.guard_daily_employee_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_date date;
  target_user uuid;
begin
  -- Gli Admin possono sempre correggere i dati, anche a giornata chiusa.
  if auth.uid() is not null and public.is_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    target_date := old.work_date;
    target_user := old.created_by;
  else
    target_date := new.work_date;
    target_user := new.created_by;
  end if;

  if exists (
    select 1 from public.daily_edit_locks l
    where l.work_date = target_date
      and l.created_by = target_user
      and l.locked = true
  ) then
    raise exception 'GIORNATA_BLOCCATA: l''Admin ha chiuso le modifiche per questa giornata';
  end if;

  -- Impedisce di aggirare il blocco spostando una riga già chiusa.
  if tg_op = 'UPDATE' and exists (
    select 1 from public.daily_edit_locks l
    where l.work_date = old.work_date
      and l.created_by = old.created_by
      and l.locked = true
  ) then
    raise exception 'GIORNATA_BLOCCATA: l''Admin ha chiuso le modifiche per questa giornata';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_daily_movements on public.movements_cassa;
create trigger trg_guard_daily_movements
before insert or update or delete on public.movements_cassa
for each row execute function public.guard_daily_employee_edit();

drop trigger if exists trg_guard_daily_fondo on public.fondo_cassa_giornaliero;
create trigger trg_guard_daily_fondo
before insert or update or delete on public.fondo_cassa_giornaliero
for each row execute function public.guard_daily_employee_edit();

create index if not exists daily_edit_locks_locked_idx
  on public.daily_edit_locks (work_date, created_by)
  where locked = true;

commit;
