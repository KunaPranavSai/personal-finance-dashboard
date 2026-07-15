import ExcelJS from "exceljs";
import { ExportData } from "./index";

function fmt(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isNaN(n) ? 0 : Number(n.toFixed(2));
}

function catName(cat: unknown): string {
  return cat ? String((cat as Record<string, unknown>).name ?? "") : "";
}

function addSheet(workbook: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width?: number }[], rows: Record<string, unknown>[], options?: { totals?: string[] }) {
  const sheet = workbook.addWorksheet(name.slice(0, 31));

  const colDefs = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.max(c.header.length + 5, 15),
  }));

  sheet.columns = colDefs;

  if (rows.length > 0) {
    sheet.addRows(rows);
  } else {
    sheet.addRow({ [columns[0]?.key ?? "none"]: "No records available" });
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A44" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  sheet.views = [{ state: "frozen", ySplit: 1 }];

  if (options?.totals && rows.length > 0) {
    const totalRow = sheet.addRow({});
    options.totals.forEach((key) => {
      const colIdx = columns.findIndex((c) => c.key === key) + 1;
      if (colIdx > 0) {
        const sum = rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
        totalRow.getCell(colIdx).value = sum;
        totalRow.getCell(colIdx).numFmt = '#,##0.00';
      }
    });
    totalRow.font = { bold: true };
  }

  columns.forEach((c, i) => {
    const k = c.key.toLowerCase();
    if (k.includes("amount") || k.includes("value") || k.includes("income") || k.includes("expense") || k.includes("contribution") || k.includes("budgeted") || k.includes("actual")) {
      sheet.getColumn(i + 1).numFmt = '#,##0.00';
    }
    if (k.includes("date") || k === "duedate") {
      sheet.getColumn(i + 1).numFmt = "DD-MM-YYYY";
    }
  });

  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: columns.length },
    };
  }
}

export async function generateExcel(data: ExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Finance Dashboard Pro";
  workbook.created = new Date();

  addSheet(workbook, "Transactions", [
    { header: "Date", key: "date", width: 14 },
    { header: "Description", key: "description", width: 30 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Type", key: "type", width: 10 },
    { header: "Category", key: "category", width: 18 },
    { header: "Merchant", key: "merchant", width: 20 },
    { header: "PaymentMethod", key: "paymentMethod", width: 16 },
    { header: "Notes", key: "notes", width: 25 },
  ], data.transactions.map((t: Record<string, unknown>) => ({
    date: t.date ? new Date(String(t.date)) : new Date(),
    description: String(t.description ?? ""),
    amount: fmt(t.amount),
    type: String(t.type ?? ""),
    category: catName(t.category),
    merchant: String(t.merchant ?? ""),
    paymentMethod: String(t.paymentMethod ?? ""),
    notes: String(t.notes ?? ""),
  })), { totals: ["amount"] });

  addSheet(workbook, "Budgets", [
    { header: "Category", key: "category", width: 20 },
    { header: "Period", key: "period", width: 12 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Actual", key: "actual", width: 14 },
    { header: "Remaining", key: "remaining", width: 14 },
    { header: "Status", key: "status", width: 14 },
  ], data.budgets.map((b: Record<string, unknown>) => ({
    category: catName(b.category),
    period: String(b.period ?? ""),
    amount: fmt(b.amount),
    actual: fmt(b.actual),
    remaining: fmt(b.remaining),
    status: String(b.status ?? ""),
  })), { totals: ["amount", "actual", "remaining"] });

  addSheet(workbook, "Investments", [
    { header: "Instrument", key: "instrument", width: 25 },
    { header: "Category", key: "category", width: 18 },
    { header: "CurrentValue", key: "currentValue", width: 16 },
    { header: "MonthlyContribution", key: "monthlyContribution", width: 20 },
    { header: "AnnualReturn%", key: "annualReturnPct", width: 14 },
  ], data.investments.map((inv: Record<string, unknown>) => ({
    instrument: String(inv.instrument ?? ""),
    category: String(inv.category ?? ""),
    currentValue: fmt(inv.currentValue),
    monthlyContribution: fmt(inv.monthlyContribution),
    annualReturnPct: fmt(inv.annualReturnPct),
  })), { totals: ["currentValue", "monthlyContribution"] });

  addSheet(workbook, "Bills", [
    { header: "Name", key: "name", width: 22 },
    { header: "Type", key: "type", width: 14 },
    { header: "DueDate", key: "dueDate", width: 14 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "PaidAmount", key: "paidAmount", width: 14 },
    { header: "Status", key: "status", width: 12 },
  ], data.bills.map((b: Record<string, unknown>) => ({
    name: String(b.name ?? ""),
    type: String(b.type ?? ""),
    dueDate: b.dueDate ? new Date(String(b.dueDate)) : new Date(),
    amount: fmt(b.amount),
    paidAmount: fmt(b.paidAmount),
    status: Number(b.paidAmount ?? 0) >= Number(b.amount ?? 0) ? "Paid" : new Date(String(b.dueDate)) < new Date() ? "Overdue" : "Upcoming",
  })), { totals: ["amount", "paidAmount"] });

  addSheet(workbook, "Goals", [
    { header: "Name", key: "name", width: 22 },
    { header: "Category", key: "category", width: 18 },
    { header: "TargetAmount", key: "targetAmount", width: 16 },
    { header: "CurrentAmount", key: "currentAmount", width: 18 },
    { header: "MonthlyContribution", key: "monthlyContribution", width: 20 },
    { header: "Progress%", key: "progressPct", width: 12 },
  ], data.goals.map((g: Record<string, unknown>) => {
    const tgt = Number(g.targetAmount ?? 0);
    const cur = Number(g.currentAmount ?? 0);
    return {
      name: String(g.name ?? ""),
      category: String(g.category ?? ""),
      targetAmount: fmt(g.targetAmount),
      currentAmount: fmt(g.currentAmount),
      monthlyContribution: fmt(g.monthlyContribution),
      progressPct: tgt > 0 ? ((cur / tgt) * 100).toFixed(1) + "%" : "0.0%",
    };
  }), { totals: ["targetAmount", "currentAmount", "monthlyContribution"] });

  addSheet(workbook, "Accounts", [
    { header: "Name", key: "name", width: 25 },
  ], data.accounts.map((a: Record<string, unknown>) => ({ name: String(a.name ?? "") })));

  addSheet(workbook, "Categories", [
    { header: "Name", key: "name", width: 22 },
    { header: "Type", key: "type", width: 10 },
  ], data.categories.map((c: Record<string, unknown>) => ({ name: String(c.name ?? ""), type: String(c.type ?? "") })));

  addSheet(workbook, "Settings", [
    { header: "Key", key: "key", width: 30 },
    { header: "Value", key: "value", width: 50 },
  ], Object.entries(data.settings ?? {}).map(([key, value]) => ({
    key,
    value: typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
  })));

  addSheet(workbook, "Profile", [
    { header: "Field", key: "field", width: 25 },
    { header: "Value", key: "value", width: 40 },
  ], Object.entries(data.profile ?? {}).map(([key, value]) => ({
    field: key,
    value: typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
  })));

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
