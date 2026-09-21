-- Play Money Admin 14: range Cassa componibile e Fondo Cassa a movimenti.

create table if not exists public.cassa_ufficio_fondo_movimenti (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(btrim(description)) between 1 and 120),
  amount numeric(14,2) not null check (amount >= 0 and amount <= 999999999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
alter table public.cassa_ufficio_fondo_movimenti enable row level security;
revoke all on public.cassa_ufficio_fondo_movimenti from anon, authenticated;
grant select on public.cassa_ufficio_fondo_movimenti to authenticated;
drop policy if exists office_fund_movements_read on public.cassa_ufficio_fondo_movimenti;
create policy office_fund_movements_read on public.cassa_ufficio_fondo_movimenti
for select to authenticated using ((select public.is_play_money_admin_secure()));
create index if not exists office_fund_movements_updated_idx on public.cassa_ufficio_fondo_movimenti(updated_at desc);

-- Conserva il Fondo Cassa già impostato convertendolo nel primo movimento.
insert into public.cassa_ufficio_fondo_movimenti(description, amount, created_by, updated_by)
select 'FONDO CASSA', amount, updated_by, updated_by
from public.cassa_ufficio_fondo
where id=true and amount<>0
  and not exists (select 1 from public.cassa_ufficio_fondo_movimenti);

create or replace function office_internal.admin_v14_fund_movement(
  p_id uuid, p_delete boolean, p_description text, p_amount numeric, p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_row public.cassa_ufficio_fondo_movimenti%rowtype;
  v_saved public.cassa_ufficio_fondo_movimenti%rowtype;
  v_total numeric;
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then raise exception 'Operazione riservata agli Admin'; end if;
  if p_delete is null then raise exception 'Operazione non valida'; end if;
  if p_id is not null then
    select * into v_row from public.cassa_ufficio_fondo_movimenti where id=p_id for update;
    if not found then raise exception 'Movimento non trovato. Aggiorna la pagina.'; end if;
    if p_expected_updated_at is null or v_row.updated_at is distinct from p_expected_updated_at then
      raise exception 'Movimento modificato da un altro dispositivo. Aggiorna la pagina.';
    end if;
  elsif p_delete then raise exception 'Seleziona il movimento da eliminare';
  end if;
  if p_delete then
    delete from public.cassa_ufficio_fondo_movimenti where id=p_id;
  else
    if length(btrim(coalesce(p_description,'')))=0 then raise exception 'Inserisci la voce'; end if;
    if length(btrim(p_description))>120 then raise exception 'La voce è troppo lunga'; end if;
    if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<0 or p_amount>999999999 or p_amount<>round(p_amount,2) then raise exception 'Importo non valido'; end if;
    if p_id is null then
      insert into public.cassa_ufficio_fondo_movimenti(description,amount,created_by,updated_by)
      values(btrim(p_description),p_amount,auth.uid(),auth.uid()) returning * into v_saved;
    else
      update public.cassa_ufficio_fondo_movimenti
      set description=btrim(p_description),amount=p_amount,updated_at=clock_timestamp(),updated_by=auth.uid()
      where id=p_id returning * into v_saved;
    end if;
  end if;
  select coalesce(sum(amount),0) into v_total from public.cassa_ufficio_fondo_movimenti;
  update public.cassa_ufficio_fondo set amount=v_total where id=true;
  return jsonb_build_object('success',true,'movement',to_jsonb(v_saved),'total',v_total);
end; $$;
revoke all on function office_internal.admin_v14_fund_movement(uuid,boolean,text,numeric,timestamptz) from public,anon,authenticated;
grant usage on schema office_internal to authenticated;
grant execute on function office_internal.admin_v14_fund_movement(uuid,boolean,text,numeric,timestamptz) to authenticated;

create or replace function public.admin_v14_fund_movement(
  p_id uuid, p_delete boolean, p_description text, p_amount numeric, p_expected_updated_at timestamptz
) returns jsonb language sql security invoker set search_path='' as $$
  select office_internal.admin_v14_fund_movement(p_id,p_delete,p_description,p_amount,p_expected_updated_at);
$$;
revoke all on function public.admin_v14_fund_movement(uuid,boolean,text,numeric,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_v14_fund_movement(uuid,boolean,text,numeric,timestamptz) to authenticated;

create or replace function office_internal.get_cassa_intervallo(p_period_id uuid,p_date_from date,p_date_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_period public.conteggi_periods%rowtype;
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then raise exception 'Operazione riservata agli Admin'; end if;
  select * into v_period from public.conteggi_periods where id=p_period_id;
  if not found then raise exception 'Periodo non trovato'; end if;
  if p_date_from is null or p_date_to is null or p_date_from>p_date_to or p_date_from<v_period.date_from or p_date_to>v_period.date_to then
    raise exception 'Intervallo non valido per il periodo selezionato';
  end if;
  return (with m as (
    select coalesce(sum(coalesce(acconto,0)),0) acconti,coalesce(sum(coalesce(recupero,0)),0) recuperi,
      coalesce(sum(coalesce(da_riportare,0)),0) da_riportare,count(*) movimenti_count
    from public.movements_cassa where deleted_at is null and work_date between p_date_from and p_date_to
  ), t as (
    select coalesce(sum(amount),0) trasferimenti_totale,count(*) trasferimenti_count,
      coalesce(jsonb_agg(to_jsonb(x) order by transfer_date desc,created_at desc),'[]'::jsonb) transfers
    from public.cassa_trasferimenti x where period_id=p_period_id and transfer_date between p_date_from and p_date_to
  ) select jsonb_build_object('period',to_jsonb(v_period),'date_from',p_date_from,'date_to',p_date_to,
    'summary',jsonb_build_object('period_id',p_period_id,'date_from',p_date_from,'date_to',p_date_to,
      'acconti',m.acconti,'recuperi',m.recuperi,'da_riportare',m.da_riportare,'cassa_generata',m.acconti,
      'trasferimenti_totale',t.trasferimenti_totale,'cassa_disponibile',m.acconti-t.trasferimenti_totale,
      'movimenti_count',m.movimenti_count,'trasferimenti_count',t.trasferimenti_count),'transfers',t.transfers)
    from m cross join t);
end; $$;
revoke all on function office_internal.get_cassa_intervallo(uuid,date,date) from public,anon,authenticated;
grant execute on function office_internal.get_cassa_intervallo(uuid,date,date) to authenticated;
create or replace function public.get_cassa_intervallo(p_period_id uuid,p_date_from date,p_date_to date)
returns jsonb language sql stable security invoker set search_path='' as $$
  select office_internal.get_cassa_intervallo(p_period_id,p_date_from,p_date_to);
$$;
revoke all on function public.get_cassa_intervallo(uuid,date,date) from public,anon,authenticated;
grant execute on function public.get_cassa_intervallo(uuid,date,date) to authenticated;
notify pgrst,'reload schema';
