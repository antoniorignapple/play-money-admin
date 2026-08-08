-- Idempotenza per tutte le entita salvabili offline.
begin;
alter table public.conteggi_tool add column if not exists client_id text;
alter table public.fondo_cassa_giornaliero add column if not exists client_id text;
create unique index if not exists conteggi_tool_client_id_unique on public.conteggi_tool(client_id) where client_id is not null;
create unique index if not exists simulazioni_client_id_unique on public.simulazioni(client_id) where client_id is not null;
create unique index if not exists fondo_cassa_client_id_unique on public.fondo_cassa_giornaliero(client_id) where client_id is not null;
commit;
