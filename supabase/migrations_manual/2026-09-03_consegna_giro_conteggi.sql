-- Play Money: consegna e riapertura di un Giro Conteggi.
-- Stato indipendente per periodo + giro, con autorizzazione server e audit.

begin;

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.play_money_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on table private.play_money_admins from public, anon, authenticated;

insert into private.play_money_admins (user_id)
select id
from auth.users
where lower(email) = lower('admin@playmoney.com')
on conflict (user_id) do nothing;

create or replace function public.is_play_money_admin_secure()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.play_money_admins admins
    where admins.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_play_money_admin_secure() from public, anon;
grant execute on function public.is_play_money_admin_secure() to authenticated;

create table if not exists public.conteggi_giro_submissions (
  period_id uuid not null references public.conteggi_periods(id) on delete cascade,
  giro_id uuid not null references public.giri(id) on delete cascade,
  owner_employee_id uuid references public.dipendenti(id) on delete set null,
  status text not null default 'submitted' check (status in ('submitted', 'reopened')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reopened_by uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  reopen_reason text,
  updated_at timestamptz not null default now(),
  primary key (period_id, giro_id)
);

alter table public.conteggi_giro_submissions enable row level security;
revoke all on table public.conteggi_giro_submissions from public, anon, authenticated;
grant select on table public.conteggi_giro_submissions to authenticated;

drop policy if exists conteggi_giro_submissions_select on public.conteggi_giro_submissions;
create policy conteggi_giro_submissions_select
on public.conteggi_giro_submissions
for select
to authenticated
using (
  (select public.is_play_money_admin_secure())
  or submitted_by = (select auth.uid())
  or exists (
    select 1
    from public.giri giro
    join public.dipendenti dipendente on dipendente.id = giro.default_employee_id
    where giro.id = conteggi_giro_submissions.giro_id
      and dipendente.auth_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.conteggi_tool conteggio
    where conteggio.period_id = conteggi_giro_submissions.period_id
      and conteggio.giro_id = conteggi_giro_submissions.giro_id
      and coalesce(conteggio.executed_by, conteggio.user_id) = (select auth.uid())
  )
);

create table if not exists private.conteggi_giro_submission_audit (
  id bigint generated always as identity primary key,
  period_id uuid not null,
  giro_id uuid not null,
  action text not null check (action in ('submitted', 'reopened')),
  actor_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

revoke all on table private.conteggi_giro_submission_audit from public, anon, authenticated;

create or replace function public.submit_conteggi_giro(
  p_period_id uuid,
  p_giro_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner_employee_id uuid;
  v_submitted_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Utente non autenticato' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.conteggi_periods periodo
    where periodo.id = p_period_id and periodo.status <> 'closed'
  ) then
    raise exception 'Periodo Conteggi non disponibile';
  end if;

  select giro.default_employee_id
  into v_owner_employee_id
  from public.giri giro
  where giro.id = p_giro_id and giro.active = true;

  if not found then
    raise exception 'Giro non disponibile';
  end if;

  if not (
    exists (
      select 1
      from public.dipendenti dipendente
      where dipendente.id = v_owner_employee_id
        and dipendente.auth_user_id = v_uid
        and coalesce(dipendente.active, true)
    )
    or exists (
      select 1
      from public.conteggi_tool conteggio
      where conteggio.period_id = p_period_id
        and conteggio.giro_id = p_giro_id
        and coalesce(conteggio.executed_by, conteggio.user_id) = v_uid
    )
  ) then
    raise exception 'Non puoi inviare questo Giro' using errcode = '42501';
  end if;

  insert into public.conteggi_giro_submissions (
    period_id,
    giro_id,
    owner_employee_id,
    status,
    submitted_by,
    submitted_at,
    reopened_by,
    reopened_at,
    reopen_reason,
    updated_at
  ) values (
    p_period_id,
    p_giro_id,
    v_owner_employee_id,
    'submitted',
    v_uid,
    v_submitted_at,
    null,
    null,
    null,
    v_submitted_at
  )
  on conflict (period_id, giro_id) do update
  set owner_employee_id = excluded.owner_employee_id,
      status = 'submitted',
      submitted_by = excluded.submitted_by,
      submitted_at = excluded.submitted_at,
      reopened_by = null,
      reopened_at = null,
      reopen_reason = null,
      updated_at = excluded.updated_at;

  insert into private.conteggi_giro_submission_audit (
    period_id, giro_id, action, actor_id
  ) values (
    p_period_id, p_giro_id, 'submitted', v_uid
  );

  return jsonb_build_object(
    'success', true,
    'status', 'submitted',
    'period_id', p_period_id,
    'giro_id', p_giro_id,
    'submitted_at', v_submitted_at
  );
end;
$$;

revoke all on function public.submit_conteggi_giro(uuid, uuid) from public, anon;
grant execute on function public.submit_conteggi_giro(uuid, uuid) to authenticated;

create or replace function public.reopen_conteggi_giro(
  p_period_id uuid,
  p_giro_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reopened_at timestamptz := now();
begin
  if v_uid is null or not public.is_play_money_admin_secure() then
    raise exception 'Operazione riservata all''Admin' using errcode = '42501';
  end if;

  update public.conteggi_giro_submissions
  set status = 'reopened',
      reopened_by = v_uid,
      reopened_at = v_reopened_at,
      reopen_reason = nullif(btrim(p_reason), ''),
      updated_at = v_reopened_at
  where period_id = p_period_id
    and giro_id = p_giro_id
    and status = 'submitted';

  if not found then
    raise exception 'Il Giro non risulta inviato';
  end if;

  insert into private.conteggi_giro_submission_audit (
    period_id, giro_id, action, actor_id, reason
  ) values (
    p_period_id, p_giro_id, 'reopened', v_uid, nullif(btrim(p_reason), '')
  );

  return jsonb_build_object(
    'success', true,
    'status', 'reopened',
    'period_id', p_period_id,
    'giro_id', p_giro_id,
    'reopened_at', v_reopened_at
  );
end;
$$;

revoke all on function public.reopen_conteggi_giro(uuid, uuid, text) from public, anon;
grant execute on function public.reopen_conteggi_giro(uuid, uuid, text) to authenticated;

create or replace function private.guard_submitted_conteggi_giro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_locked boolean := false;
  v_new_locked boolean := false;
begin
  if public.is_play_money_admin_secure() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.period_id is not null and old.giro_id is not null then
    select exists (
      select 1 from public.conteggi_giro_submissions submission
      where submission.period_id = old.period_id
        and submission.giro_id = old.giro_id
        and submission.status = 'submitted'
    ) into v_old_locked;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.period_id is not null and new.giro_id is not null then
    select exists (
      select 1 from public.conteggi_giro_submissions submission
      where submission.period_id = new.period_id
        and submission.giro_id = new.giro_id
        and submission.status = 'submitted'
    ) into v_new_locked;
  end if;

  if v_old_locked or v_new_locked then
    raise exception 'Giro già inviato. Chiedi la riapertura all''Admin.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_submitted_conteggi_giro() from public, anon, authenticated;

drop trigger if exists guard_submitted_conteggi_giro on public.conteggi_tool;
create trigger guard_submitted_conteggi_giro
before insert or update or delete on public.conteggi_tool
for each row execute function private.guard_submitted_conteggi_giro();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conteggi_giro_submissions'
  ) then
    alter publication supabase_realtime add table public.conteggi_giro_submissions;
  end if;
end;
$$;

commit;
