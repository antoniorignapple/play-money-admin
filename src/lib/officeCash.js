import { calculateEsattoreTotal } from './conteggiAccounting.js';

export const euro = value => `${Number(value).toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' })} €`;
export const fmtDate = value => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('it-IT') : '—';
export const periodLabel = period => period ? `${fmtDate(period.date_from)} — ${fmtDate(period.date_to)}` : 'Nessun periodo';
export const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// Italian input, without silently turning 10.000 into ten euros.
export function parseEuroInput(value) {
  const text = String(value ?? '').trim().replace(/\s|€/g, '');
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) return null;
  const amount = Number(text.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) && Math.abs(amount) <= 999999999 ? roundMoney(amount) : null;
}

export function latestClosedPeriod(periods) {
  return [...periods].filter(p => p.status === 'closed')
    .sort((a, b) => b.date_to.localeCompare(a.date_to) || b.date_from.localeCompare(a.date_from) || String(b.id).localeCompare(String(a.id)))[0] || null;
}

export function accountingTotals(rows, overrides, selectedIds, movements, giri = []) {
  const esattore = calculateEsattoreTotal(rows, overrides, Object.fromEntries(giri.map(g => [String(g.id), g])));
  const selected = new Set(selectedIds.map(String));
  const recuperi = rows.reduce((sum, row) => sum + (selected.has(String(row.id)) && Number(row.debito) > 0 ? Math.trunc(Number(row.debito)) : 0), 0);
  const movimenti = roundMoney(movements.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  return { esattore, recuperi, globale: roundMoney(esattore + recuperi), movimenti, saldo: roundMoney(esattore + recuperi - movimenti) };
}

export function officeCashTotals(fondo, activeSummary, residuo) {
  const acconti = Number(activeSummary?.cassa_disponibile || 0);
  const daRientrare = roundMoney(Number(activeSummary?.da_riportare || 0) - Number(activeSummary?.recuperi || 0));
  return { fondo: Number(fondo), acconti, daRientrare, residuo: Number(residuo), totale: roundMoney(Number(fondo) + acconti + daRientrare + Number(residuo)) };
}
