import { venueSortFn } from './helpers.js';

// Fetch every row, including projects whose API row limit is below 500.
export async function readAllReportRows(client, table, columns) {
  const rows = [];
  while (true) {
    const { data, error, count } = await client.from(table)
      .select(columns, { count: 'exact' }).order('id')
      .range(rows.length, rows.length + 499);
    if (error) throw new Error(`Lettura ${table}: ${error.message}`);
    if (!Array.isArray(data) || !Number.isInteger(count)) {
      throw new Error(`Impossibile verificare la completezza dei dati ${table}`);
    }
    rows.push(...data);
    if (rows.length >= count) return rows;
    if (!data.length) throw new Error(`Dati ${table} incompleti. Riprova.`);
  }
}

export async function loadLocaliReport(client) {
  const [venues, machines] = await Promise.all([
    readAllReportRows(client, 'venues', 'id,name,city'),
    readAllReportRows(client, 'machines', 'id,venue_id,name,level,fondo,last_update'),
  ]);
  const grouped = new Map();
  for (const machine of machines) {
    const key = String(machine.venue_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(machine);
  }
  return venues.sort(venueSortFn).map(venue => ({
    ...venue,
    machines: (grouped.get(String(venue.id)) || []).sort((a, b) =>
      String(a.name).localeCompare(String(b.name), 'it', { numeric: true }) || String(a.id).localeCompare(String(b.id))),
  })).filter(venue => venue.machines.length);
}
