-- Play Money Admin 8.1
-- Mantiene separati nello snapshot il Giro di appartenenza e l'esecutore reale.
-- Ripara anche gli snapshot gia creati, incluso l'ultimo periodo chiuso.

begin;

create or replace function public.enrich_conteggi_archive_snapshot_giri()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_enriched_rows jsonb;
begin
  if jsonb_typeof(new.conteggi_data->'conteggi_admin_rows') is distinct from 'array'
     or jsonb_typeof(new.conteggi_data->'conteggi_tool') is distinct from 'array' then
    return new;
  end if;

  select coalesce(
    jsonb_agg(
      case
        when tool.row_data is null then admin.row_data
        else admin.row_data || jsonb_strip_nulls(jsonb_build_object(
          'giro_id', coalesce(
            nullif(admin.row_data->'giro_id', 'null'::jsonb),
            nullif(tool.row_data->'giro_id', 'null'::jsonb)
          ),
          'giro_name_snapshot', coalesce(
            nullif(admin.row_data->'giro_name_snapshot', 'null'::jsonb),
            nullif(tool.row_data->'giro_name_snapshot', 'null'::jsonb)
          ),
          'executed_by', coalesce(
            nullif(admin.row_data->'executed_by', 'null'::jsonb),
            nullif(tool.row_data->'executed_by', 'null'::jsonb)
          ),
          'executor_name_snapshot', coalesce(
            nullif(admin.row_data->'executor_name_snapshot', 'null'::jsonb),
            nullif(tool.row_data->'executor_name_snapshot', 'null'::jsonb)
          )
        ))
      end
      order by admin.position
    ),
    '[]'::jsonb
  )
  into v_enriched_rows
  from jsonb_array_elements(new.conteggi_data->'conteggi_admin_rows')
       with ordinality as admin(row_data, position)
  left join lateral (
    select source.row_data
    from jsonb_array_elements(new.conteggi_data->'conteggi_tool') as source(row_data)
    where source.row_data->>'id' = admin.row_data->>'id'
    limit 1
  ) as tool on true;

  new.conteggi_data := jsonb_set(
    new.conteggi_data,
    '{conteggi_admin_rows}',
    v_enriched_rows,
    true
  );
  return new;
end;
$function$;

drop trigger if exists trg_enrich_conteggi_archive_snapshot_giri
  on public.conteggi_archive_snapshots;
create trigger trg_enrich_conteggi_archive_snapshot_giri
before insert or update of conteggi_data
on public.conteggi_archive_snapshots
for each row execute function public.enrich_conteggi_archive_snapshot_giri();

-- Fa scattare il trigger su tutte le fotografie gia presenti.
update public.conteggi_archive_snapshots
set conteggi_data = conteggi_data
where jsonb_typeof(conteggi_data->'conteggi_admin_rows') = 'array'
  and jsonb_typeof(conteggi_data->'conteggi_tool') = 'array';

revoke all on function public.enrich_conteggi_archive_snapshot_giri()
  from public, anon, authenticated;

commit;
