-- Contabilità Cassa: selezioni persistenti dei debiti conteggio inclusi nel
-- "Totale Recuperi Acconto Aggio". Ogni selezione resta legata al periodo.

create table if not exists public.contabilita_cassa_debiti_selezionati (
  period_id uuid not null references public.conteggi_periods(id) on delete restrict,
  conteggio_id uuid not null references public.conteggi_tool(id) on delete restrict,
  selected_by uuid not null default auth.uid(),
  selected_at timestamptz not null default now(),
  primary key (period_id, conteggio_id)
);

alter table public.contabilita_cassa_debiti_selezionati enable row level security;

drop policy if exists contabilita_cassa_debiti_admin_select on public.contabilita_cassa_debiti_selezionati;
drop policy if exists contabilita_cassa_debiti_admin_insert on public.contabilita_cassa_debiti_selezionati;
drop policy if exists contabilita_cassa_debiti_admin_delete on public.contabilita_cassa_debiti_selezionati;

create policy contabilita_cassa_debiti_admin_select
on public.contabilita_cassa_debiti_selezionati for select
to authenticated
using (public.is_play_money_admin());

create policy contabilita_cassa_debiti_admin_insert
on public.contabilita_cassa_debiti_selezionati for insert
to authenticated
with check (public.is_play_money_admin() and selected_by = (select auth.uid()));

create policy contabilita_cassa_debiti_admin_delete
on public.contabilita_cassa_debiti_selezionati for delete
to authenticated
using (public.is_play_money_admin());

grant select, insert, delete on public.contabilita_cassa_debiti_selezionati to authenticated;
revoke all on public.contabilita_cassa_debiti_selezionati from anon;

create index if not exists contabilita_cassa_debiti_conteggio_idx
  on public.contabilita_cassa_debiti_selezionati(conteggio_id);
