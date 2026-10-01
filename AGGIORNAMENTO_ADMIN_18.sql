-- Admin 18: rettifiche limitate alla contabilità del periodo.
-- Nessuna modifica a conteggi_tool o al debito originale.
begin;
alter table public.contabilita_conteggi_debiti_selezionati
  add column if not exists amount_override numeric(12,2);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_debt_amount_valid' and conrelid = 'public.contabilita_conteggi_debiti_selezionati'::regclass) then
    alter table public.contabilita_conteggi_debiti_selezionati add constraint accounting_debt_amount_valid
      check (amount_override is null or (amount_override >= 0 and amount_override <= 999999999));
  end if;
end $$;

create or replace function public.admin_v18_save_accounting_debts(p_period_id uuid, p_rows jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare item jsonb; selected_count integer;
begin
  if auth.uid() is null or not public.is_play_money_admin() then
    raise exception 'Operazione consentita solo agli amministratori';
  end if;
  if p_period_id is null or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Selezione debiti non valida';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_period_id::text));
  if not exists (select 1 from public.conteggi_periods where id = p_period_id) then
    raise exception 'Periodo non trovato';
  end if;
  select count(distinct (value->>'conteggio_id')::uuid) into selected_count from jsonb_array_elements(p_rows);
  if selected_count <> jsonb_array_length(p_rows) then raise exception 'Debiti duplicati o non validi'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    if not exists (select 1 from public.conteggi_tool where id = (item->>'conteggio_id')::uuid and period_id = p_period_id and debito > 0) then
      raise exception 'Debito non disponibile nel periodo selezionato. Aggiorna e riprova.';
    end if;
    if item->>'amount_override' is not null and
       ((item->>'amount_override')::numeric < 0 or (item->>'amount_override')::numeric > 999999999 or
        (item->>'amount_override')::numeric <> round((item->>'amount_override')::numeric, 2)) then
      raise exception 'Importo contabile non valido';
    end if;
  end loop;
  delete from public.contabilita_conteggi_debiti_selezionati where period_id = p_period_id;
  insert into public.contabilita_conteggi_debiti_selezionati(period_id, conteggio_id, amount_override)
    select p_period_id, (value->>'conteggio_id')::uuid, (value->>'amount_override')::numeric from jsonb_array_elements(p_rows);
end $$;
revoke all on function public.admin_v18_save_accounting_debts(uuid,jsonb) from public, anon;
grant execute on function public.admin_v18_save_accounting_debts(uuid,jsonb) to authenticated;
commit;
