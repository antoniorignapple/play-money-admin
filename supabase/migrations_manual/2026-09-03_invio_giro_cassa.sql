-- Play Money: invio e riapertura della Cassa giornaliera.
-- Estende daily_edit_locks distinguendo invio del dipendente e blocco Admin.

begin;

alter table public.daily_edit_locks
  add column if not exists status text not null default 'in_progress',
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists reopened_by uuid references auth.users(id) on delete set null,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopen_reason text;

alter table public.daily_edit_locks
  drop constraint if exists daily_edit_locks_status_check;

alter table public.daily_edit_locks
  add constraint daily_edit_locks_status_check
  check (status in ('in_progress', 'submitted', 'admin_locked', 'reopened'));

update public.daily_edit_locks
set status = case when locked then 'admin_locked' else 'in_progress' end
where status = 'in_progress';

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.daily_cassa_lock_audit (
  id bigint generated always as identity primary key,
  work_date date not null,
  created_by uuid not null,
  action text not null check (action in ('submitted', 'reopened', 'admin_locked')),
  actor_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

revoke all on table private.daily_cassa_lock_audit from public, anon, authenticated;

drop policy if exists daily_edit_locks_select on public.daily_edit_locks;
create policy daily_edit_locks_select
on public.daily_edit_locks
for select
to authenticated
using (
  created_by = (select auth.uid())
  or (select public.is_play_money_admin_secure())
);

drop policy if exists daily_edit_locks_admin_all on public.daily_edit_locks;
create policy daily_edit_locks_admin_all
on public.daily_edit_locks
for all
to authenticated
using ((select public.is_play_money_admin_secure()))
with check ((select public.is_play_money_admin_secure()));

create or replace function public.submit_daily_cassa(p_work_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_existing public.daily_edit_locks;
begin
  if v_uid is null then
    raise exception 'Utente non autenticato' using errcode = '42501';
  end if;

  if p_work_date is null or p_work_date <> (timezone('Europe/Rome', now()))::date then
    raise exception 'Puoi inviare soltanto la Cassa della giornata corrente';
  end if;

  if not exists (
    select 1
    from public.dipendenti dipendente
    where dipendente.auth_user_id = v_uid
      and coalesce(dipendente.active, true)
  ) then
    raise exception 'Account dipendente non disponibile' using errcode = '42501';
  end if;

  select * into v_existing
  from public.daily_edit_locks
  where work_date = p_work_date and created_by = v_uid
  for update;

  if found and v_existing.locked and v_existing.status = 'submitted' then
    return jsonb_build_object(
      'success', true,
      'status', 'submitted',
      'work_date', v_existing.work_date,
      'submitted_at', v_existing.submitted_at,
      'already_submitted', true
    );
  end if;

  if found and v_existing.locked then
    raise exception 'La giornata è già bloccata dall''Admin' using errcode = '42501';
  end if;

  insert into public.daily_edit_locks (
    work_date, created_by, locked, locked_at, locked_by, updated_at,
    status, submitted_by, submitted_at, reopened_by, reopened_at, reopen_reason
  ) values (
    p_work_date, v_uid, true, v_now, v_uid, v_now,
    'submitted', v_uid, v_now, null, null, null
  )
  on conflict (work_date, created_by) do update set
    locked = true,
    locked_at = excluded.locked_at,
    locked_by = excluded.locked_by,
    updated_at = excluded.updated_at,
    status = 'submitted',
    submitted_by = excluded.submitted_by,
    submitted_at = excluded.submitted_at,
    reopened_by = null,
    reopened_at = null,
    reopen_reason = null;

  insert into private.daily_cassa_lock_audit (
    work_date, created_by, action, actor_id
  ) values (
    p_work_date, v_uid, 'submitted', v_uid
  );

  return jsonb_build_object(
    'success', true,
    'status', 'submitted',
    'work_date', p_work_date,
    'submitted_at', v_now,
    'already_submitted', false
  );
end;
$$;

revoke all on function public.submit_daily_cassa(date) from public, anon;
grant execute on function public.submit_daily_cassa(date) to authenticated;

create or replace function public.reopen_daily_cassa(
  p_work_date date,
  p_created_by uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_uid is null or not public.is_play_money_admin_secure() then
    raise exception 'Operazione riservata all''Admin' using errcode = '42501';
  end if;

  update public.daily_edit_locks
  set locked = false,
      locked_at = null,
      locked_by = null,
      status = 'reopened',
      reopened_by = v_uid,
      reopened_at = v_now,
      reopen_reason = nullif(btrim(p_reason), ''),
      updated_at = v_now
  where work_date = p_work_date
    and created_by = p_created_by
    and locked = true
    and status = 'submitted';

  if not found then
    raise exception 'La Cassa non risulta inviata';
  end if;

  insert into private.daily_cassa_lock_audit (
    work_date, created_by, action, actor_id, reason
  ) values (
    p_work_date, p_created_by, 'reopened', v_uid, nullif(btrim(p_reason), '')
  );

  return jsonb_build_object(
    'success', true,
    'status', 'reopened',
    'work_date', p_work_date,
    'created_by', p_created_by,
    'reopened_at', v_now
  );
end;
$$;

revoke all on function public.reopen_daily_cassa(date, uuid, text) from public, anon;
grant execute on function public.reopen_daily_cassa(date, uuid, text) to authenticated;

create or replace function public.set_daily_edit_lock(
  p_work_date date,
  p_created_by uuid,
  p_locked boolean
)
returns public.daily_edit_locks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  result public.daily_edit_locks;
begin
  if v_uid is null or not public.is_play_money_admin_secure() then
    raise exception 'Operazione riservata agli Admin' using errcode = '42501';
  end if;

  insert into public.daily_edit_locks (
    work_date, created_by, locked, locked_at, locked_by, updated_at,
    status, reopened_by, reopened_at
  ) values (
    p_work_date, p_created_by, p_locked,
    case when p_locked then v_now else null end,
    case when p_locked then v_uid else null end,
    v_now,
    case when p_locked then 'admin_locked' else 'reopened' end,
    case when p_locked then null else v_uid end,
    case when p_locked then null else v_now end
  )
  on conflict (work_date, created_by) do update set
    locked = excluded.locked,
    locked_at = excluded.locked_at,
    locked_by = excluded.locked_by,
    updated_at = excluded.updated_at,
    status = case
      when p_locked and public.daily_edit_locks.status = 'submitted' then 'submitted'
      when p_locked then 'admin_locked'
      else 'reopened'
    end,
    reopened_by = case when p_locked then public.daily_edit_locks.reopened_by else v_uid end,
    reopened_at = case when p_locked then public.daily_edit_locks.reopened_at else v_now end,
    reopen_reason = case when p_locked then public.daily_edit_locks.reopen_reason else null end
  returning * into result;

  insert into private.daily_cassa_lock_audit (
    work_date, created_by, action, actor_id
  ) values (
    p_work_date, p_created_by,
    case when p_locked then 'admin_locked' else 'reopened' end,
    v_uid
  );

  return result;
end;
$$;

revoke all on function public.set_daily_edit_lock(date, uuid, boolean) from public, anon;
grant execute on function public.set_daily_edit_lock(date, uuid, boolean) to authenticated;

create or replace function public.guard_daily_employee_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_date date;
  target_user uuid;
begin
  if auth.uid() is not null and public.is_play_money_admin_secure() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    target_date := old.work_date;
    target_user := old.created_by;
  else
    target_date := new.work_date;
    target_user := new.created_by;
  end if;

  if exists (
    select 1 from public.daily_edit_locks lock_row
    where lock_row.work_date = target_date
      and lock_row.created_by = target_user
      and lock_row.locked = true
  ) then
    raise exception 'GIORNATA_BLOCCATA: Cassa inviata o bloccata. Chiedi la riapertura all''Admin.';
  end if;

  if tg_op = 'UPDATE' and exists (
    select 1 from public.daily_edit_locks lock_row
    where lock_row.work_date = old.work_date
      and lock_row.created_by = old.created_by
      and lock_row.locked = true
  ) then
    raise exception 'GIORNATA_BLOCCATA: Cassa inviata o bloccata. Chiedi la riapertura all''Admin.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.guard_daily_employee_edit() from public, anon, authenticated;

commit;
