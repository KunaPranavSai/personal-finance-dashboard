"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Download, X, FileText, Wallet, TrendingUp, Receipt, Target, Tag, Landmark } from "lucide-react";
import { Button } from "./Button";
import { api } from "@/lib/api";
import { downloadExport } from "@/lib/export";
import { useToast } from "./Toast";
import { cn } from "@/lib/format";

interface PreviewCounts {
  transactions: number; budgets: number; investments: number; bills: number; goals: number; categories: number; accounts: number;
}

const COUNT_META: { key: keyof PreviewCounts; label: string; icon: typeof FileText }[] = [
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "budgets", label: "Budgets", icon: Wallet },
  { key: "investments", label: "Investments", icon: TrendingUp },
  { key: "bills", label: "Bills", icon: FileText },
  { key: "goals", label: "Goals", icon: Target },
  { key: "categories", label: "Categories", icon: Tag },
  { key: "accounts", label: "Accounts", icon: Landmark },
];

const FORMATS = [
  { id: "csv", label: "CSV" },
  { id: "excel", label: "Excel" },
  { id: "json", label: "JSON" },
  { id: "pdf", label: "PDF" },
];

const DATA_TYPES: { key: string; label: string }[] = [
  { key: "transactions", label: "Expenses & Income" },
  { key: "budgets", label: "Budgets" },
  { key: "investments", label: "Investments" },
  { key: "bills", label: "Bills" },
  { key: "goals", label: "Goals" },
  { key: "categories", label: "Categories" },
  { key: "accounts", label: "Wallets & Money Sources" },
  { key: "analytics", label: "Analytics" },
  { key: "settings", label: "Settings" },
];

const RANGE_PRESETS = [
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
  { id: "custom", label: "Custom" },
] as const;

function presetToRange(preset: (typeof RANGE_PRESETS)[number]["id"], customFrom: string, customTo: string) {
  const now = new Date();
  if (preset === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (preset === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  return { from: customFrom || undefined, to: customTo || undefined };
}

export function ExportPreviewModal({
  isOpen,
  onClose,
  range: externalRange,
}: {
  isOpen: boolean;
  onClose: () => void;
  range?: { from?: string; to?: string };
}) {
  const { toast } = useToast();
  const [format, setFormat] = useState("csv");
  const [downloading, setDownloading] = useState(false);
  const [rangePreset, setRangePreset] = useState<(typeof RANGE_PRESETS)[number]["id"]>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(DATA_TYPES.map((t) => t.key));

  const range = externalRange ?? presetToRange(rangePreset, customFrom, customTo);

  const params = new URLSearchParams();
  if (range?.from) params.set("from", range.from);
  if (range?.to) params.set("to", range.to);

  const { data, isLoading } = useQuery({
    queryKey: ["export-preview", range?.from, range?.to],
    queryFn: () => api.get<{ counts: PreviewCounts; range: { from: string | null; to: string | null } }>(`/api/export/preview${params.toString() ? `?${params.toString()}` : ""}`),
    enabled: isOpen,
  });

  const toggleType = (key: string) => {
    setSelectedTypes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadExport(format, toast, range, selectedTypes);
      onClose();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-navy-dark"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-navy dark:text-white">Preview export</p>
              <button onClick={onClose} className="rounded-lg p-1 text-navy/40 hover:bg-black/5 dark:text-white/40 dark:hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-navy/50 dark:text-white/50">This export will include:</p>

            {!externalRange && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-navy/50 dark:text-white/50">Date Range</p>
                <div className="flex flex-wrap gap-2">
                  {RANGE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setRangePreset(p.id)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        rangePreset === p.id
                          ? "border-teal bg-teal/10 text-teal"
                          : "border-black/10 text-navy hover:border-teal/50 dark:border-white/10 dark:text-white"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {rangePreset === "custom" && (
                  <div className="mt-2 flex gap-2">
                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white" />
                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white" />
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-navy/50 dark:text-white/50">Data to Include</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DATA_TYPES.map((t) => (
                  <label key={t.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(t.key)}
                      onChange={() => toggleType(t.key)}
                      className="h-3.5 w-3.5 rounded border-black/20 text-teal dark:border-white/20"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {COUNT_META.map((m) => (
                  <div key={m.key} className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                    <span className="flex items-center gap-1.5 text-navy/60 dark:text-white/60"><m.icon className="h-3.5 w-3.5" /> {m.label}</span>
                    <span className="font-semibold text-navy dark:text-white">{data?.counts[m.key] ?? 0}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-navy/50 dark:text-white/50">Format</p>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium uppercase transition-all",
                      format === f.id
                        ? "border-teal bg-teal/10 text-teal"
                        : "border-black/10 text-navy hover:border-teal/50 dark:border-white/10 dark:text-white"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="button" size="sm" onClick={handleDownload} disabled={downloading}>
                <Download className="h-4 w-4" /> {downloading ? "Downloading…" : "Download"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
