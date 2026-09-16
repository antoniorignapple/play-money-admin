import { getRomeISODate } from './dates.js';
export function currentMonthRange(value = new Date()) {
  const key = getRomeISODate(value);
  const [year, month] = key.split('-').map(Number);
  return { from: `${key.slice(0, 7)}-01`, to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}
export function inDateRange(record, range) {
  const date = String(record.work_date || '').slice(0, 10);
  return Boolean(range.from && range.to && range.from <= range.to && date && date >= range.from && date <= range.to);
}
export function odometer(value) {
  if (value == null || String(value).trim() === '') return null;
  const raw = String(value).trim().replace(/\s+/g, '');
  // Older records may contain Italian thousands separators.
  const normalized = /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw;
  const n = Number(normalized);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
export function vehicleDistance(records, range) {
  if (!range.from || !range.to || range.from > range.to) return { km: null, status: 'invalid', message: 'Intervallo non valido' };
  // Only readings visible in the selected period belong in this calculation.
  // A prior reading can cover weeks outside the range and inflate the total.
  const period = records.filter(r => inDateRange(r, range))
    .map(r => ({ ...r, reading: odometer(r.km) }))
    .sort((a, b) => a.work_date.localeCompare(b.work_date) || String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id || '').localeCompare(String(b.id || '')));
  if (!period.length) return { km: 0, status: 'empty', message: 'Nessun utilizzo nel periodo' };
  // In this app zero means an omitted odometer reading, not a reset.
  const valid = period.filter(r => r.reading !== null && r.reading > 0);
  if (!valid.length) return { km: null, status: 'missing', message: 'Letture contachilometri mancanti' };
  if (valid.length < 2) return { km: null, status: 'missing', message: 'Servono almeno due letture nel periodo per calcolare i chilometri' };
  const start = { date: valid[0].work_date, km: valid[0].reading };
  const end = { date: valid.at(-1).work_date, km: valid.at(-1).reading };
  for (let i = 1; i < valid.length; i++) {
    if (valid[i].reading < valid[i - 1].reading) return {
      km: null, status: 'anomaly',
      message: `Contachilometri in diminuzione tra il ${dateLabel(valid[i - 1].work_date)} e il ${dateLabel(valid[i].work_date)}: verifica le letture`,
    };
  }
  const partial = valid.length < period.length;
  return { km: end.km - start.km, start, end, status: partial ? 'partial' : 'complete',
    message: partial ? 'Differenza tra prima e ultima lettura valida nel periodo; zeri e campi vuoti ignorati' : 'Differenza tra prima e ultima lettura nel periodo selezionato' };
}
const dateLabel = value => String(value).slice(0, 10).split('-').reverse().join('/');
