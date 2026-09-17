import { jsPDF } from 'jspdf';
import { getRomeISODate } from './dates.js';
import { inDateRange, latestVehicleReading, odometer, vehicleDistance } from './vehiclePeriod.js';

const dateLabel = value => String(value || '').slice(0, 10).split('-').reverse().join('/');
const kmLabel = value => value == null ? '-' : value.toLocaleString('it-IT', { useGrouping: 'always' });
const euroLabel = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

export function buildAutomezzoPdf({ vehicle, records = [], range, employeeName, today = getRomeISODate() }) {
  if (!range.from || !range.to || range.from > range.to) throw new Error('Scegli un periodo valido prima di aprire il PDF');
  const rows = records.filter(record => inDateRange(record, range)).sort((a, b) =>
    String(a.work_date).localeCompare(String(b.work_date))
    || String(a.created_at || '').localeCompare(String(b.created_at || ''))
    || String(a.id || '').localeCompare(String(b.id || '')));
  const distance = vehicleDistance(records, range);
  const current = latestVehicleReading(records, today);
  const fuel = rows.reduce((sum, row) => sum + (Number(row.rifornimento) || 0), 0);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setProperties({ title: `Automezzo ${vehicle.name} - ${vehicle.plate} - ${range.from} ${range.to}`, author: 'Play Money' });
  const W = 595.28, H = 841.89, M = 40, R = W - M;
  const ink = [53, 42, 24], gold = [155, 108, 36], muted = [118, 110, 95];
  let y = 0;
  const text = (value, x, top, size = 10, bold = false, color = ink, options = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(value, x, top, options);
  };
  function header() {
    doc.setFillColor(249, 246, 238); doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...gold); doc.rect(M, 36, 30, 3, 'F');
    text('PLAY MONEY  /  AUTOMEZZI', M, 58, 9, true, gold);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
    const title = doc.splitTextToSize(String(vehicle.name || 'Automezzo'), R - M);
    text(title, M, 94, 22, true);
    y = 94 + (title.length - 1) * 25 + 25;
    text(`Targa: ${vehicle.plate || '-'}`, M, y, 11, true);
    y += 20;
    text(`Periodo: ${dateLabel(range.from)} - ${dateLabel(range.to)}`, M, y, 10, false, muted);
    y += 25;
  }
  function tableHeader() {
    doc.setFillColor(...ink); doc.roundedRect(M, y, R - M, 29, 4, 4, 'F');
    text('DATA', M + 10, y + 19, 8, true, [255, 255, 255]);
    text('DIPENDENTE', 137, y + 19, 8, true, [255, 255, 255]);
    text('KM INSERITI', 434, y + 19, 8, true, [255, 255, 255], { align: 'right' });
    text('RIFORNIMENTO', R - 10, y + 19, 8, true, [255, 255, 255], { align: 'right' });
    y += 29;
  }
  header();
  doc.setFillColor(238, 224, 185); doc.roundedRect(M, y, R - M, 97, 7, 7, 'F');
  text('KM ATTUALI', M + 14, y + 21, 8, true, gold);
  text(current ? `${kmLabel(current.km)} km` : '-', M + 14, y + 43, 19, true);
  text(current ? `Ultima lettura: ${dateLabel(current.date)}` : 'Nessuna lettura valida', M + 14, y + 63, 9, false, muted);
  text('Indipendenti dal periodo selezionato', M + 14, y + 81, 8, false, muted);
  text('KM PERCORSI NEL PERIODO', 315, y + 21, 8, true, gold);
  text(distance.km == null ? '-' : `${kmLabel(distance.km)} km`, 315, y + 43, 19, true);
  text(`Utilizzi: ${rows.length}`, 315, y + 63, 9, false, muted);
  text(`Rifornimenti: ${euroLabel(fuel)}`, 315, y + 81, 10, true);
  y += 116;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const note = doc.splitTextToSize(distance.message, R - M);
  text(note, M, y, 9, false, muted); y += note.length * 11 + 12;
  if (distance.start && distance.end) {
    text(`${dateLabel(distance.start.date)}: ${kmLabel(distance.start.km)} km  /  ${dateLabel(distance.end.date)}: ${kmLabel(distance.end.km)} km`, M, y, 9, true);
    y += 23;
  }
  tableHeader();
  if (!rows.length) { text('Nessun utilizzo registrato nel periodo selezionato.', M + 10, y + 26, 10, false, muted); y += 47; }
  rows.forEach((row, index) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const name = doc.splitTextToSize(String(employeeName(row.created_by) || 'Operatore non disponibile'), 185);
    const height = Math.max(37, name.length * 12 + 20);
    if (y + height > H - 48) { doc.addPage(); header(); tableHeader(); }
    doc.setFillColor(...(index % 2 ? [248, 244, 235] : [255, 253, 249])); doc.rect(M, y, R - M, height, 'F');
    doc.setDrawColor(230, 221, 201); doc.setLineWidth(0.5); doc.line(M, y + height, R, y + height);
    text(dateLabel(row.work_date), M + 10, y + 23, 9);
    text(name, 137, y + 23, 10);
    const reading = odometer(row.km);
    text(reading > 0 ? kmLabel(reading) : '-', 434, y + 23, 10, true, ink, { align: 'right' });
    text(Number(row.rifornimento) ? euroLabel(row.rifornimento) : '-', R - 10, y + 23, 10, true, gold, { align: 'right' });
    y += height;
  });
  if (y + 77 > H - 40) { doc.addPage(); header(); }
  y += 18;
  text('TOTALE RIFORNIMENTI NEL PERIODO', M + 10, y + 15, 9, true);
  text(euroLabel(fuel), R - 10, y + 15, 12, true, gold, { align: 'right' });
  text('Km inseriti = letture del contachilometri. Il trattino indica un dato non inserito.', M + 10, y + 38, 8, false, muted);
  return doc;
}
