import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { REPORT_BRAND, periodLabel } from "../../lib/reportBrand";

export interface TableReport {
  title: string;
  columns: { header: string; key: string; width: number }[];
  rows: Record<string, string | number>[];
  meta?: { from?: string; to?: string };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Branded single-table report (admin Users / Audit log exports). Same brand block as the user reports. */
export function tableToCsv(r: TableReport): Buffer {
  const lines = [
    `# ${REPORT_BRAND.name} - ${r.title}`,
    `# Period: ${periodLabel(r.meta)}`,
    `# Generated: ${new Date().toISOString()}`,
    "",
    r.columns.map((c) => csvCell(c.header)).join(","),
    ...r.rows.map((row) => r.columns.map((c) => csvCell(row[c.key])).join(",")),
  ];
  return Buffer.from(lines.join("\r\n"), "utf-8");
}

export async function tableToExcel(r: TableReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = REPORT_BRAND.name;
  wb.created = new Date();
  const sheet = wb.addWorksheet(r.title.slice(0, 30));
  try {
    const logoId = wb.addImage({ filename: REPORT_BRAND.logoPath, extension: "png" });
    sheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 56, height: 56 } });
  } catch {
    // logo missing: text brand below still identifies the workbook
  }
  sheet.getCell("C1").value = REPORT_BRAND.name;
  sheet.getCell("C1").font = { bold: true, size: 16, color: { argb: "FF1F2A44" } };
  sheet.getCell("C2").value = r.title;
  sheet.getCell("C3").value = `Period: ${periodLabel(r.meta)} · Generated ${new Date().toLocaleString("en-IN")}`;
  const headerRow = 5;
  r.columns.forEach((c, i) => {
    sheet.getColumn(i + 1).width = c.width;
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A44" } };
  });
  r.rows.forEach((row, ri) => r.columns.forEach((c, ci) => { sheet.getCell(headerRow + 1 + ri, ci + 1).value = row[c.key] ?? ""; }));
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: r.columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function tableToPdf(r: TableReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try { doc.image(REPORT_BRAND.logoPath, 40, 36, { width: 44 }); } catch { /* text brand still shown */ }
    doc.font("Helvetica-Bold").fontSize(18).fillColor(REPORT_BRAND.color).text(REPORT_BRAND.name, 96, 38);
    doc.font("Helvetica").fontSize(11).fillColor("#555").text(`${r.title} · ${periodLabel(r.meta)}`, 96, 62);
    let y = 100;

    const total = r.columns.reduce((s, c) => s + c.width, 0);
    const pageW = doc.page.width - 80;
    const widths = r.columns.map((c) => (c.width / total) * pageW);
    const drawRow = (cells: string[], bold: boolean) => {
      let x = 40;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(bold ? REPORT_BRAND.color : "#222");
      let h = 12;
      cells.forEach((t, i) => { h = Math.max(h, doc.heightOfString(t, { width: widths[i] - 4 }) + 4); });
      if (y + h > doc.page.height - 50) { doc.addPage(); y = 40; }
      cells.forEach((t, i) => { doc.text(t, x, y, { width: widths[i] - 4 }); x += widths[i]; });
      y += h;
      doc.moveTo(40, y - 2).lineTo(40 + pageW, y - 2).strokeColor("#ddd").stroke();
    };
    drawRow(r.columns.map((c) => c.header), true);
    r.rows.forEach((row) => drawRow(r.columns.map((c) => String(row[c.key] ?? "")), false));

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor("#888").text(`${REPORT_BRAND.name} - Page ${i + 1} of ${range.count}`, 40, doc.page.height - 30, { width: pageW, align: "center" });
    }
    doc.end();
  });
}
