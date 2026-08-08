-- Archivio automezzi non distruttivo. Il testo storico mezzo resta sempre conservato.
begin;
create table if not exists public.automezzi (
 id uuid primary key default gen_random_uuid(), name text not null, plate text not null,
 active boolean not null default true, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists automezzi_plate_unique on public.automezzi(upper(regexp_replace(plate,'[^A-Za-z0-9]','','g')));
alter table public.fondo_cassa_giornaliero add column if not exists vehicle_id uuid references public.automezzi(id) on delete set null;
alter table public.fondo_cassa_giornaliero add column if not exists vehicle_name_snapshot text;
alter table public.fondo_cassa_giornaliero add column if not exists vehicle_plate_snapshot text;
create index if not exists fondo_vehicle_date_idx on public.fondo_cassa_giornaliero(vehicle_id,work_date desc);
alter table public.automezzi enable row level security;
drop policy if exists automezzi_read on public.automezzi;
create policy automezzi_read on public.automezzi for select to authenticated using(true);
drop policy if exists automezzi_admin_write on public.automezzi;
create policy automezzi_admin_write on public.automezzi for all to authenticated using(public.is_admin()) with check(public.is_admin());
commit;
