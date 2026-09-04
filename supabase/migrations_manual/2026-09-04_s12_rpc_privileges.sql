-- S12 - Matrice EXECUTE minima per le RPC SECURITY DEFINER.
--
-- Applicare soltanto dopo S04 e S07, nella finestra di manutenzione.
-- La migrazione è transazionale: qualsiasi controllo fallito annulla tutto.

begin;

do $$
begin
  if to_regclass('private.play_money_admins') is null
     or to_regprocedure('public.is_play_money_admin_secure()') is null then
    raise exception 'S12 interrotta: prerequisiti Admin sicuri mancanti';
  end if;

  if to_regprocedure('public.record_machine_level(text,numeric,timestamp with time zone)') is null
     or to_regprocedure('public.correct_latest_machine_level(text,text,numeric)') is null
     or to_regprocedure('public.preview_venue_deletion(text)') is null
     or to_regprocedure('public.delete_venue_permanently(text,text)') is null then
    raise exception 'S12 interrotta: una RPC da proteggere non esiste';
  end if;

  if to_regprocedure('private.record_machine_level_s12_impl(text,numeric,timestamp with time zone)') is not null
     or to_regprocedure('private.correct_latest_machine_level_s12_impl(text,text,numeric)') is not null
     or to_regprocedure('private.preview_venue_deletion_s12_impl(text)') is not null
     or to_regprocedure('private.delete_venue_permanently_s12_impl(text,text)') is not null then
    raise exception 'S12 interrotta: funzioni interne S12 già presenti';
  end if;
end
$$;

-- Conserva le implementazioni esistenti fuori dallo schema esposto. Le nuove
-- RPC pubbliche sottostanti faranno da cancello sicuro e manterranno invariato
-- il contratto utilizzato dalle applicazioni.
alter function public.record_machine_level(text,numeric,timestamp with time zone)
  set schema private;
alter function private.record_machine_level(text,numeric,timestamp with time zone)
  rename to record_machine_level_s12_impl;

alter function public.correct_latest_machine_level(text,text,numeric)
  set schema private;
alter function private.correct_latest_machine_level(text,text,numeric)
  rename to correct_latest_machine_level_s12_impl;

alter function public.preview_venue_deletion(text)
  set schema private;
alter function private.preview_venue_deletion(text)
  rename to preview_venue_deletion_s12_impl;

alter function public.delete_venue_permanently(text,text)
  set schema private;
alter function private.delete_venue_permanently(text,text)
  rename to delete_venue_permanently_s12_impl;

revoke all on function private.record_machine_level_s12_impl(text,numeric,timestamp with time zone)
  from public, anon, authenticated;
revoke all on function private.correct_latest_machine_level_s12_impl(text,text,numeric)
  from public, anon, authenticated;
revoke all on function private.preview_venue_deletion_s12_impl(text)
  from public, anon, authenticated;
revoke all on function private.delete_venue_permanently_s12_impl(text,text)
  from public, anon, authenticated;

-- CHANGE: soltanto un dipendente attivo può salvare un livello.
create function public.record_machine_level(
  p_machine_id text,
  p_new_level numeric,
  p_updated_at timestamp with time zone default clock_timestamp()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1
    from public.dipendenti dipendente
    where dipendente.auth_user_id = v_uid
      and dipendente.active is true
  ) then
    raise exception 'Account dipendente non autorizzato' using errcode = '42501';
  end if;

  perform private.record_machine_level_s12_impl(
    p_machine_id,
    p_new_level,
    p_updated_at
  );
end;
$$;

-- CHANGE: può correggere l'ultimo report soltanto chi lo ha inserito.
create function public.correct_latest_machine_level(
  p_machine_id text,
  p_history_id text,
  p_new_level numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_latest_id text;
  v_latest_author uuid;
begin
  if v_uid is null or not exists (
    select 1
    from public.dipendenti dipendente
    where dipendente.auth_user_id = v_uid
      and dipendente.active is true
  ) then
    raise exception 'Account dipendente non autorizzato' using errcode = '42501';
  end if;

  if p_new_level is null then
    raise exception 'Livello mancante';
  end if;

  select history.id::text, history.updated_by
  into v_latest_id, v_latest_author
  from public.machine_level_history history
  where history.machine_id::text = p_machine_id
  order by history.updated_at desc, history.id desc
  limit 1;

  if v_latest_id is null or v_latest_id <> p_history_id then
    raise exception 'È possibile correggere soltanto l''ultimo report';
  end if;

  if v_latest_author is distinct from v_uid then
    raise exception 'Puoi correggere soltanto un report inserito da te'
      using errcode = '42501';
  end if;

  perform private.correct_latest_machine_level_s12_impl(
    p_machine_id,
    p_history_id,
    p_new_level
  );
end;
$$;

-- LOCALI: anteprima e cancellazione definitiva sono raggiungibili soltanto
-- dall'Admin registrato nella tabella privata.
create function public.preview_venue_deletion(p_venue_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then
    raise exception 'Operazione consentita esclusivamente a un amministratore.'
      using errcode = '42501';
  end if;

  return private.preview_venue_deletion_s12_impl(p_venue_id);
end;
$$;

create function public.delete_venue_permanently(
  p_venue_id text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_play_money_admin_secure() then
    raise exception 'Operazione consentita esclusivamente a un amministratore.'
      using errcode = '42501';
  end if;

  return private.delete_venue_permanently_s12_impl(
    p_venue_id,
    p_confirmation
  );
end;
$$;

-- Un'unica fonte di verità per tutti i nomi legacy ancora usati da policy e RPC.
create or replace function public.is_play_money_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select public.is_play_money_admin_secure());
$$;

create or replace function public.is_daily_lock_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select public.is_play_money_admin_secure());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select public.is_play_money_admin_secure());
$$;

-- Chiusura generale: ogni SECURITY DEFINER pubblico perde EXECUTE ereditato.
do $$
declare
  privileged_function record;
begin
  for privileged_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      privileged_function.signature
    );
  end loop;
end
$$;

-- Anche gli alias non-privilegiati usati dalle policy partono chiusi.
revoke all on function public.is_play_money_admin() from public, anon, authenticated;
revoke all on function public.is_daily_lock_admin() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;

-- Dipendenti: operazioni personali o operative verificate nel corpo.
grant execute on function public.record_machine_level(text,numeric,timestamp with time zone)
  to authenticated, service_role;
grant execute on function public.correct_latest_machine_level(text,text,numeric)
  to authenticated, service_role;
grant execute on function public.submit_conteggi_giro(uuid,uuid)
  to authenticated, service_role;
grant execute on function public.submit_daily_cassa(date)
  to authenticated, service_role;
grant execute on function public.touch_last_seen()
  to authenticated, service_role;

-- Admin: il GRANT consente la chiamata; ogni funzione verifica poi il ruolo.
grant execute on function public.crea_trasferimento_cassa(numeric,text,date,text)
  to authenticated, service_role;
grant execute on function public.delete_venue_permanently(text,text)
  to authenticated, service_role;
grant execute on function public.elimina_trasferimento_cassa(uuid)
  to authenticated, service_role;
grant execute on function public.finalizza_periodo_conteggi(uuid,date,text,boolean)
  to authenticated, service_role;
grant execute on function public.get_cassa_totale_attiva()
  to authenticated, service_role;
grant execute on function public.get_contabilita_cassa_periodo(uuid)
  to authenticated, service_role;
grant execute on function public.move_venues_to_giro(uuid,text[])
  to authenticated, service_role;
grant execute on function public.prepara_finalizzazione_conteggi(uuid)
  to authenticated, service_role;
grant execute on function public.preview_venue_deletion(text)
  to authenticated, service_role;
grant execute on function public.reopen_conteggi_giro(uuid,uuid,text)
  to authenticated, service_role;
grant execute on function public.reopen_daily_cassa(date,uuid,text)
  to authenticated, service_role;
grant execute on function public.set_daily_edit_lock(date,uuid,boolean)
  to authenticated, service_role;

-- Helper autorizzativi necessari alle policy e alle RPC.
grant execute on function public.is_play_money_admin_secure()
  to authenticated, service_role;
grant execute on function public.is_play_money_admin()
  to authenticated, service_role;
grant execute on function public.is_daily_lock_admin()
  to authenticated, service_role;
grant execute on function public.is_admin()
  to authenticated, service_role;

-- Le nuove funzioni create dal proprietario postgres non saranno più API
-- pubbliche per impostazione predefinita.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

comment on function public.record_machine_level(text,numeric,timestamp with time zone) is
  'S12: registrazione Change riservata ai dipendenti attivi.';
comment on function public.correct_latest_machine_level(text,text,numeric) is
  'S12: correzione dell ultimo report riservata al suo autore.';
comment on function public.preview_venue_deletion(text) is
  'S12: anteprima eliminazione locale riservata all Admin verificato.';
comment on function public.delete_venue_permanently(text,text) is
  'S12: cancellazione locale riservata all Admin verificato.';

-- Controlli automatici prima del COMMIT.
do $$
declare
  authenticated_oid oid := 'authenticated'::regrole;
  anon_oid oid := 'anon'::regrole;
  allowed_authenticated constant text[] := array[
    'correct_latest_machine_level',
    'crea_trasferimento_cassa',
    'delete_venue_permanently',
    'elimina_trasferimento_cassa',
    'finalizza_periodo_conteggi',
    'get_cassa_totale_attiva',
    'get_contabilita_cassa_periodo',
    'is_play_money_admin_secure',
    'move_venues_to_giro',
    'prepara_finalizzazione_conteggi',
    'preview_venue_deletion',
    'record_machine_level',
    'reopen_conteggi_giro',
    'reopen_daily_cassa',
    'set_daily_edit_lock',
    'submit_conteggi_giro',
    'submit_daily_cassa',
    'touch_last_seen'
  ];
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    where n.nspname = 'public'
      and p.prosecdef
      and acl.privilege_type = 'EXECUTE'
      and acl.grantee in (0, anon_oid)
  ) then
    raise exception 'Verifica S12 fallita: una SECURITY DEFINER è ancora pubblica o anonima';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    where n.nspname = 'public'
      and p.prosecdef
      and acl.privilege_type = 'EXECUTE'
      and acl.grantee = authenticated_oid
      and not (p.proname = any(allowed_authenticated))
  ) then
    raise exception 'Verifica S12 fallita: una RPC privilegiata non autorizzata è aperta agli autenticati';
  end if;

  if exists (
    select 1
    from unnest(allowed_authenticated) allowed(function_name)
    where not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = allowed.function_name
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
  ) then
    raise exception 'Verifica S12 fallita: una RPC necessaria all app non è eseguibile';
  end if;
end
$$;

commit;
