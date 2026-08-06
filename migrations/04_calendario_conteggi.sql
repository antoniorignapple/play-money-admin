create table if not exists public.calendario_conteggi (
  data_conteggio date primary key,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
alter table public.calendario_conteggi enable row level security;
drop policy if exists "calendario_conteggi_read" on public.calendario_conteggi;
drop policy if exists "calendario_conteggi_write" on public.calendario_conteggi;
create policy "calendario_conteggi_read" on public.calendario_conteggi for select to authenticated using (true);
create policy "calendario_conteggi_write" on public.calendario_conteggi for all to authenticated using (true) with check (true);
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'calendario_conteggi'
  ) then
    alter publication supabase_realtime add table public.calendario_conteggi;
  end if;
end $$;
