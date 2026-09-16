"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { createLocalBudget } from "@/lib/services/budgetsService";
import { useToast } from "@/components/ui/Toast";
import { generateIdempotencyKey } from "@/lib/idempotencyKey";
import { useExpenseCategories } from "@/lib/reference";
import { MobileSheet } from "./MobileSheet";
import type { Budget } from "@/types";

interface BudgetFormSheetProps {
  open: boolean;
  onClose: () => void;
  periodKey: string;
}

/**
 * Mirrors the desktop BudgetFormModal exactly: category + amount only
 * (period is always MONTHLY, periodKey is the current month, same as the
 * desktop budget page's own fixed usage) — POST /api/budgets or
 * createLocalBudget, matching backend/src/schemas/budget.schema.ts
 * (categoryId required, amount coerced nonnegative).
 */
export function BudgetFormSheet({ open, onClose, periodKey }: BudgetFormSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categoriesData } = useExpenseCategories();

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) { setCategoryId(""); setAmount(""); setErrors({}); }
  }, [open]);

  const createKeyRef = useRef(generateIdempotencyKey());
  useEffect(() => { if (open) createKeyRef.current = generateIdempotencyKey(); }, [open]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      getStorageMode() === "local"
        ? createLocalBudget(payload)
        : api.post<Budget>("/api/budgets", payload, createKeyRef.current),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast("Budget created", "success");
      onClose();
    },
    onError: (err) => {
      toast((err as Error)?.message || "Couldn't save this budget. Please check and try again.", "error");
    },
  });

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!categoryId) next.categoryId = "Select a category.";
    const amt = Number(amount);
    if (amount === "" || Number.isNaN(amt) || amt < 0) next.amount = "Enter a valid amount.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({ categoryId, amount: Number(amount), period: "MONTHLY", periodKey });
  };

  const handleClose = () => { if (!mutation.isPending) onClose(); };

  const categories = categoriesData?.items ?? [];

  return (
    <MobileSheet open={open} onClose={handleClose} title="Add Budget">
      <form onSubmit={handleSubmit} noValidate>
        <div className="ppm-field">
          <label htmlFor="ppm-budget-category">Category<span className="req">*</span></label>
          <select id="ppm-budget-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.categoryId && <div className="err">{errors.categoryId}</div>}
          {categories.length === 0 && <div className="err" style={{ color: "var(--ppm-text-dim)" }}>No expense categories yet.</div>}
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-budget-amount">Monthly Amount (₹)<span className="req">*</span></label>
          <input id="ppm-budget-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {errors.amount && <div className="err">{errors.amount}</div>}
        </div>

        <div className="ppm-sheet-actions">
          <button type="submit" className="ppm-sheet-submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Add Budget"}
          </button>
          <button type="button" className="ppm-sheet-cancel" onClick={handleClose} disabled={mutation.isPending}>Cancel</button>
        </div>
      </form>
    </MobileSheet>
  );
}
