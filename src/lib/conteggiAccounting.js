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

// Same deposit ownership rules used by ConteggiPage (giro owner, not substitute).
export function getPeriodFinale(rows, overrides, giri = [], employees = [], deposits = []) {
  const giroById = Object.fromEntries(giri.map(g => [String(g.id), g]));
  const normalize = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/gi, ' ').trim().toUpperCase();
  const codes = [['D01', ['APRILE']], ['D02', ['PAPAGNI']], ['D03', ['BARI']], ['D04', ['QUITADAMO']], ['D05', ['RIGNANESE']]];
  const depositCode = row => {
    const giro = giroById[String(row.giro_id)];
    const owner = giro?.default_employee_id ? employees.find(e => String(e.id) === String(giro?.default_employee_id) || String(e.auth_user_id) === String(giro?.default_employee_id)) : null;
    const explicit = [giro?.code, owner?.deposit_venue_id].map(v => String(v || '').trim().toUpperCase()).find(v => /^D0[1-5]$/.test(v));
    if (explicit) return explicit;
    const giroName = normalize(giro?.name || row.giro_name_snapshot);
    if (giroName === 'MASSIMO' || giroName.includes('APRILE')) return 'D01';
    const name = normalize([owner?.full_name, owner?.email, giro?.name, giro?.code, getAccountingName(row, giroById), row.operator_name || row.executor_name_snapshot].filter(Boolean).join(' '));
    return codes.find(([, names]) => names.some(n => name.includes(n)))?.[0];
  };
  const groups = new Map();
  for (const row of rows) {
    const name = getAccountingName(row, giroById);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row);
  }
  const realDeposits = {};
  for (const d of deposits) {
    const code = String(d.venue_id || '').trim().toUpperCase();
    realDeposits[code] = (realDeposits[code] || 0) + Math.trunc(Number(d.acconto) || 0);
  }
  let finale = rows.reduce((sum, r) => sum + (Number(r.totale_finale) || 0) - ((Number(r.carta) || 0) + (Number(r.monete) || 0) - (Number(r.uso_cassa) || 0)), 0);
  for (const [name, items] of groups) {
    const override = overrides.find(o => normalize(o.operator_name) === normalize(name));
    if (override) finale -= Math.trunc(Number(override.esattore_override) || 0) - items.reduce((sum, r) => sum + (Number(r.esattore) || 0), 0);
    const code = items.map(depositCode).find(Boolean);
    finale += realDeposits[code] || 0;
  }
  return Math.round(finale * 100) / 100;
}

export function withAutomaticShortage(manual, transfers, finale, period) {
  const amount = Math.max(0, -finale);
  const movements = [...transfers, ...manual.map(row => {
    const legacy = /^AMMANCO\s+CONTEGGI$/i.test(String(row.description || '').trim());
    return { ...row, source: 'manual', workDate: row.work_date, destination: row.description,
      amount: legacy ? 0 : row.amount, originalAmount: row.amount, legacyShortage: legacy,
      note: legacy ? `Sostituito dal movimento automatico. Importo originale: ${row.amount} €` : row.note };
  })];
  movements.push({ id: 'automatic-shortage', source: 'automatic', workDate: period.date_to, destination: 'AMMANCO CONTEGGI', amount,
    note: '', created_at: '' });
  return movements.sort((a, b) => String(a.workDate).localeCompare(String(b.workDate)) || String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
}
