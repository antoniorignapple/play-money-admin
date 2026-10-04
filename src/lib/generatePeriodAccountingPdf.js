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
  const M = 40, right = W - M, inner = W - M * 2;
  const ink = '#202B38', muted = '#627084', line = '#E4E8EE', gold = '#4288b4';
  let y;
  function text(value, x, top, size = 11, bold = false, color = ink, options = {}) {
    doc.setFont('Manrope', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    doc.setCharSpace(0); doc.text(value, x, top, options);
  }
  function header(section) {
    doc.setFillColor(ink); doc.rect(0, 0, W, 6, 'F');
    text('PLAY MONEY', M, 43, 12, true, gold);
    text('CONTABILITÀ CONTEGGI', M, 77, 23, true);
    text(`${fmtDate(period.date_from)} - ${fmtDate(period.date_to)}`, M, 99, 11, false, muted);
    doc.setDrawColor(line); doc.line(M, 115, right, 115);
    y = 144;
    if (section) { text(section, M, y, 15, true); y += 26; }
  }
  function next(section) { doc.addPage(); header(section); }
  function amountCard(label, amount, top, dark = false) {
    doc.setFillColor(dark ? ink : '#F3F5F8'); doc.roundedRect(M, top, inner, 70, 9, 9, 'F');
    text(label, M + 18, top + 29, 12, true, dark ? '#FFFFFF' : ink);
    text(euro(amount), right - 18, top + 46, 26, true, dark ? '#FFFFFF' : ink, { align: 'right' });
    y = top + 88;
  }
  function wrap(value, width) {
    doc.setFont('Manrope', 'normal'); doc.setFontSize(11); doc.setCharSpace(0);
    return doc.splitTextToSize(accountingText(value), width);
  }
  function columns(labels, xs, top) {
    doc.setFillColor('#F3F5F8'); doc.roundedRect(M, top, inner, 30, 5, 5, 'F');
    labels.forEach((label, i) => text(label, xs[i], top + 20, 10, true, muted, i === labels.length - 1 ? { align: 'right' } : {}));
    y = top + 30;
  }
  const movementHeading = () => columns(['DATA', 'MOVIMENTO', 'CIFRA'], [M + 12, M + 92, right - 12], y);
  header();
  const gap = 10, cardWidth = (inner - gap * 2) / 3;
  [['ESATTORE CONTEGGI', data.totals.esattore], ['RECUPERI ACCONTO AGGIO', data.totals.recuperi], ['TOTALE GLOBALE', data.totals.globale]].forEach(([label, amount], i) => {
    const x = M + i * (cardWidth + gap);
    doc.setFillColor(i === 2 ? ink : '#F3F5F8'); doc.roundedRect(x, 135, cardWidth, 78, 8, 8, 'F');
    text(label, x + 12, 157, 8.5, true, i === 2 ? '#75b3d9' : muted);
    doc.setFont('Manrope', 'bold');
    let size = 20; doc.setFontSize(size);
    while (doc.getTextWidth(euro(amount)) > cardWidth - 24 && size > 11) { size--; doc.setFontSize(size); }
    text(euro(amount), x + 12, 188, size, true, i === 2 ? '#FFFFFF' : ink);
  });
  y = 248; text('MOVIMENTI DEL PERIODO', M, y, 15, true); y += 17; movementHeading();
  const movementX = M + 92, movementWidth = inner - 204;
  for (const row of data.movements) {
    // Automatic shortage is a single clean movement without explanatory notes.
    const description = row.destination || row.description || '';
    const note = row.source === 'automatic' ? '' : row.note || '';
    const lines = [...wrap(description, movementWidth), ...(note ? wrap(note, movementWidth) : [])];
    // Split very long movements across pages without truncating their text.
    let offset = 0;
    do {
      if (y > H - 98) { next('MOVIMENTI DEL PERIODO'); movementHeading(); }
      const capacity = Math.max(1, Math.floor((H - 65 - y - 28) / 15));
      const block = lines.slice(offset, offset + capacity);
      const height = Math.max(44, block.length * 15 + 26);
      if (offset === 0) {
        text(fmtDate(row.workDate), M + 12, y + 25, 10, false, muted);
        text(euro(row.amount), right - 12, y + 25, 12, true, ink, { align: 'right' });
      }
      text(block, movementX, y + 25, 11);
      y += height; doc.setDrawColor(line); doc.line(M, y, right, y);
      offset += block.length;
      if (offset < lines.length) { next('MOVIMENTI DEL PERIODO'); movementHeading(); }
    } while (offset < lines.length);
  }
  if (y + 140 > H - 40) next('RIEPILOGO MOVIMENTI');
  text('TOTALE MOVIMENTI', M + 12, y + 28, 11, true, muted);
  text(euro(data.totals.movimenti), right - 12, y + 28, 13, true, ink, { align: 'right' });
  amountCard('SALDO AZIENDA', data.totals.saldo, y + 49, true);

  const debts = data.rows.filter(row => data.selectedIds.includes(String(row.id)) && Number(row.debito) > 0);
  if (debts.length) {
    next('RECUPERI ACCONTO AGGIO');
    const localeX = M + 90, operatorX = M + 285;
    const debtHeading = () => columns(['DATA', 'LOCALE', 'OPERAIO', 'CIFRA'], [M + 12, localeX, operatorX, right - 12], y);
    debtHeading();
    for (const row of debts) {
      const locale = wrap(venues[String(row.venue_id)] || row.venue_id || '', 180);
      const operator = wrap(row.operator_name || row.executor_name_snapshot || '-', 110);
      let offset = 0;
      const count = Math.max(locale.length, operator.length);
      do {
        if (y > H - 98) { next('RECUPERI ACCONTO AGGIO'); debtHeading(); }
        const capacity = Math.max(1, Math.floor((H - 65 - y - 28) / 15));
        const localeBlock = locale.slice(offset, offset + capacity), operatorBlock = operator.slice(offset, offset + capacity);
        const length = Math.min(capacity, count - offset), height = Math.max(48, length * 15 + 26);
        if (offset === 0) {
          const amount = data.debtAmounts[String(row.id)] ?? Math.trunc(Number(row.debito));
          text(fmtDate(row.conteggio_date), M + 12, y + 26, 10, false, muted);
          text(euro(amount), right - 12, y + 26, 12, true, ink, { align: 'right' });
        }
        if (localeBlock.length) text(localeBlock, localeX, y + 26, 11);
        if (operatorBlock.length) text(operatorBlock, operatorX, y + 26, 11);
        offset += length; y += height; doc.setDrawColor(line); doc.line(M, y, right, y);
        if (offset < count) { next('RECUPERI ACCONTO AGGIO'); debtHeading(); }
      } while (offset < count);
    }
    if (y + 96 > H - 40) next('RECUPERI ACCONTO AGGIO');
    amountCard('TOTALE RECUPERI', data.totals.recuperi, y + 20);
  }
  return doc;
}
