/**
 * Save-path timing for development and tests. Records named marks (milliseconds since the Save click) for each awaited
 * step and prints one line per save. Labels are fixed step names; no description, amount, category or token is ever
 * recorded. In production builds this is a no-op unless localStorage["pp-save-timing"] = "1".
 */
export interface SaveTimingRecord {
  kind: string;
  outcome: "saved" | "queued" | "syncing" | "confirmed" | "failed" | "uncertain" | "deduped";
  marks: Record<string, number>;
  total: number;
}

const enabled = () => {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("pp-save-timing") === "1";
  } catch {
    return false;
  }
};

export function startSaveTiming(kind: string) {
  if (!enabled()) return { mark() {}, end() {} };
  const t0 = performance.now();
  const marks: Record<string, number> = {};
  return {
    mark(name: string) {
      marks[name] = Math.round(performance.now() - t0);
    },
    end(outcome: SaveTimingRecord["outcome"]) {
      const rec: SaveTimingRecord = { kind, outcome, marks, total: Math.round(performance.now() - t0) };
      const g = globalThis as unknown as { __ppSaveTimings?: SaveTimingRecord[] };
      (g.__ppSaveTimings ??= []).push(rec);
      if (process.env.NODE_ENV !== "test") console.debug("[save-timing]", JSON.stringify(rec));
    },
  };
}

/** The authoritative confirmation arrives after the form is gone (background sync). Records click -> confirmation, no data. */
export function recordLate(kind: string, outcome: "confirmed" | "failed", msSinceClick: number) {
  if (!enabled()) return;
  const rec: SaveTimingRecord = { kind, outcome, marks: { "confirmed-after-click": Math.round(msSinceClick) }, total: Math.round(msSinceClick) };
  const g = globalThis as unknown as { __ppSaveTimings?: SaveTimingRecord[] };
  (g.__ppSaveTimings ??= []).push(rec);
  if (process.env.NODE_ENV !== "test") console.debug("[save-timing]", JSON.stringify(rec));
}
