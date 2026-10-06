"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCategories, useAccounts, usePaymentMethods } from "@/lib/reference";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { useToast } from "@/components/ui/Toast";
import { downloadExport } from "@/lib/export";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { buildLedger, queryLedger } from "@/lib/ledger";

type Preset = "today" | "week" | "month" | "lastMonth" | "3months" | "year" | "custom";
const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "3months", label: "Last 3 Months" },
  { id: "year", label: "This Year" },
  { id: "custom", label: "Custom Range" },
];

type Kind = "income" | "expense" | "bills" | "budgets" | "investments" | "goals" | "savings";
const KINDS: { id: Kind; label: string }[] = [
  { id: "income", label: "Income" },
  { id: "expense", label: "Expenses" },
  { id: "bills", label: "Bills & EMIs" },
  { id: "budgets", label: "Budgets" },
  { id: "investments", label: "Investments" },
  { id: "goals", label: "Goals" },
  { id: "savings", label: "Savings" },
];
// Goals and Savings are the same stored records today (savings plans = goals).
const COLLECTION: Record<Kind, string> = { income: "transactions", expense: "transactions", bills: "bills", budgets: "budgets", investments: "investments", goals: "goals", savings: "goals" };

type Format = "pdf" | "excel" | "csv";

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function presetRange(p: Preset, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case "today": return { from: iso(now), to: iso(now) };
    case "week": { const s = new Date(now); s.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return { from: iso(s), to: iso(now) }; }
    case "month": return { from: iso(new Date(y, m, 1)), to: iso(now) };
    case "lastMonth": return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "3months": return { from: iso(new Date(y, m - 2, 1)), to: iso(now) };
    case "year": return { from: iso(new Date(y, 0, 1)), to: iso(now) };
    default: return { from: "", to: "" };
  }
}

type Picks = { categoryId: string; accountId: string; paymentMethodTypeId: string };

async function localCsv(range: { from: string; to: string }, kinds: Kind[], picks: Picks) {
  const p = getStorageProvider();
  const [transactions, bills, budgets, investments, goals, categories] = await Promise.all(
    (["transactions", "bills", "budgets", "investments", "goals", "categories"] as const).map((c) => p.list(c))
  );
  const want = new Set<string>();
  for (const k of kinds) {
    if (k === "income" || k === "expense") want.add(k);
    if (k === "bills") want.add("bill");
    if (k === "budgets") want.add("budget");
    if (k === "investments") want.add("investment");
    if (k === "goals" || k === "savings") want.add("goal");
  }
  const keep = (t: Record<string, unknown>) => (!picks.categoryId || t.categoryId === picks.categoryId) && (!picks.accountId || t.accountId === picks.accountId) && (!picks.paymentMethodTypeId || t.paymentMethodTypeId === picks.paymentMethodTypeId);
  const { items } = queryLedger(buildLedger({ transactions: (transactions as Record<string, unknown>[]).filter(keep) as never, bills, budgets, investments, goals, categories }), {
    types: [...want] as never, from: range.from || undefined, to: range.to || undefined, limit: 100000,
  });
  const rows = [["Date", "Type", "Title", "Amount"], ...items.map((i) => [i.occurredAt.slice(0, 10), i.type, i.title, i.amount])];
  const csv = `# Penny Pilot - Financial Report\n# Period: ${range.from || "Start"} - ${range.to || "Today"}\n` + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `penny-pilot-export-${iso(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Choose period, data and format, then download a branded report. Replaces the old monthly-only export. */
export function CustomExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [preset, setPreset] = useState<Preset>("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [kinds, setKinds] = useState<Kind[]>(["income", "expense"]);
  const [format, setFormat] = useState<Format>("pdf");
  const [busy, setBusy] = useState(false);
  const [picks, setPicks] = useState<Picks>({ categoryId: "", accountId: "", paymentMethodTypeId: "" });
  const { data: cats } = useCategories();
  const { data: accs } = useAccounts();
  const { data: pms } = usePaymentMethods();
  const [count, setCount] = useState<number | null>(null);
  const local = typeof window !== "undefined" && getStorageMode() === "local";
  const allSelected = kinds.length === KINDS.length;
  const range = preset === "custom" ? custom : presetRange(preset);

  // Preview before downloading: how many transactions match the chosen period and filters.
  const txKindsSel = kinds.filter((k) => k === "income" || k === "expense");
  useEffect(() => {
    if (!open || local || (preset === "custom" && (!custom.from || !custom.to))) { setCount(null); return; }
    let live = true;
    const p = new URLSearchParams();
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    if (txKindsSel.length === 1) p.set("kinds", txKindsSel.join(","));
    (Object.keys(picks) as (keyof Picks)[]).forEach((k) => { if (picks[k]) p.set(k, picks[k]); });
    api.get<{ counts: { transactions: number } }>(`/api/export/preview?${p.toString()}`).then((r) => live && setCount(r.counts.transactions)).catch(() => live && setCount(null));
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, local, preset, custom.from, custom.to, kinds.join(), picks.categoryId, picks.accountId, picks.paymentMethodTypeId]);

  const toggle = (k: Kind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const run = async () => {
    if (kinds.length === 0) return toast("Choose at least one type of data to export.", "error");
    if (preset === "custom" && (!custom.from || !custom.to)) return toast("Choose both a start and an end date for a custom range.", "error");
    if (preset === "custom" && custom.from > custom.to) return toast("The start date must be on or before the end date.", "error");
    setBusy(true);
    try {
      if (local) {
        await localCsv(range, kinds, picks);
      } else {
        const types = [...new Set(kinds.map((k) => COLLECTION[k]))];
        if (types.includes("transactions") || types.includes("budgets")) types.push("categories", "accounts");
        const txKinds = kinds.filter((k) => k === "income" || k === "expense");
        await downloadExport(format, toast, { from: range.from || undefined, to: range.to || undefined, categoryId: picks.categoryId || undefined, accountId: picks.accountId || undefined, paymentMethodTypeId: picks.paymentMethodTypeId || undefined }, types, txKinds.length === 1 ? txKinds : undefined);
      }
      onClose();
    } catch (e) {
      toast((e as Error).message || "Export failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileSheet open={open} onClose={() => !busy && onClose()} title="Custom Export">
      <div className="ppm-field">
        <label>Date range</label>
        <div className="ppm-filters" style={{ flexWrap: "wrap", overflow: "visible" }}>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={`ppm-chip${preset === p.id ? " on" : ""}`} onClick={() => setPreset(p.id)}>{p.label}</button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="ppm-field-row">
            <div className="ppm-field"><label htmlFor="exp-from">From</label><input id="exp-from" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></div>
            <div className="ppm-field"><label htmlFor="exp-to">To</label><input id="exp-to" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></div>
          </div>
        )}
      </div>

      <div className="ppm-field">
        <label>Data</label>
        <div className="ppm-checks">
          <label className="ppm-check" style={{ gridColumn: "1 / -1" }}>
            <input type="checkbox" checked={allSelected} onChange={() => setKinds(allSelected ? [] : KINDS.map((k) => k.id))} />
            All financial data
          </label>
          {KINDS.map((k) => (
            <label key={k.id} className="ppm-check">
              <input type="checkbox" checked={kinds.includes(k.id)} onChange={() => toggle(k.id)} />
              {k.label}
            </label>
          ))}
        </div>
      </div>

      <div className="ppm-field">
        <label htmlFor="exp-cat">Category (optional)</label>
        <select id="exp-cat" value={picks.categoryId} onChange={(e) => setPicks({ ...picks, categoryId: e.target.value })}>
          <option value="">All categories</option>
          {(cats?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="ppm-field-row">
        <div className="ppm-field">
          <label htmlFor="exp-acc">Wallet</label>
          <select id="exp-acc" value={picks.accountId} onChange={(e) => setPicks({ ...picks, accountId: e.target.value })}>
            <option value="">All wallets</option>
            {(accs?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="ppm-field">
          <label htmlFor="exp-pm">Money source</label>
          <select id="exp-pm" value={picks.paymentMethodTypeId} onChange={(e) => setPicks({ ...picks, paymentMethodTypeId: e.target.value })}>
            <option value="">All sources</option>
            {(pms?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="ppm-field">
        <label>Format</label>
        <div className="ppm-filters">
          {(["pdf", "excel", "csv"] as Format[]).map((f) => (
            <button key={f} type="button" disabled={local && f !== "csv"} className={`ppm-chip${(local ? "csv" : format) === f ? " on" : ""}`} onClick={() => setFormat(f)}>
              {f === "pdf" ? "PDF" : f === "excel" ? "Excel" : "CSV"}
            </button>
          ))}
        </div>
        {local && <div className="ppm-meta">On this device only, CSV is available. Connect Google Drive for PDF and Excel.</div>}
      </div>

      <div className="ppm-meta" style={{ marginBottom: 10 }}>
        Exporting {range.from || range.to ? `${range.from || "start"} to ${range.to || "today"}` : "all time"}{count !== null ? ` · ${count} transaction${count === 1 ? "" : "s"} match` : ""}
      </div>
      <div className="ppm-sheet-actions">
        <button type="button" className="ppm-sheet-submit" disabled={busy || (count === 0 && kinds.every((k) => k === "income" || k === "expense"))} onClick={run}>{busy ? "Preparing…" : "Export"}</button>
        <button type="button" className="ppm-sheet-cancel" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </MobileSheet>
  );
}
