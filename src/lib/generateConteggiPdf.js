// ═══════════════════════════════════════════════════════════════════
// 📄 GENERAZIONE PDF CONTEGGI
// Codice 1:1 dall'app legacy "Play Money" — non modificato.
// ═══════════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf';

const toDataUrl = async (url) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

async function generateConteggiPdf({
  venuesSelected,
  totalsByVenueId,
  toolData,
  dateFrom,
  dateTo,
  dipendenteName,
  userEmail,
  targetWin,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

  let logoDataUrl = null;
  try {
    logoDataUrl = await toDataUrl('/icons/logo-pdf.png');
  } catch (e) {
    console.warn('Logo PDF non caricato', e);
  }

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 28;

  const C = {
    text: [15, 23, 42],
    muted: [100, 116, 139],
    softMuted: [148, 163, 184],
    white: [255, 255, 255],
    black: [0, 0, 0],
    navy: [15, 23, 42],
    navySoft: [30, 41, 59],
    gold: [184, 134, 11],
    goldDark: [146, 96, 0],
    goldSoft: [245, 208, 66],
    goldBg: [255, 248, 220],
    green: [21, 128, 61],
    greenBg: [220, 252, 231],
    red: [185, 28, 28],
    redBg: [254, 226, 226],
    grayBg: [248, 250, 252],
    grayBg2: [241, 245, 249],
    line: [203, 213, 225],
    lineLight: [226, 232, 240],
  };

  const n0 = (v) => Math.trunc(Number(v) || 0);
  const formatNum = (n) =>
    n0(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
  const formatEuro = (n) => `${formatNum(n)} €`;
  const formatSignedEuro = (n) => {
    const num = n0(n);
    if (num > 0) return `+${formatNum(num)} €`;
    if (num < 0) return `-${formatNum(Math.abs(num))} €`;
    return '0 €';
  };
  const formatSignedEuroTable = (n) => formatSignedEuro(n);

  const toIT = (d) => {
    if (!d || d.length < 10) return d || '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const cleanLocaleName = (name) =>
    String(name || '')
      .trim()
      .replace(/^K\d+\s*/i, '')
      .replace(/^[-–]\s*/, '');

  const calcRow = (v) => {
    const tool = toolData && toolData[v.id] ? toolData[v.id] : null;
    const esattore = tool ? Number(tool.esattore) || 0 : 0;
    const ricevute = tool
      ? n0(tool.ricevute ?? tool.acconti ?? totalsByVenueId?.[v.id] ?? 0)
      : 0;
    const riporto = tool ? n0(tool.riporto) : 0;
    const carta = tool ? n0(tool.carta) : 0;
    const monete = tool ? n0(tool.monete) : 0;
    const usoCassa = tool ? n0(tool.uso_cassa) : 0;
    const debito = tool ? n0(tool.debito) : 0;
    const debitoVirt = tool ? n0(tool.debito_virt) : 0;
    const assegni = tool ? n0(tool.assegno) : 0;
    const bonus = tool ? n0(tool.bonus) : 0;
    const cassaDepositi = carta + monete - usoCassa;
    const finale =
      ricevute + riporto + cassaDepositi + assegni - debito - n0(esattore);

    return {
      id: v.id,
      name: cleanLocaleName(v.name),
      hasTool: !!tool,
      esattore,
      ricevute,
      riporto,
      carta,
      monete,
      usoCassa,
      cassaDepositi,
      debito,
      debitoVirt,
      assegni,
      bonus,
      finale,
    };
  };

  const rows = venuesSelected.map(calcRow);

  const riepilogo = rows.reduce(
    (a, r) => {
      a.esattore += r.esattore;
      a.ricevute += r.ricevute;
      a.riporto += r.riporto;
      a.cassaDepositi += r.cassaDepositi;
      a.debito += r.debito;
      a.debitoVirt += r.debitoVirt;
      a.assegni += r.assegni;
      a.bonus += r.bonus;
      return a;
    },
    {
      esattore: 0,
      ricevute: 0,
      riporto: 0,
      cassaDepositi: 0,
      debito: 0,
      debitoVirt: 0,
      assegni: 0,
      bonus: 0,
    }
  );

  riepilogo.finale =
    riepilogo.ricevute +
    riepilogo.riporto +
    riepilogo.cassaDepositi +
    riepilogo.assegni -
    riepilogo.debito -
    riepilogo.esattore;

  const rowsPerPage = 23;
  const boxesPerPage = 9;
  const totalTablePages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const totalBoxPages = Math.max(1, Math.ceil(rows.length / boxesPerPage));
  const totalPages = totalTablePages + totalBoxPages;

  const drawHeader = (pageNum) => {
    const headerH = 72;
    doc.setFillColor(...C.white);
    doc.rect(0, 0, pageW, headerH, 'F');
    doc.setFillColor(...C.goldBg);
    doc.rect(0, headerH - 8, pageW, 8, 'F');
    doc.setDrawColor(...C.gold);
    doc.setLineWidth(1.2);
    doc.line(M, headerH - 8, pageW - M, headerH - 8);

    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', M, 17, 44, 44);
      } catch (e) {
        console.warn('Errore stampa logo PDF:', e);
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(25);
    doc.setTextColor(245, 195, 54);
    doc.text('PLAY MONEY', M + 58, 42);

    doc.setFillColor(...C.gold);
    doc.roundedRect(M + 58, 50, 94, 16, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.white);
    doc.text('REPORT CONTEGGI', M + 105, 61, { align: 'center' });

    const cardW = 218;
    const cardH = 48;
    const cardX = pageW - M - cardW;
    const cardY = 17;
    doc.setFillColor(...C.grayBg);
    doc.setDrawColor(...C.lineLight);
    doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.goldDark);
    doc.text('PERIODO CONTEGGI', cardX + 12, cardY + 13);

    const midX = cardX + cardW / 2;
    doc.setDrawColor(...C.lineLight);
    doc.setLineWidth(0.7);
    doc.line(midX, cardY + 18, midX, cardY + cardH - 9);

    doc.setFontSize(6.8);
    doc.setTextColor(...C.muted);
    doc.text('DAL', cardX + 12, cardY + 28);
    doc.text('AL', midX + 12, cardY + 28);

    doc.setFontSize(11);
    doc.setTextColor(...C.navy);
    doc.text(toIT(dateFrom), cardX + 12, cardY + 42);
    doc.text(toIT(dateTo), midX + 12, cardY + 42);

    return headerH + 10;
  };

  const drawFooter = (pageNum) => {
    const y = pageH - 28;
    doc.setDrawColor(...C.lineLight);
    doc.setLineWidth(0.6);
    doc.line(M, y - 10, pageW - M, y - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(`Pagina ${pageNum} di ${totalPages}`, M, y);

    const now = new Date();
    const genDate =
      now.toLocaleDateString('it-IT') +
      ' ore ' +
      now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    doc.text(`Generato il ${genDate}`, pageW - M, y, { align: 'right' });
  };

  const drawFinalBadge = (x, y, w, h, value) => {
    const finale = n0(value);
    if (finale > 0) doc.setFillColor(...C.greenBg);
    else if (finale < 0) doc.setFillColor(...C.redBg);
    else doc.setFillColor(...C.grayBg2);
    doc.rect(x, y, w, h, 'F');
    doc.setDrawColor(...C.lineLight);
    doc.line(x, y + 11, x, y + h - 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.goldDark);
    doc.text('TOTALE', x + w / 2, y + 26, { align: 'center' });
    doc.setFontSize(16);
    if (finale > 0) doc.setTextColor(...C.green);
    else if (finale < 0) doc.setTextColor(...C.red);
    else doc.setTextColor(...C.text);
    doc.text(formatSignedEuro(finale), x + w / 2, y + 51, { align: 'center' });
  };

  const drawSummary = (y) => {
    const boxX = M;
    const boxW = pageW - M * 2;
    const boxH = 74;
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.8);
    doc.roundedRect(boxX, y, boxW, boxH, 12, 12, 'FD');

    const finalW = 108;
    const normalW = (boxW - finalW) / 6;
    const items = [
      ['ESATTORE', formatEuro(riepilogo.esattore)],
      ['RICEVUTE', formatEuro(riepilogo.ricevute)],
      ['DA RIP.', formatEuro(riepilogo.riporto)],
      ['CASSA/DEP.', formatEuro(riepilogo.cassaDepositi)],
      ['ASSEGNI', formatEuro(riepilogo.assegni)],
      ['DEBITI', formatEuro(riepilogo.debito)],
    ];

    items.forEach(([label, value], i) => {
      const x = boxX + i * normalW;
      if (i > 0) {
        doc.setDrawColor(...C.lineLight);
        doc.line(x, y + 11, x, y + boxH - 11);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.goldDark);
      doc.text(label, x + normalW / 2, y + 26, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(...C.text);
      doc.text(value, x + normalW / 2, y + 51, { align: 'center' });
    });

    drawFinalBadge(boxX + normalW * 6, y, finalW, boxH, riepilogo.finale);
  };

  const drawTablePages = () => {
    let page = 1;

    for (let p = 0; p < totalTablePages; p++) {
      if (p > 0) doc.addPage();
      let y = drawHeader(page);

      const cols = [
        { label: 'LOCALE', w: 142, align: 'left' },
        { label: 'ESATTORE', w: 66 },
        { label: 'RICEVUTE', w: 58 },
        { label: 'DA RIP.', w: 52 },
        { label: 'DEBITO', w: 50 },
        { label: 'DEB.VIRT.', w: 56 },
        { label: 'ASSEGNI', w: 56 },
        { label: 'FINALE', w: 62 },
      ];

      const tableX = M;
      const tableW = pageW - M * 2;
      const scale = tableW / cols.reduce((s, c) => s + c.w, 0);

      let cx = tableX;
      const sc = cols.map((c) => {
        const col = { ...c, x: cx, w: Math.floor(c.w * scale) };
        cx += col.w;
        return col;
      });
      sc[sc.length - 1].w = tableX + tableW - sc[sc.length - 1].x;

      const headerH = 28;
      const rowH = 23;

      doc.setFillColor(...C.gold);
      doc.roundedRect(tableX, y, tableW, headerH, 8, 8, 'F');
      doc.rect(tableX, y + 20, tableW, 11, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.white);

      sc.forEach((col, i) => {
        const tx = col.align === 'left' ? col.x + 7 : col.x + col.w / 2;
        const align = col.align === 'left' ? 'left' : 'center';
        doc.text(col.label, tx, y + 20, { align });
        if (i > 0) {
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.5);
          doc.line(col.x, y + 5, col.x, y + headerH - 5);
        }
      });

      y += headerH;

      const pageRows = rows.slice(p * rowsPerPage, p * rowsPerPage + rowsPerPage);

      pageRows.forEach((r, idx) => {
        doc.setFillColor(...(idx % 2 === 0 ? C.white : C.grayBg));
        doc.rect(tableX, y, tableW, rowH, 'F');
        doc.setDrawColor(...C.lineLight);
        doc.setLineWidth(0.5);
        doc.line(tableX, y + rowH, tableX + tableW, y + rowH);

        sc.forEach((col, i) => {
          if (i > 0) {
            doc.setDrawColor(...C.lineLight);
            doc.line(col.x, y, col.x, y + rowH);
          }
        });

        const values = [
          r.name,
          r.esattore !== 0 ? formatNum(r.esattore) : '',
          r.ricevute !== 0 ? formatNum(r.ricevute) : '',
          r.riporto !== 0 ? formatNum(r.riporto) : '',
          r.debito !== 0 ? formatNum(r.debito) : '',
          r.debitoVirt !== 0 ? formatNum(r.debitoVirt) : '',
          r.assegni !== 0 ? formatNum(r.assegni) : '',
          formatSignedEuroTable(r.finale),
        ];

        values.forEach((val, i) => {
          const col = sc[i];
          doc.setFont('helvetica', i === 0 ? 'normal' : 'bold');
          doc.setFontSize(i === 0 ? 9.4 : 10.4);
          doc.setTextColor(...C.text);
          if (i === 7) {
            if (r.finale > 0) doc.setTextColor(...C.green);
            else if (r.finale < 0) doc.setTextColor(...C.red);
          }
          const text = i === 0 ? doc.splitTextToSize(val, col.w - 8)[0] || '' : val;
          doc.text(text, i === 0 ? col.x + 7 : col.x + col.w / 2, y + 16, {
            align: i === 0 ? 'left' : 'center',
          });
        });

        y += rowH;
      });

      if (p === totalTablePages - 1) {
        drawSummary(pageH - 116);
      }

      drawFooter(page);
      page++;
    }

    return totalTablePages;
  };

  const drawBoxPages = (startPage) => {
    let page = startPage;
    let idx = 0;

    while (idx < rows.length) {
      doc.addPage();
      page++;
      const yStart = drawHeader(page);

      const gapX = 12;
      const gapY = 12;
      const colCount = 3;
      const rowCount = 3;
      const usableW = pageW - M * 2;
      const usableH = pageH - yStart - 48;
      const boxW = Math.floor((usableW - gapX * 2) / 3);
      const boxH = Math.floor((usableH - gapY * 2) / 3);

      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
          if (idx >= rows.length) break;
          const item = rows[idx++];
          const x = M + c * (boxW + gapX);
          const y = yStart + r * (boxH + gapY);

          doc.setFillColor(226, 232, 240);
          doc.roundedRect(x + 2, y + 2, boxW, boxH, 10, 10, 'F');
          doc.setFillColor(...C.white);
          doc.setDrawColor(...C.line);
          doc.setLineWidth(0.6);
          doc.roundedRect(x, y, boxW, boxH, 10, 10, 'FD');
          doc.setFillColor(...C.gold);
          doc.roundedRect(x, y, boxW, 36, 10, 10, 'F');
          doc.rect(x, y + 26, boxW, 10, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(...C.white);

          const title = doc.splitTextToSize(item.name, boxW - 16)[0] || '';
          doc.text(title, x + boxW / 2, y + 22, { align: 'center' });

          const fields = [
            ['Esattore', formatEuro(item.esattore)],
            ['Ricevute', formatEuro(item.ricevute)],
            ['Da riportare', formatEuro(item.riporto)],
            ['Carta', formatEuro(item.carta)],
            ['Monete', formatEuro(item.monete)],
            ['Uso Cassa', formatEuro(item.usoCassa)],
            ['Debito', formatEuro(item.debito)],
          ];

          let fy = y + 52;
          const labelX = x + 10;
          const valueX = x + boxW - 10;

          fields.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...C.text);
            doc.text(label, labelX, fy);
            doc.setFontSize(9.5);
            doc.text(value, valueX, fy, { align: 'right' });
            doc.setDrawColor(...C.lineLight);
            doc.line(labelX, fy + 8, valueX, fy + 8);
            fy += 19;
          });

          const finalH = 30;
          const finalY = y + boxH - finalH - 9;
          const finalX = x + 10;
          const finalW = boxW - 20;

          if (item.finale > 0) doc.setFillColor(...C.greenBg);
          else if (item.finale < 0) doc.setFillColor(...C.redBg);
          else doc.setFillColor(...C.grayBg2);

          doc.setDrawColor(...C.lineLight);
          doc.roundedRect(finalX, finalY, finalW, finalH, 6, 6, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(...C.text);
          doc.text('Totale +/-', finalX + 7, finalY + 19);
          doc.setFontSize(11);
          if (item.finale > 0) doc.setTextColor(...C.green);
          else if (item.finale < 0) doc.setTextColor(...C.red);
          else doc.setTextColor(...C.text);

          doc.text(formatSignedEuro(item.finale), finalX + finalW - 7, finalY + 19, {
            align: 'right',
          });
        }
      }

      drawFooter(page);
    }
  };

  const lastTablePage = drawTablePages();
  drawBoxPages(lastTablePage);

  const filename = `Conteggi_${dateFrom}_${dateTo}.pdf`;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isPWA = !!window.navigator.standalone;

  try {
    if (isIOS && isPWA) {
      const win = targetWin || window.open('', '_blank');
      if (!win) {
        throw new Error('Impossibile aprire la finestra del PDF su iOS. Riprova.');
      }
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      try {
        win.location.href = url;
      } catch {
        window.open(url, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    if (isIOS) {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    doc.save(filename);
  } catch (e) {
    console.error('Errore salvataggio PDF:', e);
    throw e;
  }
}

export default generateConteggiPdf;
