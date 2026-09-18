-- Admin 14: shared office fund, immutable audit, editable period transfers.
-- Existing movements, periods and snapshots are preserved on installation.
create schema if not exists office_internal;
revoke all on schema office_internal from public,anon,authenticated;

create table if not exists public.cassa_ufficio_fondo (
  id boolean primary key default true check (id),
  amount numeric(14,2) not null default 0 check (amount >= 0 and amount <= 999999999),
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.cassa_ufficio_fondo(id,amount) values(true,0) on conflict(id) do nothing;
alter table public.cassa_ufficio_fondo enable row level security;
revoke all on public.cassa_ufficio_fondo from anon, authenticated;
grant select, update(amount) on public.cassa_ufficio_fondo to authenticated;
drop policy if exists office_fund_read on public.cassa_ufficio_fondo;
create policy office_fund_read on public.cassa_ufficio_fondo for select to authenticated using ((select public.is_play_money_admin_secure()));
drop policy if exists office_fund_update on public.cassa_ufficio_fondo;
create policy office_fund_update on public.cassa_ufficio_fondo for update to authenticated using ((select public.is_play_money_admin_secure())) with check ((select public.is_play_money_admin_secure()));

create table if not exists public.cassa_ufficio_fondo_storico (
  id uuid primary key default gen_random_uuid(),
  previous_amount numeric(14,2) not null,
  amount numeric(14,2) not null,
  changed_at timestamptz not null default now(),
  changed_by uuid not null
);
alter table public.cassa_ufficio_fondo_storico enable row level security;
revoke all on public.cassa_ufficio_fondo_storico from anon,authenticated;
grant select on public.cassa_ufficio_fondo_storico to authenticated;
drop policy if exists office_fund_history_read on public.cassa_ufficio_fondo_storico;
create policy office_fund_history_read on public.cassa_ufficio_fondo_storico for select to authenticated using ((select public.is_play_money_admin_secure()));
create index if not exists office_fund_history_date on public.cassa_ufficio_fondo_storico(changed_at desc);

-- Privileged only to append protected audit rows, never client-writable history.
create or replace function office_internal.office_fund_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then raise exception 'Operazione riservata agli Admin'; end if;
  if new.amount is distinct from old.amount then
    insert into public.cassa_ufficio_fondo_storico(previous_amount,amount,changed_by) values(old.amount,new.amount,auth.uid());
    new.version := old.version + 1;
    new.updated_at := clock_timestamp();
    new.updated_by := auth.uid();
  end if;
  return new;
end; $$;
revoke all on function office_internal.office_fund_audit() from public,anon,authenticated;
drop trigger if exists office_fund_audit on public.cassa_ufficio_fondo;
create trigger office_fund_audit before update on public.cassa_ufficio_fondo for each row execute function office_internal.office_fund_audit();

-- Atomically edit the live transfer AND its archived copy, without reopening
-- conteggi or changing any conteggio. The period lock serializes edits.
create or replace function office_internal.admin_v14_transfer(
  p_period_id uuid, p_id uuid, p_delete boolean, p_amount numeric,
  p_destination text, p_date date, p_note text, p_expected jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_period public.conteggi_periods%rowtype;
  v_live public.cassa_trasferimenti%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_snapshot jsonb;
  v_transfers jsonb;
  v_total numeric;
  v_id uuid := coalesce(p_id,gen_random_uuid());
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then raise exception 'Operazione riservata agli Admin'; end if;
  select * into v_period from public.conteggi_periods where id=p_period_id for update;
  if not found then raise exception 'Periodo non trovato'; end if;
  select cassa_trasferimenti_data into v_snapshot from public.conteggi_archive_snapshots where period_id=p_period_id for update;
  if found then v_snapshot := coalesce(v_snapshot,'[]'::jsonb); end if;
  if p_delete is null then raise exception 'Operazione non valida'; end if;
  if p_id is not null then
    select * into v_live from public.cassa_trasferimenti where id=p_id and period_id=p_period_id for update;
    if found then v_before := to_jsonb(v_live);
    else select x into v_before from jsonb_array_elements(coalesce(v_snapshot,'[]'::jsonb)) x where x->>'id'=p_id::text;
    end if;
    if v_before is null then raise exception 'Movimento non trovato o già eliminato. Aggiorna la pagina.'; end if;
    if p_expected is null or jsonb_build_object('amount',v_before->'amount','destination',v_before->'destination','transfer_date',v_before->'transfer_date','note',coalesce(v_before->'note','null'::jsonb)) is distinct from p_expected then
      raise exception 'Movimento modificato da un altro dispositivo. Aggiorna la pagina.';
    end if;
  elsif p_delete then raise exception 'Seleziona il movimento da eliminare';
  end if;
  if p_delete then
    delete from public.cassa_trasferimenti where id=p_id and period_id=p_period_id;
  else
    if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount>999999999 or p_amount<>round(p_amount,2) then raise exception 'Importo non valido'; end if;
    if length(btrim(coalesce(p_destination,'')))=0 then raise exception 'Inserisci la destinazione'; end if;
    if p_date is null or p_date<v_period.date_from or p_date>v_period.date_to then raise exception 'La data deve rientrare nel periodo selezionato'; end if;
    if v_before is null or v_live.id is null then
      insert into public.cassa_trasferimenti(id,period_id,transfer_date,amount,destination,note,created_by,created_at)
      values(v_id,p_period_id,p_date,p_amount,btrim(p_destination),nullif(btrim(coalesce(p_note,'')),''),coalesce((v_before->>'created_by')::uuid,auth.uid()),coalesce((v_before->>'created_at')::timestamptz,now())) returning to_jsonb(cassa_trasferimenti.*) into v_after;
    else
      update public.cassa_trasferimenti set transfer_date=p_date,amount=p_amount,destination=btrim(p_destination),note=nullif(btrim(coalesce(p_note,'')),'')
      where id=p_id and period_id=p_period_id returning to_jsonb(cassa_trasferimenti.*) into v_after;
    end if;
  end if;
  -- Only update the affected archive entry. Preserve other archived transfers.
  if v_snapshot is not null then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into v_transfers from jsonb_array_elements(v_snapshot) x where x->>'id'<>v_id::text;
    if not p_delete then v_transfers := v_transfers || jsonb_build_array(v_after); end if;
    select coalesce(jsonb_agg(x order by x->>'transfer_date' desc,x->>'created_at' desc),'[]'::jsonb),coalesce(sum((x->>'amount')::numeric),0) into v_transfers,v_total from jsonb_array_elements(v_transfers) x;
    update public.conteggi_archive_snapshots set cassa_trasferimenti_data=v_transfers,
      cassa_summary_data=coalesce(cassa_summary_data,'{}'::jsonb) || jsonb_build_object('trasferimenti_totale',v_total,'trasferimenti_count',jsonb_array_length(v_transfers),'cassa_disponibile',coalesce((cassa_summary_data->>'cassa_generata')::numeric,0)-v_total)
      where period_id=p_period_id;
  end if;
  return jsonb_build_object('success',true,'transfer',v_after);
end; $$;
revoke all on function office_internal.admin_v14_transfer(uuid,uuid,boolean,numeric,text,date,text,jsonb) from public,anon,authenticated;
grant usage on schema office_internal to authenticated;
grant execute on function office_internal.admin_v14_transfer(uuid,uuid,boolean,numeric,text,date,text,jsonb) to authenticated;
create or replace function public.admin_v14_transfer(
  p_period_id uuid,p_id uuid,p_delete boolean,p_amount numeric,p_destination text,p_date date,p_note text,p_expected jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select office_internal.admin_v14_transfer(p_period_id,p_id,p_delete,p_amount,p_destination,p_date,p_note,p_expected);
$$;
revoke all on function public.admin_v14_transfer(uuid,uuid,boolean,numeric,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_v14_transfer(uuid,uuid,boolean,numeric,text,date,text,jsonb) to authenticated;
notify pgrst,'reload schema';
