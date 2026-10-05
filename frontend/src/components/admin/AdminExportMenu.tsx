"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/** Branded export of the Users list or Audit log. Three large buttons, no dropdown. */
export function AdminExportMenu({ type, from, to }: { type: "users" | "audit"; from?: string; to?: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (format: "pdf" | "xlsx" | "csv") => {
    setBusy(format);
    try {
      const qs = new URLSearchParams({ type, format });
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`${API_BASE_URL}/api/admin/export?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${type}-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
      setOpen(false);
    } catch (e) {
      toast((e as Error).message || "Export failed", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[44px] items-center gap-2 rounded-lg border border-black/10 px-4 text-sm font-semibold text-teal dark:border-white/10"
      >
        <Download className="h-4 w-4" /> Export
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 flex w-48 flex-col gap-1 rounded-xl border border-black/10 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-navy-dark">
          {(["pdf", "xlsx", "csv"] as const).map((f) => (
            <button key={f} type="button" disabled={busy !== null} onClick={() => run(f)} className="min-h-[44px] rounded-lg px-3 text-left text-sm font-medium text-navy hover:bg-black/5 disabled:opacity-60 dark:text-white dark:hover:bg-white/10">
              {busy === f ? "Preparing…" : f === "pdf" ? "PDF" : f === "xlsx" ? "Excel" : "CSV"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
