import { jsPDF } from 'jspdf';
import { getChangeImage } from './changeImages.js';
import { regular, bold } from './accountingPdfFonts.js';
import { normalizeReportSlots } from './localiReportData.js';

const euro = value => Number(value ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
const date = value => {
  if (!value) return 'Non disponibile';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Non disponibile' : parsed.toLocaleString('it-IT', {
    timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};
export async function loadReportImage(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Immagine Change non disponibile: ${path}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return { data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

export async function generateLocaliPdf(venues, { generatedAt = new Date(), loadImage = loadReportImage } = {}) {
  if (!venues.length) throw new Error('Nessun locale con Change da esportare.');
  const machines = venues.flatMap(venue => venue.machines);
  for (const machine of machines) {
    for (const field of ['level', 'fondo']) {
      if (machine[field] != null && !Number.isFinite(Number(machine[field]))) {
        throw new Error(`Importo non valido per ${machine.name}: ${field}`);
      }
    }
  }
  const paths = [...new Set(machines.map(machine => getChangeImage(machine.name)))];
  const images = new Map(await Promise.all(paths.map(async path => [path, await loadImage(path)])));
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.addFileToVFS('Manrope-Regular.ttf', regular);
  doc.addFont('Manrope-Regular.ttf', 'Manrope', 'normal');
  doc.addFileToVFS('Manrope-Bold.ttf', bold);
  doc.addFont('Manrope-Bold.ttf', 'Manrope', 'bold');
  doc.setProperties({ title: 'Play Money - Locali e Change', subject: 'Livelli attuali, fondi cassa e parco slot', author: 'Play Money Admin' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 32, inner = width - margin * 2, bottom = height - 32;
  let y;
  const text = (value, x, top, size = 10, bold = false, color = '#302817') => {
    doc.setFont('Manrope', bold ? 'bold' : 'normal');
    doc.setFontSize(size); doc.setTextColor(color); doc.text(Array.isArray(value) ? value : String(value), x, top);
  };
  const wrap = (value, maxWidth, size = 10, bold = false) => {
    doc.setFont('Manrope', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    return doc.splitTextToSize(String(value), maxWidth);
  };
  const page = (first = false) => {
    if (!first) doc.addPage();
    doc.setFillColor('#80530d'); doc.rect(0, 0, width, 66, 'F');
    text('PLAY MONEY / LOCALI E CHANGE', margin, 28, 16, true, '#ffffff');
    text(`Situazione al ${date(generatedAt)}`, margin, 48, 9, false, '#fff1cf');
    y = 82;
  };
  page(true);
  const levelTotal = machines.reduce((sum, m) => sum + Number(m.level ?? 0), 0);
  const fundTotal = machines.reduce((sum, m) => sum + Number(m.fondo ?? 0), 0);
  text(`${venues.length} locali  |  ${machines.length} Change`, margin, y, 12, true); y += 19;
  text(`Livello totale: ${euro(levelTotal)}     Fondo totale: ${euro(fundTotal)}`, margin, y, 11, true); y += 17;
  text('Sono inclusi tutti i locali con Change, indipendentemente dalla ricerca in schermata.', margin, y, 8); y += 23;
  if (machines.some(m => m.level == null || m.fondo == null)) {
    text('Attenzione: gli importi non disponibili sono esclusi dai totali.', margin, y, 9, true, '#b42318'); y += 20;
  }
  const metric = (value, x, top, color) => {
    doc.setFont('Manrope', 'bold'); doc.setFontSize(11);
    const size = Math.min(11, 11 * 205 / Math.max(205, doc.getTextWidth(value)));
    text(value, x, top, size, true, color);
  };
  for (const venue of venues) {
    const slots = normalizeReportSlots(venue.slots || []);
    const slotTotal = slots.reduce((sum, slot) => sum + slot.quantity, 0);
    const slotText = slots.length ? slots.map(slot => `${slot.model} × ${slot.quantity}`).join('  ·  ') : 'Parco slot non compilato';
    const totalLabel = slots.length ? `${slotTotal} SLOT` : '';
    doc.setFont('Manrope', 'bold'); doc.setFontSize(9);
    const totalWidth = Math.max(57, doc.getTextWidth(totalLabel));
    const slotLines = wrap(slotText, inner - 118 - totalWidth, 9);
    const slotHeight = Math.max(35, 19 + slotLines.length * 12);
    const title = wrap(`${venue.id} - ${venue.name}`, inner - 20, 12, true);
    const city = wrap(venue.city || 'Città non disponibile', inner - 20, 9);
    const headingHeight = 32 + title.length * 14 + city.length * 11;
    if (headingHeight + 104 > bottom - 82) throw new Error('Nome locale troppo lungo per il PDF.');
    const heading = (continued = false) => {
      doc.setFillColor('#f2e5c9'); doc.roundedRect(margin, y, inner, headingHeight, 5, 5, 'F');
      text(title, margin + 10, y + 17, 12, true);
      text(city, margin + 10, y + 19 + title.length * 14, 9);
      text(continued ? 'Locale - continuazione' : `${venue.machines.length} Change | Livello: ${euro(venue.machines.reduce((s,m)=>s+Number(m.level ?? 0),0))} | Fondo: ${euro(venue.machines.reduce((s,m)=>s+Number(m.fondo ?? 0),0))}`, margin + 10, y + headingHeight - 9, 9, true);
      y += headingHeight + 6;
    };
    if (y + headingHeight + 104 > bottom) page();
    heading();
    for (const [index, machine] of venue.machines.entries()) {
      const name = wrap(machine.name || 'Change senza nome', inner - 94, 11, true);
      const rowHeight = Math.max(94, 61 + name.length * 13);
      const reserve = index === venue.machines.length - 1 && headingHeight + 6 + rowHeight + slotHeight <= bottom - 82 ? slotHeight : 0;
      if (y + rowHeight + reserve > bottom) { page(); heading(true); }
      if (y + rowHeight > bottom) throw new Error('Nome Change troppo lungo per il PDF.');
      doc.setDrawColor('#e2d7c2'); doc.setFillColor('#fffdf8');
      doc.roundedRect(margin, y, inner, rowHeight - 4, 4, 4, 'FD');
      const asset = images.get(getChangeImage(machine.name));
      const scale = Math.min(54 / asset.width, (rowHeight - 16) / asset.height);
      const iw = asset.width * scale, ih = asset.height * scale;
      doc.addImage(asset.data, 'PNG', margin + 9 + (54 - iw) / 2, y + (rowHeight - 4 - ih) / 2, iw, ih, getChangeImage(machine.name), 'FAST');
      const x = margin + 78;
      text(name, x, y + 18, 11, true);
      const base = y + 20 + name.length * 13;
      metric(`Livello attuale: ${machine.level == null ? 'Non disponibile' : euro(machine.level)}`, x, base, Number(machine.level) < 0 ? '#b42318' : '#087849');
      metric(`Fondo cassa: ${machine.fondo == null ? 'Non disponibile' : euro(machine.fondo)}`, x + 220, base, '#302817');
      text(`Ultimo aggiornamento: ${date(machine.last_update)}`, x, base + 20, 9, false, '#60594b');
      y += rowHeight;
    }
    if (y + slotHeight > bottom) { page(); heading(true); }
    if (y + slotHeight > bottom) throw new Error('Parco slot troppo lungo per il PDF.');
    doc.setFillColor('#f4eddd'); doc.setDrawColor('#dac8a5');
    doc.roundedRect(margin, y, inner, slotHeight, 4, 4, 'FD');
    text('PARCO SLOT', margin + 10, y + 21, 9, true, '#80530d');
    text(slotLines, margin + 98, y + 21, 9);
    text(totalLabel, width - margin - 10 - totalWidth, y + 21, 9, true, '#80530d');
    y += slotHeight + 12;
  }
  return doc;
}
