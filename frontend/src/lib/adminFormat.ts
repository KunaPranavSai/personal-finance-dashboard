/** Admin screens always show IST (Asia/Kolkata), regardless of the viewer's device locale or timezone. */
const TZ = "Asia/Kolkata";
type DateInput = string | number | Date | null | undefined;

function fmt(v: DateInput, o: Intl.DateTimeFormatOptions): string {
  if (v == null || v === "") return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...o }).format(d);
}
const upperMeridiem = (s: string) => s.replace(/\bam\b/, "AM").replace(/\bpm\b/, "PM");

/** 07 Oct 2026 */
export const fmtDate = (v: DateInput) => fmt(v, { day: "2-digit", month: "short", year: "numeric" });
/** 07 Oct 2026, 3:42 PM IST */
export const fmtDateTime = (v: DateInput) => {
  const s = fmt(v, { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  return s === "—" ? s : `${upperMeridiem(s)} IST`;
};
/** 3:42 PM */
export const fmtTime = (v: DateInput) => upperMeridiem(fmt(v, { hour: "numeric", minute: "2-digit", hour12: true }));
/** "5 min ago", "3 h ago"; a plain date once older than a week. */
export function fmtRelative(v: DateInput): string {
  if (v == null || v === "") return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)} d ago`;
  return fmtDate(d);
}
/** Chart axis label: "2026-10-07" -> "07 Oct" (the day is already an IST calendar date). */
export const fmtDay = (iso: string) => fmt(`${iso}T12:00:00+05:30`, { day: "2-digit", month: "short" });
export const fmtNumber = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("en-IN").format(n));
export function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
