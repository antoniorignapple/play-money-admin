begin;

-- Eccezione di compatibilità per i periodi finalizzati con la vecchia regola,
-- quando i conteggi venivano spostati in conteggi_archive_snapshots.
-- La funzione restituisce soltanto il Giro appartenente al dipendente loggato.
create or replace function public.get_my_legacy_conteggi_archive(
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
  v_conteggi_data jsonb;
  v_movimenti_data jsonb;
  v_deposit_code text;
  v_rows jsonb := '[]'::jsonb;
  v_real_deposits numeric := 0;
begin
  if v_uid is null then
    raise exception 'Sessione non valida.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.giri giro
    join public.dipendenti dipendente
      on dipendente.id = giro.default_employee_id
    where giro.id = p_giro_id
      and dipendente.auth_user_id = v_uid
      and dipendente.active is true
  ) then
    raise exception 'Archivio non autorizzato per questo Giro.' using errcode = '42501';
  end if;

  select snapshot.conteggi_data,
         snapshot.movimenti_cassa_data,
         giro.code
    into v_conteggi_data, v_movimenti_data, v_deposit_code
  from public.conteggi_archive_snapshots snapshot
  join public.giri giro on giro.id = p_giro_id
  where snapshot.period_id = p_period_id
  order by snapshot.closed_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'found', false,
      'period_id', p_period_id,
      'giro_id', p_giro_id,
      'conteggi_rows', '[]'::jsonb,
      'real_deposits_total', 0
    );
  end if;

  if jsonb_typeof(v_conteggi_data -> 'conteggi_tool') = 'array' then
    select coalesce(
      jsonb_agg(item order by item ->> 'updated_at' desc),
      '[]'::jsonb
    )
      into v_rows
    from jsonb_array_elements(v_conteggi_data -> 'conteggi_tool') item
    where item ->> 'giro_id' = p_giro_id::text;
  end if;

  if jsonb_typeof(v_movimenti_data) = 'array' and v_deposit_code is not null then
    select coalesce(sum(
      case
        when coalesce(item ->> 'acconto', '') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (item ->> 'acconto')::numeric
        else 0
      end
    ), 0)
      into v_real_deposits
    from jsonb_array_elements(v_movimenti_data) item
    where item ->> 'venue_id' = v_deposit_code
      and nullif(item ->> 'deleted_at', '') is null;
  end if;

  return jsonb_build_object(
    'found', true,
    'period_id', p_period_id,
    'giro_id', p_giro_id,
    'conteggi_rows', v_rows,
    'real_deposits_total', trunc(v_real_deposits)
  );
end;
$$;

revoke all on function public.get_my_legacy_conteggi_archive(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_my_legacy_conteggi_archive(uuid, uuid)
  to authenticated;

comment on function public.get_my_legacy_conteggi_archive(uuid, uuid) is
  'Legge in sola consultazione gli snapshot Conteggi legacy, limitandoli al Giro del dipendente autenticato.';

commit;
