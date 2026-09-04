-- Play Money Admin · compatibilità S07
-- Richiede is_play_money_admin_secure() e la tabella privata degli Admin.

begin;

create or replace function public.is_play_money_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.is_play_money_admin_secure());
$$;

revoke all on function public.is_play_money_admin() from public, anon;
grant execute on function public.is_play_money_admin() to authenticated, service_role;

commit;
