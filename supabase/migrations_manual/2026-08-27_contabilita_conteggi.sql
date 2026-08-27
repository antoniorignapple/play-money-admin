-- Contabilità Conteggi: selezione debiti del periodo e righe manuali.
-- Contabilità Cassa non viene modificata.

create table if not exists public.contabilita_conteggi_debiti_selezionati (
  period_id uuid not null references public.conteggi_periods(id) on delete restrict,
  conteggio_id uuid not null references public.conteggi_tool(id) on delete restrict,
  selected_by uuid not null default auth.uid(),
  selected_at timestamptz not null default now(),
  primary key (period_id, conteggio_id)
);
alter table public.contabilita_conteggi_debiti_selezionati enable row level security;

create policy contabilita_conteggi_debiti_admin_select
on public.contabilita_conteggi_debiti_selezionati for select to authenticated
using (public.is_play_money_admin());
create policy contabilita_conteggi_debiti_admin_insert
on public.contabilita_conteggi_debiti_selezionati for insert to authenticated
with check (public.is_play_money_admin() and selected_by = (select auth.uid()));
create policy contabilita_conteggi_debiti_admin_delete
on public.contabilita_conteggi_debiti_selezionati for delete to authenticated
using (public.is_play_money_admin());
grant select, insert, delete on public.contabilita_conteggi_debiti_selezionati to authenticated;
revoke all on public.contabilita_conteggi_debiti_selezionati from anon;
create index if not exists contabilita_conteggi_debiti_conteggio_idx
  on public.contabilita_conteggi_debiti_selezionati(conteggio_id);

create table if not exists public.contabilita_conteggi_righe (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.conteggi_periods(id) on delete restrict,
  work_date date not null,
  description text not null,
  amount numeric not null default 0,
  note text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contabilita_conteggi_righe enable row level security;
create policy contabilita_conteggi_righe_admin_select
on public.contabilita_conteggi_righe for select to authenticated using (public.is_play_money_admin());
create policy contabilita_conteggi_righe_admin_insert
on public.contabilita_conteggi_righe for insert to authenticated
with check (public.is_play_money_admin() and created_by = (select auth.uid()));
create policy contabilita_conteggi_righe_admin_update
on public.contabilita_conteggi_righe for update to authenticated
using (public.is_play_money_admin()) with check (public.is_play_money_admin());
create policy contabilita_conteggi_righe_admin_delete
on public.contabilita_conteggi_righe for delete to authenticated using (public.is_play_money_admin());
grant select, insert, update, delete on public.contabilita_conteggi_righe to authenticated;
revoke all on public.contabilita_conteggi_righe from anon;
create index if not exists contabilita_conteggi_righe_period_date_idx
  on public.contabilita_conteggi_righe(period_id, work_date desc, created_at desc);
