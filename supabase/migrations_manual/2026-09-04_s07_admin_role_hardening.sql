-- Play Money Admin · S07
-- Unifica ogni controllo amministrativo sulla tabella protetta.
-- Applicare esclusivamente nella finestra di manutenzione concordata.

begin;

do $$
begin
  if to_regclass('private.play_money_admins') is null then
    raise exception
      'S07 interrotta: private.play_money_admins non esiste.';
  end if;

  if to_regprocedure('public.is_play_money_admin_secure()') is null then
    raise exception
      'S07 interrotta: is_play_money_admin_secure() non esiste.';
  end if;

  if not exists (select 1 from private.play_money_admins) then
    raise exception
      'S07 interrotta: nessun amministratore registrato nella tabella protetta.';
  end if;
end;
$$;

create or replace function public.is_play_money_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select public.is_play_money_admin_secure());
$$;

revoke all on function public.is_play_money_admin() from public, anon;
grant execute on function public.is_play_money_admin() to authenticated, service_role;

comment on function public.is_play_money_admin() is
  'Compatibilità legacy: autorizza solo gli utenti presenti in private.play_money_admins.';

commit;
