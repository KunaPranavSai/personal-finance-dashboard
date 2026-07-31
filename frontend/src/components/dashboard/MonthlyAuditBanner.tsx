"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wallet, TrendingUp, PiggyBank, Target, CheckCircle2, Edit3, X, ArrowRight, RotateCcw } from "lucide-react";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/format";

interface AuditFieldState {
  updated: boolean;
  value?: string;
}
interface MonthlyAuditRecord {
  budget: AuditFieldState;
  investments: AuditFieldState;
  savings: AuditFieldState;
  goals: AuditFieldState;
}
type FieldKey = keyof MonthlyAuditRecord;

const EMPTY_RECORD: MonthlyAuditRecord = {
  budget: { updated: false },
  investments: { updated: false },
  savings: { updated: false },
  goals: { updated: false },
};

const FIELD_META: Record<FieldKey, { label: string; icon: typeof Wallet; href: string; inputLabel: string; placeholder: string }> = {
  budget: { label: "Budget", icon: Wallet, href: "/budget", inputLabel: "This month's total budget (₹)", placeholder: "e.g. 45000" },
  investments: {
    label: "Investments",
    icon: TrendingUp,
    href: "/investments",
    inputLabel: "This month's investment contribution (₹)",
    placeholder: "e.g. 8000",
  },
  savings: { label: "Savings", icon: PiggyBank, href: "/savings", inputLabel: "This month's savings goal (₹)", placeholder: "e.g. 12000" },
  goals: { label: "Financial Goals", icon: Target, href: "/goals", inputLabel: "Progress note for your goals", placeholder: "e.g. On track for vacation fund" },
};
const FIELD_ORDER: FieldKey[] = ["budget", "investments", "savings", "goals"];

const monthKeyFor = (d: Date) => `audit_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthNameFor = (d: Date) => d.toLocaleString("en-US", { month: "long" });

/** Quick-update modal for a single audit field — captures a lightweight
 * check-in value (not a replacement for the full Budget/Investments/Savings/
 * Goals pages, which each have their own real CRUD; this just records "yes,
 * I looked at this for the month" plus an optional headline number/note). */
function AuditFieldModal({ field, initialValue, onClose, onSave }: { field: FieldKey; initialValue: string; onClose: () => void; onSave: (value: string) => void }) {
  const meta = FIELD_META[field];
  const Icon = meta.icon;
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-modal-title"
        className="w-full max-w-sm rounded-2xl border border-violet-500/30 bg-slate-900/95 p-5 shadow-2xl shadow-violet-500/20 backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <h2 id="audit-modal-title" className="text-sm font-semibold text-white">
              Update {meta.label}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block text-xs font-medium text-white/60">{meta.inputLabel}</label>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={meta.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(value);
          }}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20"
        />

        <Link href={meta.href} onClick={onClose} className="mt-3 flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200">
          Open full {meta.label} page <ArrowRight className="h-3 w-3" />
        </Link>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => onSave(value)}
            className="flex-1 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-400"
          >
            Save & Mark Updated
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

/** A handful of small dots bursting outward — the "success particle" cue
 * fired for ~0.9s right after a field is saved. */
function SuccessBurst() {
  const dots = Array.from({ length: 8 });
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * 34, y: Math.sin(angle) * 34, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

function AuditChip({
  field,
  state,
  onClick,
  burst,
}: {
  field: FieldKey;
  state: AuditFieldState;
  onClick: () => void;
  burst: boolean;
}) {
  const meta = FIELD_META[field];
  const Icon = state.updated ? CheckCircle2 : Edit3;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors sm:text-sm",
        state.updated
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20"
          : "border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15"
      )}
    >
      <AnimatePresence>{burst && <SuccessBurst />}</AnimatePresence>
      {!state.updated && (
        <motion.span
          className="absolute inset-0 rounded-xl bg-amber-400/10"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <Icon className="relative h-4 w-4 shrink-0" />
      <span className="relative">
        {meta.label} {state.updated ? "Updated ✓" : ""}
      </span>
    </button>
  );
}

export function MonthlyAuditBanner() {
  const { settings, updateSettings } = useSettingsContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [snoozed, setSnoozed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeField, setActiveField] = useState<FieldKey | null>(null);
  const [burstField, setBurstField] = useState<FieldKey | null>(null);

  const now = useRef(new Date()).current;
  const dayOfMonth = now.getDate();
  const key = monthKeyFor(now);
  const inWindow = dayOfMonth >= 1 && dayOfMonth <= 7;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(`pfd-audit-snoozed-${key}`) === "1") setSnoozed(true);
    } catch {
      // ignore
    }
  }, [key]);

  if (!inWindow) return null;

  const monthlyAudit = (settings.monthlyAudit as Record<string, MonthlyAuditRecord> | undefined) ?? {};
  const record: MonthlyAuditRecord = { ...EMPTY_RECORD, ...(monthlyAudit[key] ?? {}) };
  const completedCount = FIELD_ORDER.filter((f) => record[f].updated).length;
  const allDone = completedCount === 4;
  const monthLabel = monthNameFor(now);

  const dismiss = () => {
    setSnoozed(true);
    try {
      sessionStorage.setItem(`pfd-audit-snoozed-${key}`, "1");
    } catch {
      // ignore
    }
  };

  const saveField = (field: FieldKey, value: string) => {
    const nextRecord: MonthlyAuditRecord = { ...record, [field]: { updated: true, value } };
    updateSettings({ monthlyAudit: { ...monthlyAudit, [key]: nextRecord } });
    setActiveField(null);
    setBurstField(field);
    setTimeout(() => setBurstField(null), 900);
    toast(`${FIELD_META[field].label} updated for ${monthLabel}!`, "success");
    // The hero's Financial Health Score reads live dashboard/investments
    // data reactively — nudging this query is enough for it to recompute.
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  if (allDone && !expanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-500 dark:text-emerald-400"
      >
        <CheckCircle2 className="h-4 w-4" />
        {monthLabel} Audit Complete! 🚀
        <button
          onClick={() => setExpanded(true)}
          className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/25 dark:text-emerald-400"
        >
          <RotateCcw className="h-3 w-3" /> Re-edit
        </button>
      </motion.div>
    );
  }

  if (snoozed && !allDone) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative mb-6 overflow-hidden rounded-2xl border border-violet-500/30 bg-slate-900/80 p-4 shadow-lg shadow-violet-500/10 backdrop-blur-xl dark:bg-slate-900/80 sm:p-5"
      >
        <button
          onClick={allDone ? () => setExpanded(false) : dismiss}
          aria-label={allDone ? "Collapse" : "Dismiss for this session"}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white/80"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <motion.span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-5 w-5" />
          </motion.span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white sm:text-base">Monthly Flight Check-In for {monthLabel} ✈️</h2>
            <p className="mt-0.5 text-xs text-white/60 sm:text-sm">Update your financial deck for the new month to keep your insights accurate.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {FIELD_ORDER.map((field) => (
            <AuditChip key={field} field={field} state={record[field]} burst={burstField === field} onClick={() => setActiveField(field)} />
          ))}
        </div>

        <p className="mt-3 text-[11px] font-medium text-white/40">{completedCount}/4 updated this month</p>
      </motion.div>

      <AnimatePresence>
        {activeField && (
          <AuditFieldModal
            field={activeField}
            initialValue={record[activeField].value ?? ""}
            onClose={() => setActiveField(null)}
            onSave={(value) => saveField(activeField, value)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
