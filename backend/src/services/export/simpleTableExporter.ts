import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export interface SimpleTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

function cell(v: string | number): string {
  return v === null || v === undefined ? "" : String(v);
}

export function generateSimpleCSV({ headers, rows }: SimpleTable): Buffer {
  const esc = (v: string) => (v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map((v) => esc(cell(v))).join(","))];
  return Buffer.from(lines.join("\r\n"), "utf-8");
}

export function generateSimpleJSON({ title, headers, rows }: SimpleTable): string {
  const records = rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  return JSON.stringify({ title, exportedAt: new Date().toISOString(), records }, null, 2);
}

export async function generateSimpleExcel({ title, headers, rows }: SimpleTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Penny Pilot Admin";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(title.slice(0, 31));
  sheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(h.length + 5, 15) }));
  rows.forEach((r) => sheet.addRow(Object.fromEntries(headers.map((h, i) => [h, r[i]]))));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A44" } };
  headerRow.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (rows.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: headers.length } };
  }
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

export async function generateSimplePDF({ title, headers, rows }: SimpleTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 100;
    let y = 50;

    doc.fontSize(20).font("Helvetica-Bold").fillColor("#1F2A44").text("Penny Pilot — Admin Report", 50, y);
    y += 26;
    doc.fontSize(14).font("Helvetica").fillColor("#555").text(title, 50, y);
    y += 20;
    doc.fontSize(10).fillColor("#999").text(`Generated: ${new Date().toLocaleString("en-IN")}`, 50, y);
    y += 30;

    const colW = pageWidth / Math.max(headers.length, 1);
    const rowH = 20;
    const maxChars = Math.max(4, Math.floor((colW - 10) / 4.2));

    function drawHeader() {
      doc.rect(50, y, pageWidth, rowH).fill("#1F2A44");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#FFFFFF");
      headers.forEach((h, i) => doc.text(truncate(h, maxChars), 55 + i * colW, y + 5, { width: colW - 10 }));
      y += rowH;
    }

    if (rows.length === 0) {
      doc.fontSize(11).fillColor("#999").text("No records available.", 50, y);
    } else {
      drawHeader();
      doc.fontSize(8).font("Helvetica").fillColor("#333");
      rows.forEach((row, ri) => {
        if (y > doc.page.height - 60) { doc.addPage(); y = 50; drawHeader(); doc.fontSize(8).font("Helvetica").fillColor("#333"); }
        if (ri % 2 === 0) doc.rect(50, y, pageWidth, rowH).fill("#F7F8FA");
        row.forEach((c, ci) => {
          doc.fillColor("#333").text(truncate(cell(c), maxChars), 55 + ci * colW, y + 5, { width: colW - 10, height: rowH - 4, ellipsis: true });
        });
        y += rowH;
      });
    }

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor("#999");
      doc.text(`Penny Pilot Admin — Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 40, { align: "center", width: pageWidth });
    }

    doc.end();
  });
}
