"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";
import { generateIdempotencyKey } from "@/lib/idempotencyKey";
import { GOAL_CATEGORIES } from "@/lib/reference";
import { MobileSheet } from "./MobileSheet";
import type { Goal } from "@/types";

type Stored<T> = T & { createdAt: string; updatedAt: string; [k: string]: unknown };

interface GoalFormSheetProps {
  open: boolean;
  onClose: () => void;
  editing: Goal | null;
}

/** No targetDate field exists on Goal server-side (flagged as missing in the
 * design spec) — this form never invents one, matching the desktop form. */
export function GoalFormSheet({ open, onClose, editing }: GoalFormSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = Boolean(editing);

  const [name, setName] = useState("");
  const [category, setCategory] = useState(GOAL_CATEGORIES[0]);
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [monthlyContribution, setMonthlyContribution] = useState("0");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setCategory(editing.category);
      setTargetAmount(String(editing.targetAmount));
      setCurrentAmount(String(editing.currentAmount));
      setMonthlyContribution(String(editing.monthlyContribution));
    } else {
      setName(""); setCategory(GOAL_CATEGORIES[0]); setTargetAmount(""); setCurrentAmount("0"); setMonthlyContribution("0");
    }
    setErrors({});
  }, [open, editing]);

  const createKeyRef = useRef(generateIdempotencyKey());
  useEffect(() => { if (open && !editing) createKeyRef.current = generateIdempotencyKey(); }, [open, editing]);

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (getStorageMode() === "local") {
        const outcome = isEditing
          ? await getStorageProvider().update<Stored<Goal>>("goals", editing!.id, payload as never)
          : await getStorageProvider().create<Stored<Goal>>("goals", payload as never);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return isEditing ? api.patch<Goal>(`/api/goals/${editing!.id}`, payload) : api.post<Goal>("/api/goals", payload, createKeyRef.current);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast(isEditing ? "Goal updated" : "Goal created", "success");
      onClose();
    },
    onError: (err) => {
      toast((err as Error)?.message || "Couldn't save this goal. Please check and try again.", "error");
    },
  });

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim() || name.length > 100) next.name = "Enter a name (up to 100 characters).";
    if (!category.trim()) next.category = "Select a category.";
    const target = Number(targetAmount);
    if (!targetAmount || Number.isNaN(target) || target <= 0) next.targetAmount = "Enter a target amount greater than 0.";
    const cur = Number(currentAmount);
    if (currentAmount !== "" && (Number.isNaN(cur) || cur < 0)) next.currentAmount = "Enter a valid amount.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      name: name.trim(),
      category,
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount || 0),
      monthlyContribution: Number(monthlyContribution || 0),
    });
  };

  const handleClose = () => { if (!mutation.isPending) onClose(); };

  return (
    <MobileSheet open={open} onClose={handleClose} title={isEditing ? "Edit Goal" : "Add Goal"}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="ppm-field">
          <label htmlFor="ppm-goal-name">Name<span className="req">*</span></label>
          <input id="ppm-goal-name" value={name} maxLength={100} placeholder="e.g. Emergency Fund" onChange={(e) => setName(e.target.value)} />
          {errors.name && <div className="err">{errors.name}</div>}
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-goal-category">Category<span className="req">*</span></label>
          <select id="ppm-goal-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {GOAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-goal-target">Target Amount (₹)<span className="req">*</span></label>
          <input id="ppm-goal-target" inputMode="decimal" placeholder="0.00" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
          {errors.targetAmount && <div className="err">{errors.targetAmount}</div>}
        </div>

        <div className="ppm-field-row">
          <div className="ppm-field">
            <label htmlFor="ppm-goal-current">Current Amount (₹)</label>
            <input id="ppm-goal-current" inputMode="decimal" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} />
            {errors.currentAmount && <div className="err">{errors.currentAmount}</div>}
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-goal-contrib">Monthly Contribution (₹)</label>
            <input id="ppm-goal-contrib" inputMode="decimal" value={monthlyContribution} onChange={(e) => setMonthlyContribution(e.target.value)} />
          </div>
        </div>

        <div className="ppm-sheet-actions">
          <button type="submit" className="ppm-sheet-submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEditing ? "Save Changes" : "Add Goal"}
          </button>
          <button type="button" className="ppm-sheet-cancel" onClick={handleClose} disabled={mutation.isPending}>Cancel</button>
        </div>
      </form>
    </MobileSheet>
  );
}
