-- Play Money · Programmazione giornaliera dei conteggi
-- Eseguire una sola volta nel SQL Editor di Supabase prima di pubblicare le app.

create extension if not exists pgcrypto;

create table if not exists public.conteggio_programmazioni (
  id uuid primary key default gen_random_uuid(),
  data_conteggio date not null,
  employee_id uuid not null,
  giro_id uuid not null,
  venue_id text not null,
  posizione integer not null default 0 check (posizione >= 0),
  nota text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_conteggio, employee_id, venue_id)
);

create index if not exists conteggio_programmazioni_day_employee_idx
  on public.conteggio_programmazioni (data_conteggio, employee_id, posizione);
create index if not exists conteggio_programmazioni_giro_idx
  on public.conteggio_programmazioni (giro_id, data_conteggio);

alter table public.conteggio_programmazioni enable row level security;

create or replace function public.is_play_money_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.is_play_money_admin_secure());
$$;
revoke all on function public.is_play_money_admin() from public, anon;
grant execute on function public.is_play_money_admin() to authenticated, service_role;

drop policy if exists "programmazioni_select_authenticated" on public.conteggio_programmazioni;
create policy "programmazioni_select_authenticated"
  on public.conteggio_programmazioni for select to authenticated
  using (true);

drop policy if exists "programmazioni_admin_insert" on public.conteggio_programmazioni;
create policy "programmazioni_admin_insert"
  on public.conteggio_programmazioni for insert to authenticated
  with check (public.is_play_money_admin());

drop policy if exists "programmazioni_admin_update" on public.conteggio_programmazioni;
create policy "programmazioni_admin_update"
  on public.conteggio_programmazioni for update to authenticated
  using (public.is_play_money_admin()) with check (public.is_play_money_admin());

drop policy if exists "programmazioni_admin_delete" on public.conteggio_programmazioni;
create policy "programmazioni_admin_delete"
  on public.conteggio_programmazioni for delete to authenticated
  using (public.is_play_money_admin());

-- Realtime: consente all'app Dipendenti di aggiornare subito la giornata.
do $$ begin
  alter publication supabase_realtime add table public.conteggio_programmazioni;
exception when duplicate_object then null;
end $$;

comment on table public.conteggio_programmazioni is
  'Snapshot giornaliero dei locali assegnati a ciascun dipendente per i conteggi.';
