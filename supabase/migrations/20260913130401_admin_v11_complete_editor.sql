-- Play Money Admin 11. Richiede le migrazioni della 10.1 e Dipendenti 19.4.
-- Eseguire tutto il file nel SQL Editor. Nessun dato storico viene cancellato.
begin;
do $$ begin
  if to_regprocedure('public.is_play_money_admin_secure()') is null then
    raise exception 'Manca is_play_money_admin_secure(): installare prima la migrazione consegna giro della 19.4';
  end if;
end $$;
-- Controllo preventivo dello schema: errore leggibile prima di qualsiasi modifica.
do $$ declare item text; missing text[]:=array[]::text[]; begin
 foreach item in array array['conteggi_tool.id','conteggi_tool.created_at','conteggi_tool.locked','conteggi_tool.period_id','conteggi_tool.executed_by','conteggi_tool.user_id','conteggi_tool.executor_name_snapshot','conteggi_tool.rp_day2','conteggi_tool.rp_day3','conteggi_tool.rp_day4','conteggi_tool.debito_virt','conteggi_tool.bonus','conteggi_tool.assegno','movements_cassa.source_conteggio_id','movements_cassa.source_period_id','movements_cassa.giro_id','movements_cassa.executed_by','movements_cassa.deleted_at','conteggi_periods.is_active','dipendenti.auth_user_id'] loop
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=split_part(item,'.',1) and column_name=split_part(item,'.',2)) then missing:=array_append(missing,item); end if;
 end loop;
 if cardinality(missing)>0 then raise exception 'Schema precedente incompleto. Campi mancanti: %',array_to_string(missing,', '); end if;
end $$;
create schema if not exists private;
revoke all on schema private from public;
-- Nessun nuovo accesso allo schema privato per i client.

create table if not exists private.admin_v11_audit (
  id bigint generated always as identity primary key,
  table_name text not null, record_id text not null, actor_id uuid not null,
  action text not null, reason text, before_data jsonb, after_data jsonb,
  created_at timestamptz not null default clock_timestamp()
);
revoke all on private.admin_v11_audit from public, anon, authenticated;
create index if not exists admin_v11_audit_record_idx on private.admin_v11_audit(table_name,record_id,id desc);

create or replace function private.admin_v11_audit_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b jsonb; a jsonb;
begin
  if auth.uid() is not null and public.is_play_money_admin_secure() then
    if tg_op <> 'INSERT' then b := to_jsonb(old); end if;
    if tg_op <> 'DELETE' then a := to_jsonb(new); end if;
    if tg_table_name = 'dipendenti' then
      select jsonb_object_agg(key,value) into b from jsonb_each(coalesce(b,'{}')) where key = any(array['id','full_name','email','active','role']);
      select jsonb_object_agg(key,value) into a from jsonb_each(coalesce(a,'{}')) where key = any(array['id','full_name','email','active','role']);
    end if;
    if b is distinct from a then
      insert into private.admin_v11_audit(table_name,record_id,actor_id,action,reason,before_data,after_data)
      values(tg_table_name,coalesce(a->>'id',b->>'id',''),auth.uid(),tg_op,nullif(current_setting('playmoney.edit_reason',true),''),b,a);
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.admin_v11_audit_write() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['conteggi_tool','movements_cassa','conteggi_admin_overrides','simulazioni','venues','machines','machine_level_history','dipendenti','giri','giro_venue_assignments','automezzi','fondo_cassa_giornaliero','debiti','bonus','note_generiche','calendario_conteggi','debiti_movimenti','bonus_movimenti'] loop
    if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=t and c.relkind='r') then
      execute format('drop trigger if exists admin_v11_audit on public.%I',t);
      execute format('create trigger admin_v11_audit after insert or update or delete on public.%I for each row execute function private.admin_v11_audit_write()',t);
    end if;
  end loop;
end $$;

create or replace function private.admin_v11_history(p_table text,p_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then raise exception 'Accesso riservato all’Admin' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) order by id desc) from (select * from private.admin_v11_audit where table_name=p_table and (p_id is null or record_id=p_id) order by id desc limit 100) a),'[]');
end $$;
revoke all on function private.admin_v11_history(text,text) from public,anon;
revoke all on function private.admin_v11_history(text,text) from authenticated;
create or replace function public.admin_v11_history(p_table text,p_id text default null) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.is_play_money_admin_secure() then raise exception 'Operazione riservata all’Admin' using errcode='42501'; end if;
 return private.admin_v11_history(p_table,p_id); end $$;
revoke all on function public.admin_v11_history(text,text) from public,anon;
grant execute on function public.admin_v11_history(text,text) to authenticated;

-- Admin può correggere anche periodi chiusi; le regole dei dipendenti restano attive.
create or replace function public.attach_conteggio_period() returns trigger
language plpgsql security definer set search_path='' as $$
declare matched_period uuid; matched_count integer; admin_ok boolean := coalesce(public.is_play_money_admin_secure(),false);
begin
  select count(*), (array_agg(id))[1] into matched_count,matched_period from public.conteggi_periods
  where new.conteggio_date between date_from and date_to and (admin_ok or (status='open' and is_active=true));
  if matched_count <> 1 then raise exception 'La data deve appartenere a un solo periodo conteggi disponibile'; end if;
  new.period_id := matched_period;
  if new.user_id is null then new.user_id := auth.uid(); end if;
  if tg_op='UPDATE' and old.locked=true and not admin_ok then raise exception 'Conteggio bloccato dall’Admin'; end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function public.attach_conteggio_period() from public,anon,authenticated;

-- Gli snapshot storici di un giro non richiedono che il locale ne faccia parte oggi.
create or replace function public.guard_conteggio_giro() returns trigger
language plpgsql security definer set search_path='' as $$
declare admin_ok boolean := coalesce(public.is_play_money_admin_secure(),false); executor_name text;
begin
  if new.executed_by is null then new.executed_by := auth.uid(); end if;
  if auth.uid() is not null and not admin_ok and new.executed_by is distinct from auth.uid() then raise exception 'Esecutore non autorizzato' using errcode='42501'; end if;
  if new.giro_id is null or not exists(select 1 from public.giri where id=new.giro_id and (admin_ok or active=true)) then raise exception 'Giro non disponibile'; end if;
  if not admin_ok and not exists(select 1 from public.giro_venue_assignments where giro_id=new.giro_id and venue_id=new.venue_id and valid_to is null) then raise exception 'Il locale non appartiene al giro'; end if;
  select full_name into executor_name from public.dipendenti where auth_user_id=new.executed_by;
  if executor_name is null then raise exception 'Esecutore non associato a un dipendente'; end if;
  select name into new.giro_name_snapshot from public.giri where id=new.giro_id;
  new.executor_name_snapshot := executor_name;
  return new;
end $$;
revoke all on function public.guard_conteggio_giro() from public,anon,authenticated;

alter table public.conteggi_tool add column if not exists admin_edited_at timestamptz;
create or replace function private.admin_v11_stale_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(public.is_play_money_admin_secure(),false) then
    if old.locked then raise exception 'Conteggio bloccato dall’Admin'; end if;
    if old.admin_edited_at is not null and (new.updated_at is null or new.updated_at <= old.admin_edited_at) then
      raise exception 'Conteggio rettificato dall’Admin. Ricarica i dati aggiornati prima di modificare.' using errcode='40001';
    end if;
    new.admin_edited_at := old.admin_edited_at;
  end if;
  return new;
end $$;
revoke all on function private.admin_v11_stale_guard() from public,anon,authenticated;
drop trigger if exists a_admin_v11_stale_guard on public.conteggi_tool;
create trigger a_admin_v11_stale_guard before update on public.conteggi_tool for each row execute function private.admin_v11_stale_guard();

create or replace function private.admin_v11_edit_conteggio(p_id uuid,p_expected jsonb,p_patch jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  oldrow public.conteggi_tool%rowtype; n public.conteggi_tool%rowtype;
  period public.conteggi_periods%rowtype;
  k text; x numeric; count_link integer; debt_id uuid; bonus_id uuid;
  prior_effect numeric := 0; available numeric; 
  movement jsonb; debt jsonb; executor text; transfer_count integer;
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then raise exception 'Operazione riservata all’Admin' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,''))) < 3 then raise exception 'Indica il motivo della rettifica'; end if;
  if p_expected is null or p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'Dati di modifica mancanti'; end if;
  -- Stesso ordine di lock per due rettifiche e per la finalizzazione del periodo.
  perform 1 from public.conteggi_periods where id=(p_expected->>'period_id')::uuid or (p_patch->>'conteggio_date')::date between date_from and date_to order by id for update;
  select * into oldrow from public.conteggi_tool where id=p_id for update;
  if not found then raise exception 'Conteggio originale non disponibile'; end if;
  if to_jsonb(oldrow) is distinct from p_expected then raise exception 'Il conteggio è stato modificato da un altro dispositivo. Chiudi e riapri il dettaglio prima di salvare.' using errcode='40001'; end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not k=any(array['venue_id','giro_id','executed_by','conteggio_date','created_at','locked','esattore','acconti','carta','monete','riporto','uso_cassa','debito','debito_virt','assegno','bonus','rp_day2','rp_day3','rp_day4']) then raise exception 'Campo non modificabile: %',k; end if;
  end loop;
  n := jsonb_populate_record(oldrow,p_patch);
  foreach k in array array['esattore','acconti','carta','monete','riporto','uso_cassa','debito','debito_virt','assegno','bonus','rp_day2','rp_day3','rp_day4'] loop
    x := (to_jsonb(n)->>k)::numeric;
    if x is null or x::text in ('NaN','Infinity','-Infinity') or x<>trunc(x) or abs(x)>999999999 then raise exception 'Importo non valido: %',k; end if;
    if k=any(array['riporto','debito','bonus','rp_day2','rp_day3','rp_day4']) and x<0 then raise exception 'Importo negativo non consentito: %',k; end if;
  end loop;
  if n.locked is null then raise exception 'Stato del blocco non valido'; end if;
  if (select count(*) from public.conteggi_periods where n.conteggio_date between date_from and date_to)<>1 then raise exception 'Data fuori periodo o periodi sovrapposti'; end if;
  select * into period from public.conteggi_periods where n.conteggio_date between date_from and date_to;
  n.period_id := period.id;
  if not exists(select 1 from public.venues where id=n.venue_id) then raise exception 'Locale non valido'; end if;
  select full_name into executor from public.dipendenti where auth_user_id=n.executed_by;
  if executor is null then raise exception 'Dipendente non valido'; end if;
  if not exists(select 1 from public.giri where id=n.giro_id) then raise exception 'Giro non valido'; end if;
  perform pg_advisory_xact_lock(hashtextextended(period.id::text||':'||n.venue_id::text,0));
  if exists(select 1 from public.conteggi_tool where id<>p_id and venue_id=n.venue_id and conteggio_date between period.date_from and period.date_to) then raise exception 'Il locale ha già un conteggio nel periodo selezionato' using errcode='23505'; end if;
  perform set_config('playmoney.edit_reason',btrim(p_reason),true);

  -- Rettifica dei movimenti debito già agganciati; niente seconda decurtazione.
  if to_regclass('public.debiti_movimenti') is not null then
    select count(*), (array_agg(debito_id))[1] into count_link,debt_id from public.debiti_movimenti where conteggio_id=p_id;
    if count_link>1 then raise exception 'Più debiti collegati: riallineare i movimenti nella sezione Debiti prima della rettifica'; end if;
    if count_link=1 then
      select to_jsonb(d) into debt from public.debiti d where id=debt_id for update;
      select to_jsonb(m) into movement from public.debiti_movimenti m where conteggio_id=p_id for update;
      if n.venue_id is distinct from oldrow.venue_id and n.debito>0 then raise exception 'Sposta prima il debito collegato al nuovo locale oppure azzera il debito del conteggio'; end if;
      prior_effect := coalesce((movement->>'residuo_prima')::numeric,0)-coalesce((movement->>'residuo_dopo')::numeric,0);
      if n.debito is distinct from oldrow.debito then
        available := (debt->>'residuo')::numeric+prior_effect;
        if n.debito>available then raise exception 'Debito superiore al residuo disponibile (%)',available; end if;
        update public.debiti set residuo=available-n.debito,status=case when available-n.debito=0 then 'estinto' when status='estinto' then 'attivo' else status end,updated_at=clock_timestamp() where id=debt_id;
        if n.debito=0 then delete from public.debiti_movimenti where conteggio_id=p_id;
        else update public.debiti_movimenti set importo=n.debito,residuo_prima=available,residuo_dopo=available-n.debito where conteggio_id=p_id; end if;
      end if;
      update public.debiti_movimenti set user_id=n.executed_by,operator_name=executor,data=n.conteggio_date where conteggio_id=p_id;
    elsif n.debito>0 and (n.debito is distinct from oldrow.debito or n.venue_id is distinct from oldrow.venue_id) then
      select count(*),(array_agg(id))[1] into count_link,debt_id from public.debiti where venue_id=n.venue_id and status='attivo' and modalita='contanti';
      if count_link>1 then raise exception 'Più debiti attivi per il locale: specificare il debito nella sezione Debiti'; end if;
      if count_link=1 then
        select to_jsonb(d) into debt from public.debiti d where id=debt_id for update;
        available := (debt->>'residuo')::numeric;
        if n.debito>available then raise exception 'Debito superiore al residuo disponibile'; end if;
        insert into public.debiti_movimenti(debito_id,venue_id,data,user_id,operator_name,importo,residuo_prima,residuo_dopo,origine,conteggio_id)
          values(debt_id,n.venue_id,n.conteggio_date,n.executed_by,executor,n.debito,available,available-n.debito,'conteggio',p_id);
        update public.debiti set residuo=available-n.debito,status=case when available-n.debito=0 then 'estinto' else status end,updated_at=clock_timestamp() where id=debt_id;
      end if;
    end if;
  end if;
  if to_regclass('public.bonus_movimenti') is not null then
    select count(*),(array_agg(m.bonus_id))[1] into count_link,bonus_id from public.bonus_movimenti m where conteggio_id=p_id;
    if count_link>1 then raise exception 'Più bonus collegati: riallineare i movimenti nella sezione Bonus'; end if;
    if count_link=1 then
      if n.venue_id is distinct from oldrow.venue_id and n.bonus>0 then raise exception 'Azzera il bonus collegato prima di cambiare locale'; end if;
      if n.bonus=0 then delete from public.bonus_movimenti where conteggio_id=p_id;
      else update public.bonus_movimenti set importo=n.bonus,user_id=n.executed_by,operator_name=executor,data=n.conteggio_date where conteggio_id=p_id; end if;
    elsif n.bonus>0 and n.bonus is distinct from oldrow.bonus then
      select count(*),(array_agg(id))[1] into count_link,bonus_id from public.bonus where venue_id=n.venue_id and status='attivo';
      if count_link>1 then raise exception 'Più bonus attivi per il locale'; end if;
      if count_link=1 then insert into public.bonus_movimenti(bonus_id,venue_id,data,user_id,operator_name,importo,origine,conteggio_id) values(bonus_id,n.venue_id,n.conteggio_date,n.executed_by,executor,n.bonus,'conteggio',p_id); end if;
    end if;
  end if;
  -- totale_finale può essere una colonna generata: viene lasciata al DB se lo è.
  n.totale_finale := n.acconti+n.carta+n.monete+n.riporto+n.assegno-n.esattore-n.uso_cassa-n.debito;
  execute format('update public.conteggi_tool set venue_id=($1).venue_id,giro_id=($1).giro_id,executed_by=($1).executed_by,user_id=($1).executed_by,
    conteggio_date=($1).conteggio_date,created_at=($1).created_at,period_id=($1).period_id,locked=($1).locked,
    esattore=($1).esattore,acconti=($1).acconti,carta=($1).carta,monete=($1).monete,riporto=($1).riporto,uso_cassa=($1).uso_cassa,
    debito=($1).debito,debito_virt=($1).debito_virt,assegno=($1).assegno,bonus=($1).bonus,rp_day2=($1).rp_day2,rp_day3=($1).rp_day3,rp_day4=($1).rp_day4,
    %s admin_edited_at=clock_timestamp(),updated_at=clock_timestamp() where id=$2', case when exists(select 1 from pg_attribute where attrelid='public.conteggi_tool'::regclass and attname='totale_finale' and attgenerated<>'') then '' else 'totale_finale=($1).totale_finale,' end) using n,p_id;
  select * into n from public.conteggi_tool where id=p_id;
  if n.totale_finale is distinct from n.acconti+n.carta+n.monete+n.riporto+n.assegno-n.esattore-n.uso_cassa-n.debito then raise exception 'Formula totale del database non allineata a Dipendenti 19.4'; end if;

  -- I trasferimenti verso il periodo successivo mantengono identità e data.
  select count(*) into transfer_count from public.movements_cassa where source_conteggio_id=p_id and origine='chiusura_conteggio';
  if oldrow.period_id is distinct from n.period_id and transfer_count>0 then raise exception 'Conteggio con riporto trasferito: correggi prima il trasferimento prima di spostarlo di periodo'; end if;
  update public.movements_cassa set venue_id=n.venue_id,giro_id=n.giro_id,executed_by=n.executed_by,da_riportare=n.riporto
    where source_conteggio_id=p_id and origine='chiusura_conteggio' and deleted_at is null;
  if period.status='closed' and transfer_count=0 and n.riporto>0 then
    insert into public.movements_cassa(client_id,work_date,venue_id,acconto,recupero,da_riportare,note,created_by,origine,source_conteggio_id,source_period_id,giro_id,executed_by)
      values('finalize-'||period.id::text||'-'||p_id::text,period.date_to+1,n.venue_id,0,0,n.riporto,'Riporto rettificato da Admin 11',auth.uid(),'chiusura_conteggio',p_id,period.id,n.giro_id,n.executed_by);
  end if;
  return jsonb_build_object('success',true,'row',to_jsonb(n));
end $$;
revoke all on function private.admin_v11_edit_conteggio(uuid,jsonb,jsonb,text) from public,anon;
revoke all on function private.admin_v11_edit_conteggio(uuid,jsonb,jsonb,text) from authenticated;
create or replace function public.admin_v11_edit_conteggio(p_id uuid,p_expected jsonb,p_patch jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.is_play_money_admin_secure() then raise exception 'Operazione riservata all’Admin' using errcode='42501'; end if;
 return private.admin_v11_edit_conteggio(p_id,p_expected,p_patch,p_reason); end $$;
revoke all on function public.admin_v11_edit_conteggio(uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.admin_v11_edit_conteggio(uuid,jsonb,jsonb,text) to authenticated;

-- Centro modifiche: whitelist per tabella, confronto concorrenza e audit atomico.
create or replace function private.admin_v11_edit_record(p_table text,p_id text,p_expected jsonb,p_patch jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare allowed text[]; current_row jsonb; next_row jsonb; k text; setlist text; x numeric; name_value text;
begin
 if auth.uid() is null or not public.is_play_money_admin_secure() then raise exception 'Accesso riservato all’Admin' using errcode='42501'; end if;
 if p_expected is null or p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'Modifica vuota'; end if;
 if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Indica il motivo della modifica'; end if;
 allowed := case p_table
 when 'movements_cassa' then array['work_date','venue_id','created_by','acconto','recupero','da_riportare','note']
 when 'simulazioni' then array['work_date','venue_id','user_id','utile_lordo','acconti','carta','monete','da_riportare','da_riportare_sospeso','note']
 when 'dipendenti' then array['full_name','active']
 when 'venues' then array['name','city','code','active']
 when 'machines' then array['name','fondo','level','active']
 when 'giri' then array['name','default_employee_id','sort_order','active']
 when 'automezzi' then array['name','plate','active']
 when 'fondo_cassa_giornaliero' then array['work_date','created_by','vehicle_id','km','rifornimento']
 else null end;
 if allowed is null then raise exception 'Usa la sezione dedicata per modificare questi dati'; end if;
 for k in select jsonb_object_keys(p_patch) loop
   if not k=any(allowed) then raise exception 'Campo non autorizzato: %',k; end if;
 end loop;
 execute format('select to_jsonb(t) from public.%I t where id::text=$1 for update',p_table) into current_row using p_id;
 if current_row is null then raise exception 'Registrazione non trovata'; end if;
 if not current_row @> p_expected then raise exception 'Dati cambiati su un altro dispositivo. Chiudi e riapri la registrazione.' using errcode='40001'; end if;
 if p_table='movements_cassa' and current_row->>'origine'='chiusura_conteggio' and exists(select 1 from jsonb_object_keys(p_patch) as keys(value) where keys.value<>'note') then
   raise exception 'Questo movimento deriva da un conteggio finalizzato: correggi il conteggio originale per aggiornare il riporto.';
 end if;
 next_row := current_row || p_patch;
 for k in select jsonb_object_keys(p_patch) loop
   if k=any(array['acconto','recupero','da_riportare','utile_lordo','acconti','carta','monete','da_riportare_sospeso','fondo','level','sort_order','rifornimento']) then
     x := (p_patch->>k)::numeric;
     if x is null or x::text in ('NaN','Infinity','-Infinity') or abs(x)>999999999 or x<>trunc(x) then raise exception 'Importo non valido: %',k; end if;
     if k=any(array['recupero','da_riportare','da_riportare_sospeso','fondo','rifornimento']) and x<0 then raise exception 'Importo negativo non consentito: %',k; end if;
   end if;
   if k=any(array['name','full_name','plate','work_date']) and nullif(btrim(p_patch->>k),'') is null then raise exception 'Campo obbligatorio: %',k; end if;
 end loop;
 if p_patch ? 'venue_id' and not exists(select 1 from public.venues where id=next_row->>'venue_id') then raise exception 'Locale non valido'; end if;
 if p_patch ? 'created_by' or p_patch ? 'user_id' then
   select full_name into name_value from public.dipendenti where auth_user_id=(case when p_patch ? 'user_id' then p_patch->>'user_id' else p_patch->>'created_by' end)::uuid;
   if name_value is null then raise exception 'Dipendente non valido'; end if;
 end if;
 if p_table='dipendenti' and (current_row->>'auth_user_id')::uuid=auth.uid() and p_patch->>'active'='false' then raise exception 'Non puoi disattivare il tuo account corrente'; end if;
 if p_table='simulazioni' then
   p_patch := p_patch || jsonb_build_object('total',coalesce((next_row->>'acconti')::numeric,0)+coalesce((next_row->>'carta')::numeric,0)+coalesce((next_row->>'monete')::numeric,0)+coalesce((next_row->>'da_riportare')::numeric,0)-coalesce((next_row->>'utile_lordo')::numeric,0)-coalesce((next_row->>'da_riportare_sospeso')::numeric,0));
   if p_patch ? 'venue_id' then select name into name_value from public.venues where id=next_row->>'venue_id'; p_patch:=p_patch||jsonb_build_object('venue_name',name_value); end if;
   if p_patch ? 'user_id' then select full_name into name_value from public.dipendenti where auth_user_id=(next_row->>'user_id')::uuid; p_patch:=p_patch||jsonb_build_object('operator_name',name_value,'created_by',next_row->'user_id'); end if;
 end if;
 if p_table='fondo_cassa_giornaliero' and p_patch ? 'vehicle_id' then
   select to_jsonb(v) into next_row from public.automezzi v where id=(p_patch->>'vehicle_id')::uuid;
   if next_row is null then raise exception 'Automezzo non valido'; end if;
   p_patch:=p_patch||jsonb_build_object('vehicle_name_snapshot',next_row->'name','vehicle_plate_snapshot',next_row->'plate','mezzo',(next_row->>'name')||' – '||(next_row->>'plate'));
 end if;
 if current_row ? 'updated_at' then p_patch:=p_patch||jsonb_build_object('updated_at',clock_timestamp()); end if;
 if p_table='machines' and current_row ? 'updated_by' then p_patch:=p_patch||jsonb_build_object('updated_by',auth.uid()); end if;
 perform set_config('playmoney.edit_reason',btrim(p_reason),true);
 select string_agg(format('%I = r.%I',key,key),',') into setlist from jsonb_object_keys(p_patch) key;
 execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) r where t.id::text=$2 returning to_jsonb(t)',p_table,setlist,p_table) into next_row using current_row||p_patch,p_id;
 return jsonb_build_object('success',true,'id',p_id);
end $$;
revoke all on function private.admin_v11_edit_record(text,text,jsonb,jsonb,text) from public,anon;
revoke all on function private.admin_v11_edit_record(text,text,jsonb,jsonb,text) from authenticated;
create or replace function public.admin_v11_edit_record(p_table text,p_id text,p_expected jsonb,p_patch jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not public.is_play_money_admin_secure() then raise exception 'Operazione riservata all’Admin' using errcode='42501'; end if;
 return private.admin_v11_edit_record(p_table,p_id,p_expected,p_patch,p_reason); end $$;
revoke all on function public.admin_v11_edit_record(text,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.admin_v11_edit_record(text,text,jsonb,jsonb,text) to authenticated;
notify pgrst, 'reload schema';
commit;
