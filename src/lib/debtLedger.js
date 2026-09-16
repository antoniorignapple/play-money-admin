import { getRomeISODate } from './dates.js';

export const money = (value) => Number(value) || 0;
export const euro = (value) => `${money(value).toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' })} €`;
export function validAmount(value, allowZero = false) {
  const n = Number(value);
  return value !== '' && value != null && Number.isSafeInteger(n) && n >= (allowZero ? 0 : 1) && n <= 999999999;
}
export function debtTotals(debt) {
  const total = money(debt.importo_iniziale);
  const initial = money(debt.importo_originario ?? total);
  const remaining = money(debt.residuo);
  return { initial, total, remaining, added: total - initial, repaid: total - remaining,
    percent: total > 0 ? Math.max(0, Math.min(100, Math.round((total - remaining) / total * 100))) : 0 };
}
export function debtLedger(debt, repayments = [], disbursements = []) {
  const totals = debtTotals(debt);
  const initialDate = debt.data_erogazione || (debt.created_at ? getRomeISODate(debt.created_at) : null);
  const rows = [{ id: 'initial', date: initialDate, created: debt.created_at || '', label: 'Erogazione iniziale', paid: totals.initial, repaid: 0 },
    ...disbursements.map(r => ({ id: `e-${r.id}`, date: r.data, created: r.created_at || '', label: 'Nuova erogazione', paid: money(r.importo), repaid: 0 })),
    ...repayments.map(r => ({ id: `r-${r.id}`, date: r.data || (r.created_at ? getRomeISODate(r.created_at) : null), created: r.created_at || '', label: r.origine === 'manuale' ? 'Rimborso manuale' : 'Rimborso da conteggio', paid: 0, repaid: money(r.importo) }))];
  rows.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.id === 'initial' ? -1 : b.id === 'initial' ? 1 : a.created.localeCompare(b.created) || a.id.localeCompare(b.id)));
  const paid = rows.reduce((sum, r) => sum + r.paid, 0);
  const repaid = rows.reduce((sum, r) => sum + r.repaid, 0);
  // Never invent dated repayments to hide incomplete historical data.
  return { rows, paid, repaid, remaining: totals.remaining, difference: Math.round((paid - repaid - totals.remaining) * 100) / 100 };
}
