"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";
import { generateIdempotencyKey } from "@/lib/idempotencyKey";
import { INVESTMENT_CATEGORIES } from "@/lib/reference";
import { MobileSheet } from "./MobileSheet";
import type { Investment } from "@/types";

type Stored<T> = T & { createdAt: string; updatedAt: string; [k: string]: unknown };

interface InvestmentFormSheetProps {
  open: boolean;
  onClose: () => void;
  editing: Investment | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Mirrors backend/src/schemas/investment.schema.ts: instrument (1-100,
 * required), category (1-50, required — free text server-side, offered here
 * as INVESTMENT_CATEGORIES for consistency with the desktop form),
 * investedAmount/currentValue (nonnegative, required), purchaseDate
 * (required, must not be in the future), monthlyContribution (nonnegative,
 * default 0), annualReturnPct (plain number, can be negative), platform/notes
 * (optional).
 */
export function InvestmentFormSheet({ open, onClose, editing }: InvestmentFormSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = Boolean(editing);

  const [instrument, setInstrument] = useState("");
  const [category, setCategory] = useState(INVESTMENT_CATEGORIES[0]);
  const [investedAmount, setInvestedAmount] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [monthlyContribution, setMonthlyContribution] = useState("0");
  const [annualReturnPct, setAnnualReturnPct] = useState("0");
  const [platform, setPlatform] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setInstrument(editing.instrument);
      setCategory(editing.category);
      setInvestedAmount(String(editing.investedAmount));
      setCurrentValue(String(editing.currentValue));
      setPurchaseDate(editing.purchaseDate.slice(0, 10));
      setMonthlyContribution(String(editing.monthlyContribution));
      setAnnualReturnPct(String(editing.annualReturnPct));
      setPlatform(editing.platform ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setInstrument(""); setCategory(INVESTMENT_CATEGORIES[0]); setInvestedAmount(""); setCurrentValue("");
      setPurchaseDate(todayIso()); setMonthlyContribution("0"); setAnnualReturnPct("0"); setPlatform(""); setNotes("");
    }
    setErrors({});
  }, [open, editing]);

  const createKeyRef = useRef(generateIdempotencyKey());
  useEffect(() => { if (open && !editing) createKeyRef.current = generateIdempotencyKey(); }, [open, editing]);

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (getStorageMode() === "local") {
        const outcome = isEditing
          ? await getStorageProvider().update<Stored<Investment>>("investments", editing!.id, payload as never)
          : await getStorageProvider().create<Stored<Investment>>("investments", payload as never);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return isEditing
        ? api.patch<Investment>(`/api/investments/${editing!.id}`, payload)
        : api.post<Investment>("/api/investments", payload, createKeyRef.current);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast(isEditing ? "Investment updated" : "Investment added", "success");
      onClose();
    },
    onError: (err) => {
      toast((err as Error)?.message || "Couldn't save this investment. Please check and try again.", "error");
    },
  });

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!instrument.trim() || instrument.length > 100) next.instrument = "Enter an instrument name (up to 100 characters).";
    if (!category.trim()) next.category = "Select a category.";
    const invested = Number(investedAmount);
    if (investedAmount === "" || Number.isNaN(invested) || invested < 0) next.investedAmount = "Enter a valid invested amount.";
    const current = Number(currentValue);
    if (currentValue === "" || Number.isNaN(current) || current < 0) next.currentValue = "Enter a valid current value.";
    if (!purchaseDate) next.purchaseDate = "Select a purchase date.";
    else if (purchaseDate > todayIso()) next.purchaseDate = "Purchase date can't be in the future.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      instrument: instrument.trim(),
      category,
      investedAmount: Number(investedAmount),
      currentValue: Number(currentValue),
      purchaseDate,
      monthlyContribution: Number(monthlyContribution || 0),
      annualReturnPct: Number(annualReturnPct || 0),
      platform: platform.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleClose = () => { if (!mutation.isPending) onClose(); };

  return (
    <MobileSheet open={open} onClose={handleClose} title={isEditing ? "Edit Investment" : "Add Investment"}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="ppm-field">
          <label htmlFor="ppm-inv-instrument">Instrument<span className="req">*</span></label>
          <input id="ppm-inv-instrument" value={instrument} maxLength={100} placeholder="e.g. Nifty 50 Index Fund" onChange={(e) => setInstrument(e.target.value)} />
          {errors.instrument && <div className="err">{errors.instrument}</div>}
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-inv-category">Category<span className="req">*</span></label>
          <select id="ppm-inv-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {INVESTMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="ppm-field-row">
          <div className="ppm-field">
            <label htmlFor="ppm-inv-invested">Invested (₹)<span className="req">*</span></label>
            <input id="ppm-inv-invested" inputMode="decimal" placeholder="0.00" value={investedAmount} onChange={(e) => setInvestedAmount(e.target.value)} />
            {errors.investedAmount && <div className="err">{errors.investedAmount}</div>}
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-inv-current">Current Value (₹)<span className="req">*</span></label>
            <input id="ppm-inv-current" inputMode="decimal" placeholder="0.00" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            {errors.currentValue && <div className="err">{errors.currentValue}</div>}
          </div>
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-inv-date">Purchase Date<span className="req">*</span></label>
          <input id="ppm-inv-date" type="date" value={purchaseDate} max={todayIso()} onChange={(e) => setPurchaseDate(e.target.value)} />
          {errors.purchaseDate && <div className="err">{errors.purchaseDate}</div>}
        </div>

        <div className="ppm-field-row">
          <div className="ppm-field">
            <label htmlFor="ppm-inv-contrib">Monthly Contribution (₹)</label>
            <input id="ppm-inv-contrib" inputMode="decimal" value={monthlyContribution} onChange={(e) => setMonthlyContribution(e.target.value)} />
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-inv-return">Annual Return (%)</label>
            <input id="ppm-inv-return" inputMode="decimal" value={annualReturnPct} onChange={(e) => setAnnualReturnPct(e.target.value)} />
          </div>
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-inv-platform">Platform</label>
          <input id="ppm-inv-platform" value={platform} placeholder="e.g. Zerodha, Groww" onChange={(e) => setPlatform(e.target.value)} />
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-inv-notes">Notes</label>
          <textarea id="ppm-inv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>

        <div className="ppm-sheet-actions">
          <button type="submit" className="ppm-sheet-submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEditing ? "Save Changes" : "Add Investment"}
          </button>
          <button type="button" className="ppm-sheet-cancel" onClick={handleClose} disabled={mutation.isPending}>Cancel</button>
        </div>
      </form>
    </MobileSheet>
  );
}
