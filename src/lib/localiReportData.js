import { venueSortFn } from './helpers.js';

// Fetch every row, including projects whose API row limit is below 500.
export async function readAllReportRows(client, table, columns, orderColumns = ['id']) {
  const rows = [];
  while (true) {
    let query = client.from(table).select(columns, { count: 'exact' });
    for (const column of orderColumns) query = query.order(column);
    const { data, error, count } = await query.range(rows.length, rows.length + 499);
    if (error) throw new Error(`Lettura ${table}: ${error.message}`);
    if (!Array.isArray(data) || !Number.isInteger(count)) {
      throw new Error(`Impossibile verificare la completezza dei dati ${table}`);
    }
    rows.push(...data);
    if (rows.length >= count) return rows;
    if (!data.length) throw new Error(`Dati ${table} incompleti. Riprova.`);
  }
}

export function normalizeReportSlots(rows = []) {
  const models = ['QUEEN 1', 'QUEEN 2', 'JACK', 'GAMINATOR', 'MARIK TOUCH'];
  const aliases = { QUEEN: 'QUEEN 1', 'QUEEN I': 'QUEEN 1', 'QUEEN II': 'QUEEN 2', 'MARIM TOUCH': 'MARIK TOUCH' };
  const grouped = new Map();
  for (const row of rows) {
    const raw = String(row.model ?? '').trim().toUpperCase();
    const model = aliases[raw] || raw;
    const quantity = Number(row.quantity);
    if (!model || !Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Dati parco slot non validi.');
    if (!quantity) continue;
    grouped.set(model, (grouped.get(model) || 0) + quantity);
  }
  const rank = model => models.includes(model) ? models.indexOf(model) : models.length;
  return [...grouped].map(([model, quantity]) => ({ model, quantity }))
    .sort((a, b) => rank(a.model) - rank(b.model) || a.model.localeCompare(b.model, 'it'));
}

export async function loadLocaliReport(client) {
  const [venues, machines, slots] = await Promise.all([
    readAllReportRows(client, 'venues', 'id,name,city'),
    readAllReportRows(client, 'machines', 'id,venue_id,name,level,fondo,last_update'),
    readAllReportRows(client, 'venue_slots', 'venue_id,model,quantity', ['venue_id', 'model']),
  ]);
  const grouped = new Map();
  const groupedSlots = new Map();
  for (const slot of slots) {
    const key = String(slot.venue_id);
    if (!groupedSlots.has(key)) groupedSlots.set(key, []);
    groupedSlots.get(key).push(slot);
  }
  for (const machine of machines) {
    const key = String(machine.venue_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(machine);
  }
  return venues.sort(venueSortFn).map(venue => ({
    ...venue,
    slots: normalizeReportSlots(groupedSlots.get(String(venue.id)) || []),
    machines: (grouped.get(String(venue.id)) || []).sort((a, b) =>
      String(a.name).localeCompare(String(b.name), 'it', { numeric: true }) || String(a.id).localeCompare(String(b.id))),
  })).filter(venue => venue.machines.length);
}
