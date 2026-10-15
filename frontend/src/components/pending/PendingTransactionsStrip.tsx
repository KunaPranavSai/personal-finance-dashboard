"use client";

import { CloudUpload } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { usePendingTransactions, type PendingRow, type PendingState } from "@/lib/pendingTransactions";

const BADGE: Record<PendingState, { text: string; tone: string }> = {
  syncing: { text: "Syncing to Google Drive", tone: "bg-pp-accent/10 text-pp-accent" },
  waiting: { text: "Waiting for connection", tone: "bg-turmeric/15 text-pp-text" },
  retrying: { text: "Retrying", tone: "bg-turmeric/15 text-pp-text" },
  refused: { text: "Not saved", tone: "bg-pp-critical/10 text-pp-critical" },
  confirming: { text: "Saved to Drive · updating list", tone: "bg-mantis/15 text-pp-text" },
};

/**
 * Entries made on this device that Google Drive hasn't confirmed yet. Shown ABOVE the confirmed list, never mixed into it,
 * and never counted in totals. Each row says exactly where it stands. `knownServerIds`: ids already present in the list
 * below, so a just-confirmed entry isn't shown twice. `accept` narrows rows to what the list below is showing (type/filters).
 */
export function PendingTransactionsStrip({ knownServerIds = [], accept, className }: { knownServerIds?: string[]; accept?: (r: PendingRow) => boolean; className?: string }) {
  const { settings } = useSettingsContext();
  const rows = usePendingTransactions(knownServerIds).filter((r) => (accept ? accept(r) : true));
  if (rows.length === 0) return null;
  const open = rows.filter((r) => r.state !== "confirming" && r.state !== "refused").length;
  return (
    <section aria-label="Changes not yet confirmed by Google Drive" className={`rounded-pp border border-dashed border-pp-border bg-pp-surface p-3 ${className ?? ""}`}>
      <p aria-live="polite" className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-pp-text-dim">
        <CloudUpload className="h-3.5 w-3.5 shrink-0 motion-safe:animate-pulse" aria-hidden="true" />
        {open > 0 ? `${open} syncing to Google Drive` : "Updating"}
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-pp-text">
                {r.mode === "edit" ? "Edit: " : ""}
                {r.description || (r.type === "INCOME" ? "Income" : "Expense")}
              </p>
              <p className="truncate text-xs text-pp-text-dim">
                <span className={`mr-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE[r.state].tone}`}>{BADGE[r.state].text}</span>
                {r.state === "refused" && r.reason ? r.reason : r.mode === "edit" && r.state !== "refused" ? "New values shown here until confirmed" : ""}
              </p>
            </div>
            <span className={`shrink-0 font-semibold tabular-nums ${r.type === "INCOME" ? "text-mantis" : "text-vulcanico"}`}>
              {r.type === "INCOME" ? "+" : "-"}
              {formatCurrency(r.amount, settings.currency)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
