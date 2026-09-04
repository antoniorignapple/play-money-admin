-- Play Money · S05 fase finale
-- Eseguire soltanto dopo aver pubblicato e verificato:
--   1. admin-update-user senza letture/scritture di dipendenti.pin;
--   2. verify-giro-owner-pin basata su Supabase Auth;
--   3. Play Money Admin e Dipendenti senza query del campo pin;
--   4. aggiornamento effettivo dei dispositivi dei dipendenti.

begin;

drop function if exists public.verify_giro_owner_pin(uuid, text);

alter table public.dipendenti
  drop column if exists pin;

commit;
