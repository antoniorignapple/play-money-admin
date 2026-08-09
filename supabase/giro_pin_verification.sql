-- Eseguire una volta nel progetto Supabase condiviso prima di pubblicare 7.2/14.3.
-- Il PIN non viene mai restituito al client: la verifica avviene nel database.
create or replace function public.verify_giro_owner_pin(p_giro_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  if auth.uid() is null or p_pin !~ '^\d{4}$' then
    return false;
  end if;

  select d.pin::text
    into v_pin
    from public.giri g
    join public.dipendenti d on d.id = g.default_employee_id
   where g.id = p_giro_id
     and g.active = true
     and d.active = true;

  return coalesce(lpad(v_pin, 4, '0') = p_pin, false);
end;
$$;

revoke all on function public.verify_giro_owner_pin(uuid, text) from public;
grant execute on function public.verify_giro_owner_pin(uuid, text) to authenticated;
