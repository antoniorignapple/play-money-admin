import { jsPDF } from 'jspdf';
import { regular, bold } from './accountingPdfFonts.js';
import { euro, fmtDate } from './officeCash.js';

export const accountingText = value => String(value ?? '').toLocaleUpperCase('it-IT');

export function generatePeriodAccountingPdf(data, period, venues = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.addFileToVFS('Manrope-Regular.ttf', regular); doc.addFont('Manrope-Regular.ttf', 'Manrope', 'normal');
  doc.addFileToVFS('Manrope-Bold.ttf', bold); doc.addFont('Manrope-Bold.ttf', 'Manrope', 'bold');
  doc.setProperties({ title: 'Play Money - Contabilità Conteggi', author: 'Play Money Admin' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 32, right = W - M, inner = W - M * 2;
  const ink = '#16384D', blue = '#246C99', muted = '#607786', line = '#DCE8EF', pale = '#EEF6FB';
  let y = 0;
  function text(value, x, top, size = 10, heavy = false, color = ink, options = {}) {
    doc.setFont('Manrope', heavy ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    doc.setCharSpace(0); doc.text(value, x, top, options);
  }
  function header(section = 'CONTABILITÀ CONTEGGI') {
    doc.setFillColor(blue); doc.rect(0, 0, W, 4, 'F');
    text('PLAY MONEY / ADMIN', M, 31, 9, true, blue);
    text(section, M, 57, 19, true);
    text(`${fmtDate(period.date_from)} — ${fmtDate(period.date_to)}`, right, 31, 9, false, muted, { align: 'right' });
    doc.setDrawColor(line); doc.line(M, 72, right, 72); y = 88;
  }
  function next(section) { doc.addPage(); header(section); }
  function wrap(value, width, size = 10) {
    doc.setFont('Manrope', 'normal'); doc.setFontSize(size); doc.setCharSpace(0);
    return doc.splitTextToSize(accountingText(value).replace(/\s+/g, ' ').trim() || '—', width);
  }
  function columns(labels, xs) {
    doc.setFillColor(pale); doc.roundedRect(M, y, inner, 24, 4, 4, 'F');
    labels.forEach((label, i) => text(label, xs[i], y + 16, 8.5, true, muted, i === labels.length - 1 ? { align: 'right' } : {}));
    y += 24;
  }
  const movementX = M + 90, movementWidth = inner - 184;
  const movementHeading = () => columns(['DATA', 'MOVIMENTO', 'IMPORTO'], [M + 9, movementX, right - 9]);
  const movements = data.movements.map(row => {
    const description = row.destination || row.description || '';
    const note = row.source === 'automatic' ? '' : row.note || '';
    return { row, lines: wrap([description, note].filter(Boolean).join(' · '), movementWidth) };
  });
  const rowHeight = item => Math.max(25, item.lines.length * 13 + 12);
  function movementRow(item, start = 0, count = item.lines.length) {
    const height = Math.max(25, count * 13 + 12);
    if (start === 0) {
      text(fmtDate(item.row.workDate), M + 9, y + 17, 9, false, muted);
      text(euro(item.row.amount), right - 9, y + 17, 10, true, ink, { align: 'right' });
    }
    text(item.lines.slice(start, start + count), movementX, y + 17, 10, false, ink, { lineHeightFactor: 1.3 });
    y += height; doc.setDrawColor(line); doc.line(M, y, right, y);
  }
  header();
  const gap = 8, cardWidth = (inner - gap * 2) / 3;
  [['ESATTORE CONTEGGI', data.totals.esattore], ['RECUPERI ACCONTO AGGIO', data.totals.recuperi], ['TOTALE GLOBALE', data.totals.globale]].forEach(([label, amount], i) => {
    const x = M + i * (cardWidth + gap);
    doc.setFillColor(i === 2 ? ink : pale); doc.roundedRect(x, y, cardWidth, 55, 6, 6, 'F');
    text(label, x + 10, y + 17, 7.5, true, i === 2 ? '#BFE3FA' : muted);
    let size = 18; doc.setFont('Manrope', 'bold'); doc.setFontSize(size);
    while (doc.getTextWidth(euro(amount)) > cardWidth - 20 && size > 9) { size--; doc.setFontSize(size); }
    text(euro(amount), x + 10, y + 41, size, true, i === 2 ? '#FFFFFF' : ink);
  });
  y += 78; text('MOVIMENTI DEL PERIODO', M, y, 11, true); y += 12; movementHeading();
  // Reserve the financial summary before laying out any detail: it always stays on page one.
  const summaryLimit = H - M - 110;
  let shown = 0;
  while (shown < movements.length && y + rowHeight(movements[shown]) <= summaryLimit) movementRow(movements[shown++]);
  if (shown < movements.length) {
    y += 17; text(`ALTRI ${movements.length - shown} MOVIMENTI NEL DETTAGLIO ALLEGATO`, M + 9, y, 8, true, blue);
  }
  y += 24;
  text('TOTALE MOVIMENTI', M + 10, y, 10, true, muted);
  text(euro(data.totals.movimenti), right - 10, y, 12, true, ink, { align: 'right' });
  y += 14;
  doc.setFillColor(ink); doc.roundedRect(M, y, inner, 49, 6, 6, 'F');
  text('SALDO AZIENDA', M + 14, y + 29, 11, true, '#FFFFFF');
  text(euro(data.totals.saldo), right - 14, y + 32, 22, true, '#FFFFFF', { align: 'right' });

  const debts = data.rows.filter(row => data.selectedIds.includes(String(row.id)) && Number(row.debito) > 0);
  if (debts.length) {
    next('DEBITI / RECUPERI ACCONTO AGGIO');
    const localeX = M + 87, operatorX = M + 299;
    const debtHeading = () => columns(['DATA', 'LOCALE', 'OPERAIO', 'IMPORTO'], [M + 9, localeX, operatorX, right - 9]);
    debtHeading();
    for (const row of debts) {
      const locale = wrap(venues[String(row.venue_id)] || row.venue_id || '', 200);
      const operator = wrap(row.operator_name || row.executor_name_snapshot || '—', 100);
      const count = Math.max(locale.length, operator.length);
      let offset = 0;
      while (offset < count) {
        // Keep enough room for the total beneath the last table row.
        if (y + 25 > H - M - 65) { next('DEBITI / RECUPERI ACCONTO AGGIO'); debtHeading(); }
        const capacity = Math.max(1, Math.floor((H - M - 65 - y - 12) / 13));
        const length = Math.min(capacity, count - offset);
        if (offset === 0) {
          text(fmtDate(row.conteggio_date), M + 9, y + 17, 9, false, muted);
          text(euro(data.debtAmounts[String(row.id)] ?? Math.trunc(Number(row.debito))), right - 9, y + 17, 10, true, ink, { align: 'right' });
        }
        if (offset < locale.length) text(locale.slice(offset, offset + length), localeX, y + 17, 10, false, ink, { lineHeightFactor: 1.3 });
        if (offset < operator.length) text(operator.slice(offset, offset + length), operatorX, y + 17, 10, false, ink, { lineHeightFactor: 1.3 });
        y += Math.max(25, length * 13 + 12); offset += length;
        doc.setDrawColor(line); doc.line(M, y, right, y);
      }
    }
    y += 14; doc.setFillColor(pale); doc.roundedRect(M, y, inner, 40, 6, 6, 'F');
    text('TOTALE RECUPERI', M + 12, y + 25, 10, true);
    text(euro(data.totals.recuperi), right - 12, y + 27, 17, true, blue, { align: 'right' });
  }
  if (shown < movements.length) {
    next('DETTAGLIO MOVIMENTI · CONTINUAZIONE'); movementHeading();
    for (const item of movements.slice(shown)) {
      let offset = 0;
      while (offset < item.lines.length) {
        if (y + 25 > H - M) { next('DETTAGLIO MOVIMENTI · CONTINUAZIONE'); movementHeading(); }
        const capacity = Math.max(1, Math.floor((H - M - y - 12) / 13));
        const count = Math.min(capacity, item.lines.length - offset);
        movementRow(item, offset, count); offset += count;
      }
    }
  }
  return doc;
}
