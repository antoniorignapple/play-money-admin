// Test-only fixture. Never imported by the production app.
const periods = [
  { id: 'open', date_from: '2026-09-17', date_to: '2026-09-30', status: 'open', is_active: true },
  { id: 'closed', date_from: '2026-08-30', date_to: '2026-09-16', status: 'closed', is_active: false },
];
const rows = [{ id: 'count', period_id: 'closed', venue_id: 'K1', conteggio_date: '2026-09-10', giro_name_snapshot: 'QUITADAMO', executor_name_snapshot: 'DI BARI', esattore: 10000, debito: 0 }];
export const fixture = { fund: { id: true, amount: 0, version: 0 }, fundMovements: [], manual: [], history: [], transfers: [], calls: [] };
const summary = { period_id: 'open', cassa_disponibile: 1000, da_riportare: 800, recuperi: 300, cassa_generata: 1000 };
function query(table) {
  let filters = [], operation = 'read', payload, range = null, single = false;
  const q = {
    select() { return q; }, order() { return q; }, limit() { return q; }, not() { return q; }, neq() { return q; }, is() { return q; }, gte() { return q; }, lte() { return q; },
    eq(key, value) { filters.push([key, value]); return q; }, in() { return q; },
    range(a, b) { range = [a, b]; return q; }, single() { single = true; return q; }, maybeSingle() { single = true; return q; },
    update(data) { operation = 'update'; payload = data; return q; }, insert(data) { operation = 'insert'; payload = data; return q; }, delete() { operation = 'delete'; return q; },
    then(resolve, reject) {
      fixture.calls.push({ table, operation, filters, payload });
      let result = table === 'conteggi_periods' ? periods : table === 'cassa_ufficio_fondo' ? [fixture.fund] : table === 'cassa_ufficio_fondo_movimenti' ? fixture.fundMovements : table === 'cassa_ufficio_fondo_storico' ? fixture.history : table === 'conteggi_tool' || table === 'conteggi_admin_rows' ? rows : table === 'venues' ? [{ id: 'K1', name: 'Locale demo' }] : table === 'contabilita_conteggi_righe' ? fixture.manual : [];
      const matches = row => filters.every(([k, v]) => row[k] === v);
      if (operation === 'insert') { const row = { id: 'manual-' + fixture.manual.length, ...payload, created_at: new Date().toISOString() }; fixture.manual.push(row); result = [row]; }
      else if (operation === 'update') { result = result.filter(matches); result.forEach(row => { if (table === 'cassa_ufficio_fondo') { fixture.history.push({ id: 'h', previous_amount: row.amount, amount: payload.amount, changed_at: new Date().toISOString() }); row.version++; } Object.assign(row, payload); }); }
      else if (operation === 'delete') { const removed = result.filter(matches); fixture.manual = fixture.manual.filter(row => !removed.includes(row)); result = removed; }
      else result = result.filter(matches);
      if (range) result = result.slice(range[0], range[1] + 1);
      return Promise.resolve({ data: single ? result[0] || null : result, error: null }).then(resolve, reject);
    },
  }; return q;
}
const user = { id: 'admin', email: 'admin@example.test' };
export const supabase = {
  from: query,
  rpc: async (name, params = {}) => {
    fixture.calls.push({ rpc: name, params });
    if (name === 'is_play_money_admin_secure') return { data: true };
    if (name === 'get_cassa_totale_attiva') return { data: summary };
    if (name === 'get_cassa_intervallo') return { data: { period: periods.find(p => p.id === params.p_period_id), summary, transfers: fixture.transfers.filter(row => row.transfer_date >= params.p_date_from && row.transfer_date <= params.p_date_to) } };
    if (name === 'admin_v14_fund_movement') {
      if (params.p_delete) fixture.fundMovements = fixture.fundMovements.filter(row => row.id !== params.p_id);
      else if (params.p_id) Object.assign(fixture.fundMovements.find(row => row.id === params.p_id), { description: params.p_description, amount: params.p_amount, updated_at: new Date().toISOString() });
      else fixture.fundMovements.push({ id: `fund-${fixture.fundMovements.length + 1}`, description: params.p_description, amount: params.p_amount, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      fixture.fund.amount = fixture.fundMovements.reduce((sum, row) => sum + Number(row.amount), 0); fixture.fund.version++;
      return { data: { success: true, total: fixture.fund.amount } };
    }
    if (name === 'get_contabilita_cassa_periodo') return { data: { period: periods.find(p => p.id === params.p_period_id), summary, transfers: fixture.transfers } };
    return { data: [] };
  },
  auth: { getSession: async () => ({ data: { session: { user, access_token: 'test-only' } } }), getUser: async () => ({ data: { user } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; }, removeChannel() {},
};
