-- Codici locali a sei cifre, unici e generati lato database.
begin;
create unique index if not exists venues_code_unique on public.venues(code);
alter table public.venues drop constraint if exists venues_code_six_digits_check;
alter table public.venues add constraint venues_code_six_digits_check check(code ~ '^[0-9]{6}$') not valid;
create or replace function public.generate_venue_code()
returns text language plpgsql security definer set search_path=public as $$
declare candidate text;
begin
 loop
  candidate := (100000 + ((('x' || encode(gen_random_bytes(4),'hex'))::bit(32)::bigint % 900000)::int))::text;
  if candidate not in ('000000','123456','654321')
     and candidate !~ '^([0-9])\1{5}$'
     and not exists(select 1 from public.venues where code=candidate) then return candidate; end if;
 end loop;
end $$;
grant execute on function public.generate_venue_code() to authenticated;
commit;
