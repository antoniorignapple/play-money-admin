begin;

create table if not exists public.push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_id uuid not null,
  subscription_id uuid not null
    references public.push_subscriptions(id) on delete cascade,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'expired')),
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  unique (event_type, entity_id, subscription_id)
);

create index if not exists push_delivery_log_entity_idx
  on public.push_delivery_log (event_type, entity_id);

alter table public.push_delivery_log enable row level security;

revoke all on table public.push_delivery_log from public, anon, authenticated;
grant select, insert, update, delete on table public.push_delivery_log to service_role;

comment on table public.push_delivery_log is
  'Registro server-only per impedire notifiche push duplicate e consentire retry controllati.';

commit;
