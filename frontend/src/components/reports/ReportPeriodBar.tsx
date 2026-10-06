"use client";

import { REPORT_PERIODS, periodLabel, rangeFor, type ReportRange } from "@/lib/reportRange";

/** Period picker shown on every report: preset or custom range, with the resolved dates spelled out. */
export function ReportPeriodBar({ value, onChange, mobile }: { value: ReportRange; onChange: (r: ReportRange) => void; mobile?: boolean }) {
  const cls = mobile ? "" : "rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm text-pp-text";
  const lbl = mobile ? undefined : "mb-1 block text-xs font-medium text-pp-text-dim";
  const set = (p: ReportRange["period"]) => onChange(rangeFor(p, { from: value.from, to: value.to }));
  return (
    <div className={mobile ? "ppm-card" : "mb-6 flex flex-wrap items-end gap-3"} style={mobile ? { marginBottom: 12 } : undefined}>
      <div className={mobile ? "ppm-field" : undefined} style={mobile ? { marginBottom: 8 } : undefined}>
        <label htmlFor="rp-period" className={lbl}>Period</label>
        <select id="rp-period" className={cls} value={value.period} onChange={(e) => set(e.target.value as ReportRange["period"])}>
          {REPORT_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      {value.period === "custom" && (
        <div className={mobile ? "ppm-field-row" : "flex gap-3"}>
          <div className={mobile ? "ppm-field" : undefined}>
            <label htmlFor="rp-from" className={lbl}>From</label>
            <input id="rp-from" type="date" className={cls} value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          </div>
          <div className={mobile ? "ppm-field" : undefined}>
            <label htmlFor="rp-to" className={lbl}>To</label>
            <input id="rp-to" type="date" className={cls} value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
          </div>
        </div>
      )}
      <p className={mobile ? "ppm-meta" : "pb-2 text-xs text-pp-text-dim"}>Showing: {periodLabel(value)}</p>
    </div>
  );
}
