-- Play Money Admin 13.0. Eseguire prima di pubblicare l'app aggiornata.
-- Conserva importo_iniziale come totale erogato per compatibilità con le app precedenti.
begin;
do $$ begin
  if to_regprocedure('public.is_play_money_admin_secure()') is null
     or to_regclass('public.debiti') is null or to_regclass('public.debiti_movimenti') is null then
    raise exception 'Installare prima lo schema Play Money Admin 12.1 completo';
  end if;
end $$;
alter table public.debiti add column if not exists importo_originario numeric;
alter table public.debiti add column if not exists data_erogazione date;
update public.debiti set importo_originario=importo_iniziale where importo_originario is null;
update public.debiti set data_erogazione=(created_at at time zone 'Europe/Rome')::date where data_erogazione is null;

create table if not exists public.debiti_erogazioni (
  id uuid primary key default gen_random_uuid(),
  debito_id uuid not null references public.debiti(id) on delete cascade,
  data date not null,
  importo numeric not null check(importo>0 and importo<=999999999 and importo=trunc(importo)),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists debiti_erogazioni_debito_data_idx on public.debiti_erogazioni(debito_id,data,created_at,id);
alter table public.debiti_erogazioni enable row level security;
revoke all on public.debiti_erogazioni from anon;
grant select,insert,update,delete on public.debiti_erogazioni to authenticated;
drop policy if exists debiti_erogazioni_admin on public.debiti_erogazioni;
create policy debiti_erogazioni_admin on public.debiti_erogazioni for all to authenticated
using ((select public.is_play_money_admin_secure())) with check ((select public.is_play_money_admin_secure()));

-- Una sola transazione per condizioni di rimborso, nuova erogazione e saldo.
-- SECURITY INVOKER mantiene le policy RLS già installate sulle tabelle esistenti.
create or replace function public.admin_v13_save_debito(
  p_id uuid, p_expected jsonb, p_patch jsonb, p_erogazione numeric default 0, p_data date default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.debiti%rowtype; n public.debiti%rowtype; k text; is_new boolean := p_expected is null;
  today_rome date := (now() at time zone 'Europe/Rome')::date;
begin
  if auth.uid() is null or not coalesce(public.is_play_money_admin_secure(),false) then raise exception 'Operazione riservata agli Admin' using errcode='42501'; end if;
  if p_id is null or p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'Dati mancanti'; end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not k=any(array['venue_id','importo_iniziale','modalita','periodicita','rata_tipo','rata_importo','note']) then raise exception 'Campo non modificabile: %', k; end if;
  end loop;
  if is_new then
    n := jsonb_populate_record(null::public.debiti,p_patch);
    n.id := p_id;
  else
    select * into d from public.debiti where id=p_id for update;
    if not found then raise exception 'Debito non disponibile'; end if;
    if to_jsonb(d) is distinct from p_expected then raise exception 'Il debito è cambiato. Chiudi e riapri la modifica per leggere il saldo aggiornato.' using errcode='40001'; end if;
    if p_patch ? 'importo_iniziale' then raise exception 'Usa Nuova erogazione per aggiungere un importo'; end if;
    n := jsonb_populate_record(d,p_patch);
    if n.venue_id is distinct from d.venue_id then raise exception 'Il locale di un debito con storico non può essere cambiato'; end if;
  end if;
  if n.venue_id is null or not exists(select 1 from public.venues where id=n.venue_id) then raise exception 'Seleziona un locale valido'; end if;
  perform pg_advisory_xact_lock(hashtextextended('debito:'||n.venue_id::text,0));
  if n.modalita is null or n.modalita not in ('contanti','bonifico') then raise exception 'Modalità non valida'; end if;
  if n.modalita='contanti' then
    if n.periodicita is null or n.periodicita not in ('ogni_conteggio','ogni_fine_mese') or n.rata_tipo is null or n.rata_tipo not in ('fisso','tutto_aggio') then raise exception 'Condizioni di rimborso non valide'; end if;
    if n.rata_tipo='fisso' and (n.rata_importo is null or n.rata_importo::text in ('NaN','Infinity','-Infinity') or n.rata_importo<=0 or n.rata_importo<>trunc(n.rata_importo) or n.rata_importo>999999999) then raise exception 'Importo rata non valido'; end if;
    if n.rata_tipo='tutto_aggio' then n.rata_importo:=null; end if;
  else n.periodicita:=null; n.rata_tipo:=null; n.rata_importo:=null;
  end if;
  if p_erogazione is null or p_erogazione::text in ('NaN','Infinity','-Infinity') or p_erogazione<0 or p_erogazione<>trunc(p_erogazione) or p_erogazione>999999999 then raise exception 'Erogazione non valida: usa euro interi'; end if;
  if is_new then
    if n.importo_iniziale is null or n.importo_iniziale::text in ('NaN','Infinity','-Infinity') or n.importo_iniziale<=0 or n.importo_iniziale<>trunc(n.importo_iniziale) or n.importo_iniziale>999999999 then raise exception 'Importo iniziale non valido'; end if;
    if p_erogazione<>0 then raise exception 'Indica solo l’importo iniziale alla creazione'; end if;
  elsif p_erogazione>0 and d.status not in ('attivo','estinto') then raise exception 'Non puoi erogare su un debito annullato';
  end if;
  if is_new or p_erogazione>0 then
    if p_data is null or p_data>today_rome or (not is_new and p_data<coalesce(d.data_erogazione,(d.created_at at time zone 'Europe/Rome')::date)) then raise exception 'Data erogazione non valida'; end if;
    if exists(select 1 from public.debiti where venue_id=n.venue_id and status='attivo' and id<>p_id) then raise exception 'Questo locale ha già un altro debito attivo'; end if;
  end if;
  if is_new then
    insert into public.debiti(id,venue_id,importo_iniziale,importo_originario,data_erogazione,residuo,modalita,periodicita,rata_tipo,rata_importo,status,note)
    values(p_id,n.venue_id,n.importo_iniziale,n.importo_iniziale,p_data,n.importo_iniziale,n.modalita,n.periodicita,n.rata_tipo,n.rata_importo,'attivo',nullif(btrim(n.note),'')) returning * into n;
  else
    if p_erogazione>0 then
      insert into public.debiti_erogazioni(debito_id,data,importo) values(p_id,p_data,p_erogazione);
    end if;
    update public.debiti set importo_iniziale=d.importo_iniziale+p_erogazione,
      importo_originario=coalesce(d.importo_originario,d.importo_iniziale),residuo=d.residuo+p_erogazione,
      status=case when p_erogazione>0 then 'attivo' else d.status end,
      modalita=n.modalita,periodicita=n.periodicita,rata_tipo=n.rata_tipo,rata_importo=n.rata_importo,
      note=nullif(btrim(n.note),''),updated_at=clock_timestamp()
      where id=p_id returning * into n;
  end if;
  return to_jsonb(n);
end $$;
revoke all on function public.admin_v13_save_debito(uuid,jsonb,jsonb,numeric,date) from public,anon;
grant execute on function public.admin_v13_save_debito(uuid,jsonb,jsonb,numeric,date) to authenticated;

create or replace function public.admin_v13_rimborso_debito(
  p_id uuid,p_expected jsonb,p_importo numeric,p_data date
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.debiti%rowtype; today_rome date := (now() at time zone 'Europe/Rome')::date;
begin
  if auth.uid() is null or not coalesce(public.is_play_money_admin_secure(),false) then raise exception 'Operazione riservata agli Admin' using errcode='42501'; end if;
  select * into d from public.debiti where id=p_id for update;
  if not found then raise exception 'Debito non disponibile'; end if;
  if p_expected is null or to_jsonb(d) is distinct from p_expected then raise exception 'Il debito è cambiato. Chiudi e riapri la decurtazione per leggere il saldo aggiornato.' using errcode='40001'; end if;
  if d.status not in ('attivo','estinto') then raise exception 'Debito annullato'; end if;
  if p_importo is null or p_importo::text in ('NaN','Infinity','-Infinity') or p_importo<=0 or p_importo<>trunc(p_importo) or p_importo>d.residuo then raise exception 'Il rimborso deve essere positivo e non superiore al residuo'; end if;
  if p_data is null or p_data>today_rome or p_data<coalesce(d.data_erogazione,(d.created_at at time zone 'Europe/Rome')::date) then raise exception 'Data rimborso non valida'; end if;
  insert into public.debiti_movimenti(debito_id,venue_id,data,user_id,operator_name,importo,residuo_prima,residuo_dopo,origine,note)
  values(d.id,d.venue_id,p_data,auth.uid(),'ADMIN',p_importo,d.residuo,d.residuo-p_importo,'manuale','Rimborso manuale da admin');
  update public.debiti set residuo=d.residuo-p_importo,status=case when d.residuo-p_importo=0 then 'estinto' else 'attivo' end,updated_at=clock_timestamp()
    where id=p_id returning * into d;
  return to_jsonb(d);
end $$;
revoke all on function public.admin_v13_rimborso_debito(uuid,jsonb,numeric,date) from public,anon;
grant execute on function public.admin_v13_rimborso_debito(uuid,jsonb,numeric,date) to authenticated;
notify pgrst, 'reload schema';
commit;
