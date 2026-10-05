import path from "path";

/** Single source of branding for every generated report (PDF, Excel, CSV). Replace assets/logo.png to rebrand. */
export const REPORT_BRAND = {
  name: "Penny Pilot",
  title: "Financial Report",
  logoPath: path.resolve(__dirname, "..", "..", "assets", "logo.png"),
  color: "#1F2A44",
};

export function periodLabel(meta?: { from?: string; to?: string }): string {
  if (!meta?.from && !meta?.to) return "All time";
  const f = (s?: string) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Start");
  return `${f(meta?.from)} - ${meta?.to ? f(meta.to) : "Today"}`;
}
