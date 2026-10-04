import { jsPDF } from 'jspdf';
import { regular, bold } from './accountingPdfFonts.js';
import { fmtDate } from './officeCash.js';

export function generateFleetPdf(rows, today) {
  if (!rows.length) throw new Error('Seleziona almeno un automezzo disponibile.');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.addFileToVFS('Manrope-Regular.ttf', regular); doc.addFont('Manrope-Regular.ttf', 'Manrope', 'normal');
  doc.addFileToVFS('Manrope-Bold.ttf', bold); doc.addFont('Manrope-Bold.ttf', 'Manrope', 'bold');
  doc.setProperties({ title: 'Play Money - Parco Automezzi', author: 'Play Money Admin' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 40, right = W - M, inner = W - M * 2, ink = '#202B38', muted = '#627084';
  let y;
  const text = (value, x, top, size = 11, weight = false, color = ink, options = {}) => {
    doc.setFont('Manrope', weight ? 'bold' : 'normal'); doc.setFontSize(size); doc.setCharSpace(0); doc.setTextColor(color);
    doc.text(value, x, top, options);
  };
  const header = () => {
    doc.setFillColor(ink); doc.rect(0, 0, W, 6, 'F');
    text('PLAY MONEY', M, 43, 12, true, '#4288b4');
    text('PARCO AUTOMEZZI', M, 80, 26, true);
    text(`SITUAZIONE AL ${fmtDate(today)}`, M, 104, 10, false, muted);
    doc.setFillColor('#F3F5F8'); doc.roundedRect(M, 126, inner, 62, 8, 8, 'F');
    text(`${rows.length} ${rows.length === 1 ? 'MEZZO SELEZIONATO' : 'MEZZI SELEZIONATI'}`, M + 16, 151, 11, true);
    text('ULTIME LETTURE REGISTRATE', M + 16, 172, 10, false, muted);
    y = 210;
    doc.setFillColor(ink); doc.roundedRect(M, y, inner, 32, 5, 5, 'F');
    text('MEZZO', M + 12, y + 21, 10, true, '#FFFFFF');
    text('TARGA', M + 230, y + 21, 10, true, '#FFFFFF');
    text('KM ATTUALI', right - 12, y + 21, 10, true, '#FFFFFF', { align: 'right' });
    y += 32;
  };
  header();
  for (const row of rows) {
    doc.setFont('Manrope', 'bold'); doc.setFontSize(12);
    const lines = doc.splitTextToSize(row.name || 'MEZZO SENZA NOME', 202);
    let offset = 0;
    do {
      if (y > H - 108) { doc.addPage(); header(); }
      const capacity = Math.max(1, Math.floor((H - 54 - y - 32) / 17));
      const block = lines.slice(offset, offset + capacity);
      const height = Math.max(72, block.length * 17 + 32);
      doc.setFillColor('#FAFBFC'); doc.rect(M, y, inner, height, 'F');
      text(block, M + 12, y + 29, 12, true);
      if (offset === 0) {
        doc.setFont('Manrope', 'bold'); doc.setFontSize(11);
        const plateLines = doc.splitTextToSize(row.plate || '-', 105);
        text(plateLines, M + 230, y + 29, 11, true);
        const km = row.reading ? row.reading.km.toLocaleString('it-IT', { useGrouping: 'always' }) : 'NON DISPONIBILI';
        text(km, right - 12, y + 29, row.reading ? 15 : 9, true, ink, { align: 'right' });
      }
      y += height; doc.setDrawColor('#E4E8EE'); doc.line(M, y, right, y);
      offset += block.length;
      if (offset < lines.length) { doc.addPage(); header(); }
    } while (offset < lines.length);
  }
  return doc;
}
