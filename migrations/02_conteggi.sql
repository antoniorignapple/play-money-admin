-- ============================================================
-- Migration: Tabelle e viste per la sezione CONTEGGI
-- File: 02_conteggi.sql
-- Esegui questa migration SOLO se non hai già queste tabelle.
-- ============================================================

-- 1) Tabella periodi conteggi
CREATE TABLE IF NOT EXISTS conteggi_periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  date_from   date NOT NULL,
  date_to     date NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conteggi_periods_date_from_idx ON conteggi_periods(date_from DESC);
CREATE INDEX IF NOT EXISTS conteggi_periods_status_idx ON conteggi_periods(status);

-- 2) Tabella singoli conteggi per locale
-- NOTA: se hai già una tabella conteggi tua, salta questa creazione e
--       crea solo la VIEW più sotto, adattando i nomi delle colonne.
CREATE TABLE IF NOT EXISTS conteggi_admin_rows (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id        uuid REFERENCES conteggi_periods(id) ON DELETE SET NULL,
  venue_id         text NOT NULL,
  user_id          uuid,
  operator_name    text,
  conteggio_date   date NOT NULL DEFAULT CURRENT_DATE,
  esattore         numeric DEFAULT 0,
  acconti          numeric DEFAULT 0,  -- "Ricevute" lato UI
  riporto          numeric DEFAULT 0,  -- "Da riportare"
  assegno          numeric DEFAULT 0,
  debito           numeric DEFAULT 0,
  debito_virt      numeric DEFAULT 0,
  carta            numeric DEFAULT 0,
  monete           numeric DEFAULT 0,
  uso_cassa        numeric DEFAULT 0,
  bonus            numeric DEFAULT 0,
  totale_finale    numeric GENERATED ALWAYS AS (
    COALESCE(esattore,0) + COALESCE(acconti,0) - COALESCE(riporto,0)
    + COALESCE(assegno,0) - COALESCE(debito,0) - COALESCE(debito_virt,0)
    + COALESCE(carta,0) + COALESCE(monete,0) - COALESCE(uso_cassa,0)
    + COALESCE(bonus,0)
  ) STORED,
  locked           boolean DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conteggi_admin_rows_period_idx ON conteggi_admin_rows(period_id);
CREATE INDEX IF NOT EXISTS conteggi_admin_rows_venue_idx ON conteggi_admin_rows(venue_id);
CREATE INDEX IF NOT EXISTS conteggi_admin_rows_user_idx ON conteggi_admin_rows(user_id);

-- 3) Vista riepilogativa per ogni periodo
CREATE OR REPLACE VIEW conteggi_admin_summary AS
SELECT
  period_id,
  COUNT(*)::int                              AS conteggi_count,
  COUNT(DISTINCT venue_id)::int              AS locali_count,
  COUNT(DISTINCT user_id)::int               AS operatori_count,
  COALESCE(SUM(esattore), 0)                 AS esattore_total,
  COALESCE(SUM(acconti), 0)                  AS ricevute_total,
  COALESCE(SUM(riporto), 0)                  AS riporto_total,
  COALESCE(SUM(assegno), 0)                  AS assegni_total,
  COALESCE(SUM(debito), 0)                   AS debiti_total,
  COALESCE(SUM(totale_finale), 0)            AS finale_total
FROM conteggi_admin_rows
WHERE period_id IS NOT NULL
GROUP BY period_id;

-- 4) RLS — abilita la sicurezza e crea policy permissive (puoi raffinare dopo)
ALTER TABLE conteggi_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE conteggi_admin_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conteggi_periods_all ON conteggi_periods;
CREATE POLICY conteggi_periods_all ON conteggi_periods FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS conteggi_admin_rows_all ON conteggi_admin_rows;
CREATE POLICY conteggi_admin_rows_all ON conteggi_admin_rows FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- FINE migration
-- ============================================================
