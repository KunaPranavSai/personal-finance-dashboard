import PDFDocument from "pdfkit";
import { ExportData } from "./index";

function n(val: unknown): string {
  const v = Number(val ?? 0);
  return Number.isNaN(v) ? "0.00" : v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function catName(cat: unknown): string {
  return cat ? String((cat as Record<string, unknown>).name ?? "") : "";
}

export async function generatePDF(data: ExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 100;
    let y = 50;

    // Cover page
    doc.fontSize(28).font("Helvetica-Bold").fillColor("#1F2A44").text("Finance Dashboard Pro", 50, y, { align: "center" });
    y += 50;
    doc.fontSize(16).font("Helvetica").fillColor("#555").text("Financial Report", { align: "center" });
    y += 30;
    const now = new Date();
    doc.fontSize(12).fillColor("#333").text(`Generated: ${now.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`, { align: "center" });
    y += 20;
    const pr = data.profile ?? {};
    doc.text(`User: ${String(pr.name ?? "User")} (${String(pr.email ?? "")})`, { align: "center" });
    y += 80;

    doc.moveTo(50, y).lineTo(pageWidth + 50, y).stroke("#ccc");
    y += 40;

    // Dashboard Summary
    const dash = (data.dashboard ?? {}) as Record<string, unknown>;
    const kpis = (dash.kpis ?? {}) as Record<string, unknown>;
    doc.fontSize(18).font("Helvetica-Bold").fillColor("#1F2A44").text("Dashboard Summary", 50, y);
    y += 30;

    const kpiData: { label: string; value: string }[] = [
      { label: "Total Income", value: n(kpis.totalIncome) },
      { label: "Total Expenses", value: n(kpis.totalExpenses) },
      { label: "Total Savings", value: n(kpis.totalSavings) },
      { label: "Cash Flow", value: n(kpis.cashFlow) },
      { label: "Net Worth", value: n(kpis.netWorth) },
      { label: "Transaction Count", value: String(kpis.transactionCount ?? "0") },
    ];

    doc.fontSize(9).font("Helvetica");
    kpiData.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 50 + col * (pageWidth / 2);
      const ry = y + row * 22;
      if (ry > doc.page.height - 80) { doc.addPage(); y = 50; }
      doc.fillColor("#666").text(item.label, x, ry, { width: (pageWidth / 2) - 20 });
      doc.fillColor("#1F2A44").font("Helvetica-Bold").text(item.value, x, ry + 11, { width: (pageWidth / 2) - 20 });
      doc.font("Helvetica");
    });
    y = y + Math.ceil(kpiData.length / 2) * 22 + 30;

    // Table helper
    function drawTable(title: string, headers: string[], rows: string[][]) {
      if (rows.length === 0) {
        doc.fontSize(14).font("Helvetica-Bold").fillColor("#1F2A44").text(title, 50, y);
        y += 20;
        doc.fontSize(10).fillColor("#999").text("No records available.", 50, y);
        y += 30;
        return;
      }

      if (y > doc.page.height - 120) { doc.addPage(); y = 50; }

      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1F2A44").text(title, 50, y);
      y += 20;

      const colW = (pageWidth) / Math.max(headers.length, 1);
      const rowH = 18;

      doc.rect(50, y, pageWidth, rowH).fill("#1F2A44");
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#FFFFFF");
      headers.forEach((h, i) => {
        doc.text(h, 55 + i * colW, y + 5, { width: colW - 10 });
      });
      y += rowH;

      doc.fontSize(7.5).font("Helvetica").fillColor("#333");
      rows.forEach((row, ri) => {
        if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
        if (ri % 2 === 0) {
          doc.rect(50, y, pageWidth, rowH).fill("#F7F8FA");
        }
        row.forEach((cell, ci) => {
          doc.fillColor("#333").text(cell, 55 + ci * colW, y + 4, { width: colW - 10 });
        });
        y += rowH;
      });
      y += 20;
    }

    // Transactions
    drawTable("Transactions", ["Date", "Description", "Amount", "Type", "Category"],
      data.transactions.map((t: Record<string, unknown>) => {
        const desc = String(t.description ?? "");
        return [
          t.date ? new Date(String(t.date)).toLocaleDateString("en-IN") : "",
          desc.length > 30 ? desc.slice(0, 30) + "..." : desc,
          n(t.amount),
          String(t.type ?? ""),
          catName(t.category),
        ];
      })
    );

    // Budgets
    drawTable("Budget Summary", ["Category", "Budget", "Actual", "Remaining", "Status"],
      data.budgets.map((b: Record<string, unknown>) => [
        catName(b.category),
        n(b.amount),
        n(b.actual),
        n(b.remaining),
        String(b.status ?? ""),
      ])
    );

    // Investments
    drawTable("Investments", ["Instrument", "Category", "Value", "Monthly", "Return%"],
      data.investments.map((inv: Record<string, unknown>) => {
        const instr = String(inv.instrument ?? "");
        return [
          instr.length > 25 ? instr.slice(0, 25) + "..." : instr,
          String(inv.category ?? ""),
          n(inv.currentValue),
          n(inv.monthlyContribution),
          `${String(inv.annualReturnPct ?? "0")}%`,
        ];
      })
    );

    // Bills
    drawTable("Bills & EMI", ["Name", "Due Date", "Amount", "Paid", "Status"],
      data.bills.map((b: Record<string, unknown>) => {
        const name = String(b.name ?? "");
        return [
          name.length > 25 ? name.slice(0, 25) + "..." : name,
          b.dueDate ? new Date(String(b.dueDate)).toLocaleDateString("en-IN") : "",
          n(b.amount),
          n(b.paidAmount),
          Number(b.paidAmount ?? 0) >= Number(b.amount ?? 0) ? "Paid" : new Date(String(b.dueDate)) < new Date() ? "Overdue" : "Upcoming",
        ];
      })
    );

    // Goals
    drawTable("Financial Goals", ["Goal", "Target", "Current", "Monthly", "Progress"],
      data.goals.map((g: Record<string, unknown>) => {
        const name = String(g.name ?? "");
        const tgt = Number(g.targetAmount ?? 0);
        const cur = Number(g.currentAmount ?? 0);
        return [
          name.length > 25 ? name.slice(0, 25) + "..." : name,
          n(g.targetAmount),
          n(g.currentAmount),
          n(g.monthlyContribution),
          tgt > 0 ? `${((cur / tgt) * 100).toFixed(1)}%` : "0%",
        ];
      })
    );

    // Footer on all pages
    const totalPages = doc.bufferedPageRange?.()?.count ?? 1;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor("#999");
      doc.text(`Finance Dashboard Pro - Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 40, { align: "center", width: pageWidth });
    }

    doc.end();
  });
}
