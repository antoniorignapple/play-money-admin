-- Include every account that contributed counts, including Admin accounts.
-- Preserve existing zero-count operator rows, permissions, fingerprint and financial records.
-- This migration changes only the read-only finalization preview; it never finalizes a period.

DO $migration$
DECLARE
  original_definition text;
  corrected_definition text;
  old_filter constant text := 'where coalesce(d.active,true)=true and d.role <> ''admin'' and d.auth_user_id is not null';
  new_filter constant text := 'where d.auth_user_id is not null and ((coalesce(d.active,true)=true and d.role <> ''admin'') or ct.id is not null)';
BEGIN
  original_definition := pg_get_functiondef('public._finalizzazione_preview(uuid)'::regprocedure);
  IF position(old_filter in original_definition) = 0 THEN
    RAISE EXCEPTION 'Filtro anteprima inatteso: nessuna modifica applicata';
  END IF;
  corrected_definition := replace(original_definition, old_filter, new_filter);
  EXECUTE corrected_definition;
END;
$migration$;
