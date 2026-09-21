import { supabase } from './supabase';
import { fetchAllRows } from './fetchAllRows.js';
import { accountingTotals, latestClosedPeriod, officeCashTotals } from './officeCash.js';

const checked = result => { if (result.error) throw result.error; return result.data; };
export async function loadPeriods() {
  return fetchAllRows(() => supabase.from('conteggi_periods').select('id,title,date_from,date_to,status,is_active,created_at').order('date_from', { ascending: false }).order('id'));
}

export async function loadAccounting(periodId) {
  const [detail, liveRows, overrides, selected, manual, giri] = await Promise.all([
    supabase.rpc('get_contabilita_cassa_periodo', { p_period_id: periodId }).then(checked),
    fetchAllRows(() => supabase.from('conteggi_tool').select('id,period_id,venue_id,conteggio_date,esattore,debito,operator_name,executor_name_snapshot,giro_id,giro_name_snapshot,created_at').eq('period_id', periodId).order('id')),
    fetchAllRows(() => supabase.from('conteggi_admin_overrides').select('id,operator_name,esattore_override').eq('period_id', periodId).order('id')),
    fetchAllRows(() => supabase.from('contabilita_conteggi_debiti_selezionati').select('conteggio_id').eq('period_id', periodId).order('conteggio_id')),
    fetchAllRows(() => supabase.from('contabilita_conteggi_righe').select('*').eq('period_id', periodId).order('work_date').order('id')),
    fetchAllRows(() => supabase.from('giri').select('id,name').order('id')),
  ]);
  let rows = liveRows;
  let appliedOverrides = overrides;
  let archivedOnly = false;
  if (!liveRows.length && detail?.period?.status === 'closed') {
    const snapshot = checked(await supabase.from('conteggi_archive_snapshots').select('conteggi_data,overrides_data').eq('period_id', periodId).maybeSingle());
    if (snapshot) {
      archivedOnly = true;
      const tools = snapshot.conteggi_data?.conteggi_tool || [];
      const source = snapshot.conteggi_data?.conteggi_admin_rows || tools;
      const byId = new Map(tools.map(row => [String(row.id), row]));
      rows = source.map(row => ({ ...byId.get(String(row.id)), ...row,
        giro_id: row.giro_id || byId.get(String(row.id))?.giro_id,
        giro_name_snapshot: row.giro_name_snapshot || byId.get(String(row.id))?.giro_name_snapshot }));
      appliedOverrides = snapshot.overrides_data || [];
    }
  }
  const transfers = (detail?.transfers || []).map(row => ({ ...row, source: 'cassa', workDate: row.transfer_date, description: row.destination }));
  const movements = [...transfers, ...manual.map(row => ({ ...row, source: 'manual', workDate: row.work_date, destination: row.description }))]
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id));
  const selectedIds = selected.map(row => String(row.conteggio_id));
  return { detail, rows, overrides: appliedOverrides, selectedIds, manual, giri, movements, archivedOnly,
    totals: accountingTotals(rows, appliedOverrides, selectedIds, movements, giri) };
}

export async function loadOfficeCash() {
  const [periods, fund, fundMovements, summary] = await Promise.all([
    loadPeriods(),
    supabase.from('cassa_ufficio_fondo').select('*').eq('id', true).single().then(checked),
    supabase.from('cassa_ufficio_fondo_movimenti').select('*').order('created_at').order('id').then(checked),
    supabase.rpc('get_cassa_totale_attiva').then(checked),
  ]);
  const closedPeriod = latestClosedPeriod(periods);
  const accounting = closedPeriod ? await loadAccounting(closedPeriod.id) : null;
  return { periods, fund, fundMovements, summary, closedPeriod, activePeriod: periods.find(p => p.id === summary?.period_id) || null,
    totals: officeCashTotals(fund.amount, summary, accounting?.totals.saldo || 0), loadedAt: new Date() };
}

export async function loadCashRange(periodId, dateFrom, dateTo) {
  return checked(await supabase.rpc('get_cassa_intervallo', { p_period_id: periodId, p_date_from: dateFrom, p_date_to: dateTo }));
}

export async function saveFundMovement(row, form, remove = false) {
  const data = checked(await supabase.rpc('admin_v14_fund_movement', {
    p_id: row?.id || null, p_delete: remove, p_description: form?.description || '', p_amount: form?.amount ?? 0,
    p_expected_updated_at: row?.updated_at || null,
  }));
  notifyAccountingChanged();
  return data;
}

export function notifyAccountingChanged() { window.dispatchEvent(new Event('cassa-totale-refresh')); }

export async function saveFund(amount, version) {
  const result = await supabase.from('cassa_ufficio_fondo').update({ amount }).eq('id', true).eq('version', version).select().maybeSingle();
  const saved = checked(result);
  if (!saved) throw new Error('Il fondo è stato aggiornato da un altro dispositivo. Aggiorna la pagina e riprova.');
  notifyAccountingChanged();
  return saved;
}

export async function saveCashTransfer(periodId, row, form, remove = false) {
  const data = checked(await supabase.rpc('admin_v14_transfer', {
    p_period_id: periodId, p_id: row?.id || null, p_delete: remove,
    p_amount: form?.amount ?? 0, p_destination: form?.destination || '',
    p_date: form?.date || row?.transfer_date, p_note: form?.note || null,
    p_expected: row ? { amount: row.amount, destination: row.destination, transfer_date: row.transfer_date, note: row.note ?? null } : null,
  }));
  notifyAccountingChanged();
  return data;
}
