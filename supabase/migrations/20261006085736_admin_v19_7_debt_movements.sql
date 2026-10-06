begin;
-- Edit one ledger movement and its financial effect in a single transaction.
create or replace function public.admin_v19_7_debt_movement(
  p_debito uuid, p_kind text, p_movement uuid, p_expected_debt jsonb,
  p_expected_movement jsonb, p_amount numeric, p_date date, p_delete boolean,
  p_expected_conteggio jsonb default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 d public.debiti%rowtype; e public.debiti_erogazioni%rowtype; m public.debiti_movimenti%rowtype;
 c public.conteggi_tool%rowtype; old_amount numeric; new_amount numeric; delta numeric;
 new_total numeric; new_remaining numeric; initial_date date;
begin
 if auth.uid() is null or not coalesce(public.is_play_money_admin_secure(),false) then
  raise exception 'Operazione riservata agli Admin' using errcode='42501';
 end if;
 if p_kind is null or p_kind not in ('initial','disbursement','repayment') or p_delete is null then raise exception 'Tipo movimento non valido'; end if;
 -- Match the existing conteggio editor lock order: period, conteggio, debt, movement.
 if p_kind='repayment' then
  select * into m from public.debiti_movimenti where id=p_movement and debito_id=p_debito;
  if not found then raise exception 'Movimento non disponibile'; end if;
  if m.conteggio_id is not null then
   select * into c from public.conteggi_tool where id=m.conteggio_id;
   if not found then raise exception 'Conteggio collegato non disponibile'; end if;
   perform 1 from public.conteggi_periods where id=c.period_id order by id for update;
   select * into c from public.conteggi_tool where id=m.conteggio_id for update;
   if p_expected_conteggio is null or to_jsonb(c) is distinct from p_expected_conteggio then
    raise exception 'Il conteggio è cambiato. Chiudi e riapri il movimento.' using errcode='40001';
   end if;
  end if;
 end if;
 select * into d from public.debiti where id=p_debito for update;
 if not found then raise exception 'Debito non disponibile'; end if;
 if p_expected_debt is null or to_jsonb(d) is distinct from p_expected_debt then
  raise exception 'Il debito è cambiato. Chiudi e riapri i movimenti.' using errcode='40001';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('debito:'||d.venue_id::text,0));
 initial_date:=coalesce(d.data_erogazione,(d.created_at at time zone 'Europe/Rome')::date);
 new_amount:=case when p_delete then 0 else p_amount end;
 if new_amount is null or new_amount::text in ('NaN','Infinity','-Infinity') or
    new_amount<>trunc(new_amount) or new_amount>999999999 or new_amount<0 or (not p_delete and new_amount=0) then
  raise exception 'Inserisci un importo positivo in euro interi';
 end if;
 if not p_delete and (p_date is null or p_date>(now() at time zone 'Europe/Rome')::date or
    (p_kind<>'initial' and p_date<initial_date)) then raise exception 'Data movimento non valida'; end if;
 perform set_config('playmoney.edit_reason','Rettifica movimento dalla sezione Debiti',true);
 if p_kind='initial' then
  old_amount:=coalesce(d.importo_originario,d.importo_iniziale);
  if old_amount=0 then raise exception 'Erogazione iniziale già rimossa'; end if;
  if not p_delete and (exists(select 1 from public.debiti_erogazioni where debito_id=p_debito and data<p_date)
      or exists(select 1 from public.debiti_movimenti where debito_id=p_debito and data<p_date)) then
   raise exception 'La data iniziale deve precedere gli altri movimenti';
  end if;
 elsif p_kind='disbursement' then
  select * into e from public.debiti_erogazioni where id=p_movement and debito_id=p_debito for update;
  if not found then raise exception 'Erogazione non disponibile'; end if;
  if p_expected_movement is null or to_jsonb(e) is distinct from p_expected_movement then
   raise exception 'Il movimento è cambiato. Chiudi e riapri lo storico.' using errcode='40001';
  end if;
  old_amount:=e.importo;
 else
  select * into m from public.debiti_movimenti where id=p_movement and debito_id=p_debito for update;
  if not found then raise exception 'Rimborso non disponibile'; end if;
  if p_expected_movement is null or to_jsonb(m) is distinct from p_expected_movement then
   raise exception 'Il movimento è cambiato. Chiudi e riapri lo storico.' using errcode='40001';
  end if;
  old_amount:=m.importo;
  if m.conteggio_id is not null then
   if not p_delete and p_date is distinct from m.data then raise exception 'Modifica la data dalla sezione Conteggi'; end if;
   -- Reuse existing reconciliation, generated totals and audit for linked reimbursements.
   perform public.admin_v11_edit_conteggio(c.id,to_jsonb(c),jsonb_build_object('debito',new_amount),'Rettifica rimborso dalla sezione Debiti');
   select * into d from public.debiti where id=p_debito;
   if d.residuo>0 and d.status='estinto' then
    if exists(select 1 from public.debiti where venue_id=d.venue_id and id<>d.id and status='attivo') then raise exception 'Questo locale ha già un altro debito attivo'; end if;
    update public.debiti set status='attivo',updated_at=clock_timestamp() where id=p_debito returning * into d;
   end if;
   return to_jsonb(d);
  end if;
 end if;
 delta:=new_amount-old_amount;
 new_total:=d.importo_iniziale+case when p_kind='repayment' then 0 else delta end;
 new_remaining:=d.residuo+case when p_kind='repayment' then -delta else delta end;
 if new_total<0 or new_remaining<0 or new_remaining>new_total then
  raise exception 'Importo incompatibile con i rimborsi già registrati. Correggi prima i rimborsi.';
 end if;
 if new_remaining>0 and d.status='estinto' and exists(select 1 from public.debiti where venue_id=d.venue_id and id<>d.id and status='attivo') then
  raise exception 'Questo locale ha già un altro debito attivo';
 end if;
 if p_kind='initial' then
  update public.debiti set importo_originario=new_amount,data_erogazione=case when p_delete then data_erogazione else p_date end where id=p_debito;
 elsif p_kind='disbursement' then
  if p_delete then delete from public.debiti_erogazioni where id=e.id;
  else update public.debiti_erogazioni set importo=new_amount,data=p_date where id=e.id; end if;
 else
  if p_delete then delete from public.debiti_movimenti where id=m.id;
  else update public.debiti_movimenti set importo=new_amount,data=p_date,residuo_prima=d.residuo+old_amount,residuo_dopo=new_remaining where id=m.id; end if;
 end if;
 update public.debiti set importo_iniziale=new_total,residuo=new_remaining,
   status=case when status='annullato' then status when new_remaining=0 then 'estinto' else 'attivo' end,
   updated_at=clock_timestamp() where id=p_debito returning * into d;
 return to_jsonb(d);
end $$;
revoke all on function public.admin_v19_7_debt_movement(uuid,text,uuid,jsonb,jsonb,numeric,date,boolean,jsonb) from public,anon;
grant execute on function public.admin_v19_7_debt_movement(uuid,text,uuid,jsonb,jsonb,numeric,date,boolean,jsonb) to authenticated;

-- Keep before/after history for individual disbursement corrections too.
drop trigger if exists admin_v19_7_erogazioni_audit on public.debiti_erogazioni;
create trigger admin_v19_7_erogazioni_audit after insert or update or delete on public.debiti_erogazioni
for each row execute function private.admin_v11_audit_write();
commit;
