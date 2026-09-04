-- S04 - Protezione della directory dipendenti con RLS e privilegi per colonna.
--
-- ORDINE DI RILASCIO OBBLIGATORIO:
-- 1. pubblicare admin-update-user con l'azione update_user_profile;
-- 2. pubblicare Admin e Dipendenti aggiornati e verificare i dispositivi;
-- 3. applicare questa migrazione nella finestra di manutenzione;
-- 4. eseguire i test di ruolo descritti nella checklist master.
--
-- Non applicare questa migrazione prima delle app aggiornate: le vecchie versioni
-- che eseguono SELECT * sulla tabella riceverebbero "permission denied".

begin;

do $$
begin
  if to_regprocedure('public.is_play_money_admin_secure()') is null then
    raise exception 'Prerequisito mancante: public.is_play_money_admin_secure()';
  end if;
end
$$;

alter table public.dipendenti enable row level security;

-- Elimina tutte le policy storiche permissive. In PostgreSQL le policy permissive
-- si sommano con OR: lasciarne anche una sola con USING (true) annullerebbe S04.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dipendenti'
  loop
    execute format(
      'drop policy if exists %I on public.dipendenti',
      existing_policy.policyname
    );
  end loop;
end
$$;

-- Rimuove i privilegi generici (inclusi INSERT, DELETE e TRUNCATE) e ricostruisce
-- soltanto le aperture necessarie alle due applicazioni.
revoke all privileges on table public.dipendenti from public, anon, authenticated;

-- Prima del login servono soltanto questi quattro campi della directory attiva.
-- PIN, auth_user_id, ruolo e date interne non sono interrogabili con la chiave anon.
grant select (id, full_name, email, active)
  on table public.dipendenti to anon;

-- Dopo il login le app possono leggere i dati operativi non segreti. Non viene
-- concesso alcun INSERT/UPDATE/DELETE: la gestione account passa dalla Edge Function.
grant select (
  id,
  auth_user_id,
  email,
  full_name,
  role,
  created_at,
  active,
  last_access_at,
  last_seen
) on table public.dipendenti to authenticated;

grant all privileges on table public.dipendenti to service_role;

create policy dipendenti_anon_login_directory
on public.dipendenti
for select
to anon
using (active is true);

create policy dipendenti_authenticated_directory
on public.dipendenti
for select
to authenticated
using (
  active is true
  or auth_user_id = (select auth.uid())
  or (select public.is_play_money_admin_secure())
);

-- Presenza online: funzione stretta all'utente corrente, con search_path bloccato.
-- SECURITY DEFINER resta necessario perché il client non possiede UPDATE sulla tabella.
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.dipendenti
     set last_seen = now()
   where auth_user_id = (select auth.uid())
     and active is true;
$$;

revoke all on function public.touch_last_seen() from public;
revoke all on function public.touch_last_seen() from anon;
grant execute on function public.touch_last_seen() to authenticated;

comment on policy dipendenti_anon_login_directory on public.dipendenti is
  'S04: espone agli utenti non autenticati solo le righe attive; i campi sono limitati dai GRANT per colonna.';

comment on policy dipendenti_authenticated_directory on public.dipendenti is
  'S04: directory attiva ai dipendenti; propria riga e righe inattive soltanto all Admin verificato.';

commit;
