// Shared period choices for the Reports screens (desktop + mobile). Dates are local calendar days (YYYY-MM-DD).
export type ReportPeriod = "this-month" | "last-month" | "last-3-months" | "ytd" | "all" | "custom";
export interface ReportRange { period: ReportPeriod; from: string; to: string }

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "last-3-months", label: "Last 3 Months" },
  { value: "ytd", label: "Year to Date" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function rangeFor(period: ReportPeriod, custom?: { from: string; to: string }, now = new Date()): ReportRange {
  const y = now.getFullYear(), m = now.getMonth();
  switch (period) {
    case "this-month": return { period, from: iso(new Date(y, m, 1)), to: iso(now) };
    case "last-month": return { period, from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "last-3-months": return { period, from: iso(new Date(y, m - 2, 1)), to: iso(now) };
    case "ytd": return { period, from: iso(new Date(y, 0, 1)), to: iso(now) };
    case "custom": return { period, from: custom?.from ?? "", to: custom?.to ?? "" };
    default: return { period, from: "", to: "" };
  }
}

export const reportQuery = (r: ReportRange) => {
  const p = new URLSearchParams();
  if (r.from) p.set("from", r.from);
  if (r.to) p.set("to", r.to);
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const periodLabel = (r: ReportRange) =>
  r.period === "all" ? "All time" : r.from || r.to ? `${r.from || "Start"} to ${r.to || "Today"}` : "Pick a start and end date";
