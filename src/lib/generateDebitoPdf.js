import { jsPDF } from 'jspdf';
import { debtLedger, euro } from './debtLedger.js';
const dateLabel = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : 'Data non disponibile';
export function buildDebitoPdf({ debt, repayments = [], disbursements = [], venue }) {
  const ledger = debtLedger(debt, repayments, disbursements);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setProperties({ title: `Riepilogo debito - ${venue}`, subject: 'Erogazioni e rimborsi', author: 'Play Money' });
  const W = 595.28, H = 841.89, M = 40, right = W - M;
  const gold = [155, 108, 36], ink = [53, 42, 24], muted = [118, 110, 95];
  let y;
  function header() {
    doc.setFillColor(249, 246, 238); doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...gold); doc.rect(M, 36, 30, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...gold);
    doc.text('PLAY MONEY  /  RIEPILOGO DEBITO', M, 58);
    doc.setTextColor(...ink); doc.setFontSize(21);
    const title = doc.splitTextToSize(venue || 'Locale', W - M * 2);
    doc.text(title, M, 94); y = 94 + (title.length - 1) * 24 + 30;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...muted);
    doc.text('Erogazioni e rimborsi in ordine cronologico', M, y); y += 22;
    doc.setFillColor(...ink); doc.roundedRect(M, y, right - M, 30, 5, 5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('DATA', M + 12, y + 19); doc.text('EROGATO', 359, y + 19, { align: 'right' }); doc.text('RIMBORSATO', right - 12, y + 19, { align: 'right' });
    y += 30;
  }
  header();
  ledger.rows.forEach((r, i) => {
    if (y + 43 > H - M) { doc.addPage(); header(); }
    doc.setFillColor(...(i % 2 ? [248, 244, 235] : [255, 253, 249])); doc.rect(M, y, right - M, 43, 'F');
    doc.setDrawColor(230, 221, 201); doc.setLineWidth(0.5);
    [255, 382].forEach(x => doc.line(x, y, x, y + 43)); doc.line(M, y + 43, right, y + 43);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...ink);
    doc.text(dateLabel(r.date), M + 12, y + 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...muted); doc.text(r.label, M + 12, y + 31);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...gold);
    doc.text(r.paid ? euro(r.paid) : '-', 359, y + 25, { align: 'right' });
    doc.setTextColor(...ink); doc.text(r.repaid ? euro(r.repaid) : '-', right - 12, y + 25, { align: 'right' });
    y += 43;
  });
  const note = ledger.difference !== 0 ? doc.splitTextToSize(`Storico pregresso da verificare: il saldo dei movimenti differisce dal residuo registrato di ${euro(ledger.difference)}. Non sono stati aggiunti rimborsi presunti.`, right - M - 24) : [];
  const boxHeight = 122 + note.length * 12;
  if (y + boxHeight > H - M) { doc.addPage(); header(); }
  y += 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...ink);
  doc.text('TOTALE MOVIMENTI', M + 12, y + 14); doc.text(euro(ledger.paid), 359, y + 14, { align: 'right' }); doc.text(euro(ledger.repaid), right - 12, y + 14, { align: 'right' });
  y += 34;
  doc.setFillColor(238, 224, 185); doc.roundedRect(M, y, right - M, 60, 8, 8, 'F');
  doc.setFontSize(9); doc.text('RESIDUO DA RIMBORSARE', M + 16, y + 24);
  doc.setFontSize(23); doc.text(euro(ledger.remaining), right - 16, y + 39, { align: 'right' });
  if (note.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...muted); doc.text(note, M + 12, y + 78); }
  return doc;
}
