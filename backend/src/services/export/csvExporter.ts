import { ExportData } from "./index";

function esc(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(esc).join(",");
  const body = rows.map((row) => columns.map((c) => esc(row[c])).join(","));
  return [header, ...body].join("\r\n");
}

function d(val: unknown): string {
  if (!val) return "";
  return new Date(String(val)).toISOString().slice(0, 10);
}

function n(val: unknown): string {
  const v = Number(val ?? 0);
  return Number.isNaN(v) ? "0.00" : v.toFixed(2);
}

export function generateCSV(data: ExportData): Buffer {
  const parts: string[] = [];

  const pr = data.profile ?? {};
  parts.push("# Profile");
  parts.push(toCSV([
    { Name: String(pr.name ?? ""), Email: String(pr.email ?? ""), Phone: String(pr.phone ?? ""), Occupation: String(pr.occupation ?? ""), Country: String(pr.country ?? ""), Currency: String(pr.currency ?? "") }
  ], ["Name", "Email", "Phone", "Occupation", "Country", "Currency"]));
  parts.push("");

  parts.push("# Transactions");
  parts.push(toCSV(
    data.transactions.map((t: Record<string, unknown>) => ({
      Date: d(t.date),
      Description: String(t.description ?? ""),
      Amount: n(t.amount),
      Type: String(t.type ?? ""),
      Category: t.category ? String((t.category as Record<string, unknown>).name ?? "") : "",
      Merchant: String(t.merchant ?? ""),
      Account: t.account ? String((t.account as Record<string, unknown>).name ?? "") : "",
      PaymentMethod: String(t.paymentMethod ?? ""),
      Notes: String(t.notes ?? ""),
    })),
    ["Date", "Description", "Amount", "Type", "Category", "Merchant", "Account", "PaymentMethod", "Notes"]
  ));
  parts.push("");

  parts.push("# Budgets");
  parts.push(toCSV(
    data.budgets.map((b: Record<string, unknown>) => ({
      Category: b.category ? String((b.category as Record<string, unknown>).name ?? "") : "",
      Period: String(b.period ?? ""),
      Amount: n(b.amount),
      Actual: n(b.actual),
      Remaining: n(b.remaining),
      Status: String(b.status ?? ""),
    })),
    ["Category", "Period", "Amount", "Actual", "Remaining", "Status"]
  ));
  parts.push("");

  parts.push("# Investments");
  parts.push(toCSV(
    data.investments.map((inv: Record<string, unknown>) => ({
      Instrument: String(inv.instrument ?? ""),
      Category: String(inv.category ?? ""),
      CurrentValue: n(inv.currentValue),
      MonthlyContribution: n(inv.monthlyContribution),
      AnnualReturnPct: n(inv.annualReturnPct),
    })),
    ["Instrument", "Category", "CurrentValue", "MonthlyContribution", "AnnualReturnPct"]
  ));
  parts.push("");

  parts.push("# Bills");
  parts.push(toCSV(
    data.bills.map((b: Record<string, unknown>) => ({
      Name: String(b.name ?? ""),
      Type: String(b.type ?? ""),
      DueDate: d(b.dueDate),
      Amount: n(b.amount),
      PaidAmount: n(b.paidAmount),
      AutoPay: b.autoPay ? "Yes" : "No",
      Status: Number(b.paidAmount ?? 0) >= Number(b.amount ?? 0) ? "Paid" : new Date(String(b.dueDate)) < new Date() ? "Overdue" : "Upcoming",
    })),
    ["Name", "Type", "DueDate", "Amount", "PaidAmount", "AutoPay", "Status"]
  ));
  parts.push("");

  parts.push("# Goals");
  parts.push(toCSV(
    data.goals.map((g: Record<string, unknown>) => {
      const tgt = Number(g.targetAmount ?? 0);
      const cur = Number(g.currentAmount ?? 0);
      return {
        Name: String(g.name ?? ""),
        Category: String(g.category ?? ""),
        TargetAmount: n(g.targetAmount),
        CurrentAmount: n(g.currentAmount),
        MonthlyContribution: n(g.monthlyContribution),
        ProgressPct: tgt > 0 ? ((cur / tgt) * 100).toFixed(1) : "0.0",
      };
    }),
    ["Name", "Category", "TargetAmount", "CurrentAmount", "MonthlyContribution", "ProgressPct"]
  ));
  parts.push("");

  parts.push("# Accounts");
  parts.push(toCSV(
    data.accounts.map((a: Record<string, unknown>) => ({ Name: String(a.name ?? "") })),
    ["Name"]
  ));
  parts.push("");

  parts.push("# Categories");
  parts.push(toCSV(
    data.categories.map((c: Record<string, unknown>) => ({ Name: String(c.name ?? ""), Type: String(c.type ?? "") })),
    ["Name", "Type"]
  ));
  parts.push("");

  return Buffer.from(parts.join("\r\n"), "utf-8");
}
