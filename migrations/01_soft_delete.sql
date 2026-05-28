-- ============================================================================
-- Play Money Admin - Migration 01: Soft Delete (Cestino)
-- ============================================================================
-- Esegui in Supabase SQL Editor una sola volta.
-- Aggiunge soft-delete a movements_cassa per la sezione Cestino.
-- ============================================================================

-- 1) Aggiungi colonna deleted_at
ALTER TABLE movements_cassa
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2) Aggiungi colonna deleted_by (chi ha cancellato)
ALTER TABLE movements_cassa
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 3) Indice per query rapide su movimenti attivi (deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_movements_cassa_active
  ON movements_cassa(work_date DESC)
  WHERE deleted_at IS NULL;

-- 4) Indice per query rapide sul cestino
CREATE INDEX IF NOT EXISTS idx_movements_cassa_deleted
  ON movements_cassa(deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- Dopo aver eseguito, controlla con:
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'movements_cassa'
--     AND column_name IN ('deleted_at', 'deleted_by');
-- ============================================================================
