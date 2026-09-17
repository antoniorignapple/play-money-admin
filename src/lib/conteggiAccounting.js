// A giro owns the accounting total; its executor may be a substitute.
export function getAccountingName(row, giroById = {}, fallback = (item) =>
  item.operator_name || item.executor_name_snapshot || 'Senza operatore') {
  const clean = (value) => String(value || '').replace(/^GIRO\s*:?[\s-]*/i, '').trim();
  return clean(row?.giro_name_snapshot) || clean(giroById[String(row?.giro_id)]?.name) || fallback(row);
}

const accountingKey = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]+/gi, ' ').trim().toUpperCase();

export function calculateEsattoreTotal(rows, overrides, giroById = {}) {
  const groups = new Map();
  for (const row of rows) {
    const key = accountingKey(getAccountingName(row, giroById));
    groups.set(key, (groups.get(key) || 0) + (Number(row.esattore) || 0));
  }
  for (const override of overrides) {
    const key = accountingKey(override.operator_name);
    // Match Conteggi: replace an existing giro, never add an orphan override.
    if (groups.has(key)) groups.set(key, Math.trunc(Number(override.esattore_override) || 0));
  }
  return [...groups.values()].reduce((sum, value) => sum + value, 0);
}
