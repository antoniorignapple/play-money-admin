import { jsPDF } from "jspdf";
import { openPdfPreview } from "./pdfPreview.js";

async function toDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Logo PDF non disponibile");
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const cleanVenueName = (value) =>
  String(value || "Locale")
    .trim()
    .replace(/^K\d+\s*/i, "")
    .replace(/^[-–]\s*/, "");

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRangeDate = (value) => {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const formatEuro = (value) => {
  const amount = Math.trunc(Number(value) || 0);
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${sign}${Math.abs(amount).toLocaleString("it-IT")} €`;
};

export async function buildSimulazioniPdf({ rows, dateFrom, dateTo, employee }) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;
  const rowsPerPage = 27;
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  const colors = {
    text: [15, 23, 42],
    muted: [100, 116, 139],
    white: [255, 255, 255],
    gold: [184, 134, 11],
    goldDark: [146, 96, 0],
    goldBg: [255, 248, 220],
    green: [21, 128, 61],
    red: [185, 28, 28],
    gray: [248, 250, 252],
    line: [226, 232, 240],
  };

  let logoDataUrl = null;
  if (typeof window !== "undefined") {
    try {
      logoDataUrl = await toDataUrl(
        `${window.location.origin}${import.meta.env.BASE_URL}logo512.png.png`,
      );
    } catch (error) {
      console.warn("Logo PDF non caricato", error);
    }
  }

  const drawHeader = () => {
    const headerH = 72;
    doc.setFillColor(...colors.white);
    doc.rect(0, 0, pageW, headerH, "F");
    doc.setFillColor(...colors.goldBg);
    doc.rect(0, headerH - 8, pageW, 8, "F");
    doc.setDrawColor(...colors.gold);
    doc.setLineWidth(1.2);
    doc.line(margin, headerH - 8, pageW - margin, headerH - 8);

    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", margin, 17, 44, 44);
      } catch (error) {
        console.warn("Errore stampa logo PDF", error);
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(245, 195, 54);
    doc.text("PLAY MONEY", margin + 58, 42);

    doc.setFillColor(...colors.gold);
    doc.roundedRect(margin + 58, 50, 100, 16, 4, 4, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.white);
    doc.text("SIMULAZIONI", margin + 108, 61, { align: "center" });

    const cardW = 232;
    const cardH = 48;
    const cardX = pageW - margin - cardW;
    const cardY = 17;
    doc.setFillColor(...colors.gray);
    doc.setDrawColor(...colors.line);
    doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, "FD");
    doc.setFontSize(6.8);
    doc.setTextColor(...colors.goldDark);
    doc.text("DAL", cardX + 12, cardY + 13);
    doc.text("AL", cardX + 86, cardY + 13);
    doc.text("OPERAIO", cardX + 160, cardY + 13);
    doc.setFontSize(9.5);
    doc.setTextColor(...colors.text);
    doc.text(formatRangeDate(dateFrom), cardX + 12, cardY + 31);
    doc.text(formatRangeDate(dateTo), cardX + 86, cardY + 31);
    const employeeText = doc.splitTextToSize(employee || "TUTTI", 62)[0] || "TUTTI";
    doc.text(employeeText, cardX + 160, cardY + 31);

    return headerH + 12;
  };

  const drawSignature = () => {
    const lineWidth = 150;
    const lineX = pageW - margin - lineWidth;
    const lineY = pageH - 32;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...colors.text);
    doc.text("FIRMA", lineX + lineWidth / 2, lineY - 58, { align: "center" });
    doc.setDrawColor(...colors.text);
    doc.setLineWidth(0.7);
    doc.line(lineX, lineY, lineX + lineWidth, lineY);
  };

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    if (pageIndex > 0) doc.addPage();
    let y = drawHeader();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...colors.text);
    doc.text("SIMULAZIONI", margin, y + 16);
    y += 30;

    const tableW = pageW - margin * 2;
    const columns = [
      { label: "LOCALE", x: margin, w: 220, align: "left" },
      { label: "OPERAIO", x: margin + 220, w: 130, align: "left" },
      { label: "DATA E ORA", x: margin + 350, w: 125, align: "left" },
      { label: "TOTALE", x: margin + 475, w: tableW - 475, align: "right" },
    ];
    const headH = 28;
    const rowH = 23;

    doc.setFillColor(...colors.gold);
    doc.roundedRect(margin, y, tableW, headH, 8, 8, "F");
    doc.rect(margin, y + 19, tableW, 10, "F");
    doc.setFontSize(8);
    doc.setTextColor(...colors.white);
    columns.forEach((column) => {
      doc.text(
        column.label,
        column.align === "right" ? column.x + column.w - 8 : column.x + 8,
        y + 19,
        { align: column.align },
      );
    });
    y += headH;

    rows
      .slice(pageIndex * rowsPerPage, pageIndex * rowsPerPage + rowsPerPage)
      .forEach((row, index) => {
        doc.setFillColor(...(index % 2 === 0 ? colors.white : colors.gray));
        doc.rect(margin, y, tableW, rowH, "F");
        doc.setDrawColor(...colors.line);
        doc.line(margin, y + rowH, pageW - margin, y + rowH);

        columns.slice(1).forEach((column) => {
          doc.line(column.x, y, column.x, y + rowH);
        });

        const venue = doc.splitTextToSize(cleanVenueName(row.venue), 204)[0] || "-";
        const worker = doc.splitTextToSize(String(row.employee || "-"), 114)[0] || "-";
        const total = formatEuro(row.total);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...colors.text);
        doc.text(venue, columns[0].x + 8, y + 15);
        doc.text(worker, columns[1].x + 8, y + 15);
        doc.setFontSize(8.2);
        doc.text(formatDate(row.createdAt), columns[2].x + 8, y + 15);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        if (Number(row.total) > 0) doc.setTextColor(...colors.green);
        else if (Number(row.total) < 0) doc.setTextColor(...colors.red);
        else doc.setTextColor(...colors.text);
        doc.text(total, columns[3].x + columns[3].w - 8, y + 15, {
          align: "right",
        });
        y += rowH;
      });

    if (pageIndex === totalPages - 1) drawSignature();
  }

  return doc;
}

export default async function generateSimulazioniPdf(options) {
  const doc = await buildSimulazioniPdf(options);
  openPdfPreview(doc, options.targetWindow);
}
