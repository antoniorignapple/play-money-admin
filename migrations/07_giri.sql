-- Play Money Admin 7.0 / Dipendenti 14.0
-- Giri conteggi, assegnazioni esclusive e tracciabilita dell'esecutore reale.
begin;

create table if not exists public.giri (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  default_employee_id uuid references public.dipendenti(id) on delete set null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.giro_venue_assignments (
  id uuid primary key default gen_random_uuid(),
  giro_id uuid not null references public.giri(id) on delete restrict,
  venue_id text not null references public.venues(id) on delete restrict,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint giro_assignment_dates_check check (valid_to is null or valid_to > valid_from)
);

create unique index if not exists giro_venue_one_active_idx
  on public.giro_venue_assignments(venue_id) where valid_to is null;
create index if not exists giro_venue_active_giro_idx
  on public.giro_venue_assignments(giro_id, venue_id) where valid_to is null;

create table if not exists public.giri_audit (
  id bigint generated always as identity primary key,
  giro_id uuid references public.giri(id) on delete set null,
  venue_id text references public.venues(id) on delete set null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid not null default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now()
);

alter table public.conteggi_tool add column if not exists giro_id uuid references public.giri(id);
alter table public.conteggi_tool add column if not exists executed_by uuid references auth.users(id);
alter table public.conteggi_tool add column if not exists giro_name_snapshot text;
alter table public.conteggi_tool add column if not exists executor_name_snapshot text;
alter table public.simulazioni add column if not exists giro_id uuid references public.giri(id);
alter table public.simulazioni add column if not exists executed_by uuid references auth.users(id);

create index if not exists conteggi_tool_giro_period_idx on public.conteggi_tool(giro_id, period_id);
create unique index if not exists conteggi_tool_period_venue_unique
  on public.conteggi_tool(period_id, venue_id) where period_id is not null;

insert into public.giri(code, name, default_employee_id, sort_order)
select seed.code, seed.name, d.id, seed.sort_order
from (values
  ('D01', 'D''APRILE', 10), ('D02', 'PAPAGNI', 20),
  ('D03', 'DI BARI', 30), ('D04', 'QUITADAMO', 40),
  ('D05', 'RIGNANESE', 50)
) seed(code, name, sort_order)
left join public.dipendenti d on upper(d.full_name) = seed.name
on conflict (code) do update set
  name = excluded.name,
  default_employee_id = coalesce(public.giri.default_employee_id, excluded.default_employee_id),
  sort_order = excluded.sort_order;

create or replace function public.audit_giri_changes()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_giro_id uuid; v_venue_id text;
begin
  if tg_table_name = 'giri' then
    v_giro_id := coalesce(new.id, old.id); v_venue_id := null;
  else
    v_giro_id := coalesce(new.giro_id, old.giro_id);
    v_venue_id := coalesce(new.venue_id, old.venue_id);
  end if;
  insert into public.giri_audit(giro_id, venue_id, action, old_data, new_data)
  values (
    v_giro_id, v_venue_id,
    tg_table_name || ':' || lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_audit_giri on public.giri;
create trigger trg_audit_giri after insert or update or delete on public.giri
for each row execute function public.audit_giri_changes();
drop trigger if exists trg_audit_giro_assignments on public.giro_venue_assignments;
create trigger trg_audit_giro_assignments after insert or update or delete on public.giro_venue_assignments
for each row execute function public.audit_giri_changes();

create or replace function public.move_venues_to_giro(p_giro_id uuid, p_venue_ids text[])
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Operazione riservata agli Admin'; end if;
  if not exists(select 1 from public.giri where id=p_giro_id) then raise exception 'Giro non trovato'; end if;
  update public.giro_venue_assignments set valid_to=now()
   where venue_id=any(p_venue_ids) and valid_to is null and giro_id<>p_giro_id;
  insert into public.giro_venue_assignments(giro_id, venue_id)
  select p_giro_id, v.id from public.venues v
  where v.id=any(p_venue_ids) and upper(v.id) not like 'D%'
    and not exists(select 1 from public.giro_venue_assignments a where a.venue_id=v.id and a.giro_id=p_giro_id and a.valid_to is null);
  get diagnostics affected=row_count;
  return affected;
end $$;

create or replace function public.remove_venues_from_giro(p_venue_ids text[])
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Operazione riservata agli Admin'; end if;
  update public.giro_venue_assignments set valid_to=now()
  where venue_id=any(p_venue_ids) and valid_to is null;
  get diagnostics affected=row_count; return affected;
end $$;

alter table public.giri enable row level security;
alter table public.giro_venue_assignments enable row level security;
alter table public.giri_audit enable row level security;
drop policy if exists giri_read on public.giri;
create policy giri_read on public.giri for select to authenticated using (true);
drop policy if exists giri_admin_write on public.giri;
create policy giri_admin_write on public.giri for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists giro_assignments_read on public.giro_venue_assignments;
create policy giro_assignments_read on public.giro_venue_assignments for select to authenticated using(true);
drop policy if exists giro_assignments_admin_write on public.giro_venue_assignments;
create policy giro_assignments_admin_write on public.giro_venue_assignments for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists giri_audit_admin_read on public.giri_audit;
create policy giri_audit_admin_read on public.giri_audit for select to authenticated using(public.is_admin());

revoke all on function public.move_venues_to_giro(uuid,text[]) from public, anon;
revoke all on function public.remove_venues_from_giro(text[]) from public, anon;
grant execute on function public.move_venues_to_giro(uuid,text[]) to authenticated;
grant execute on function public.remove_venues_from_giro(text[]) to authenticated;
commit;
