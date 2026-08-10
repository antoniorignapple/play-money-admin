-- Play Money Admin 7.6
-- Riconoscimento affidabile dell'account amministratore usato dalla PWA.
-- Eseguire nel SQL Editor di Supabase prima della prossima finalizzazione.

begin;

create or replace function public.is_play_money_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    lower(coalesce(auth.jwt()->>'email', '')) = 'admin@playmoney.com'
    or lower(coalesce(auth.jwt()->'app_metadata'->>'role', '')) like 'admin%'
    or lower(coalesce(auth.jwt()->'user_metadata'->>'role', '')) like 'admin%'
    or exists (
      select 1
      from public.dipendenti d
      where d.auth_user_id = auth.uid()
        and lower(coalesce(d.role, '')) like 'admin%'
    )
  );
$$;

revoke all on function public.is_play_money_admin() from public, anon;
grant execute on function public.is_play_money_admin() to authenticated;

commit;
