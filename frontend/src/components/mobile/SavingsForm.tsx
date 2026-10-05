"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { sortAlpha } from "@/lib/transactionDefaults";
import { useToast } from "@/components/ui/Toast";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency } from "@/lib/format";
import type { Goal } from "@/types";

/**
 * "Add Savings" = put money into one of your savings goals. Savings plans are goals in this app
 * (there is no separate savings record), so this raises the goal's saved amount.
 */
export function SavingsForm({ onDone, onCreateGoal }: { onDone: () => void; onCreateGoal: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { settings } = useSettingsContext();
  const [goalId, setGoalId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const { data } = useQuery({
    queryKey: ["goals", "savings-form"],
    queryFn: async () =>
      getStorageMode() === "local"
        ? { items: (await getStorageProvider().list("goals")) as unknown as Goal[] }
        : api.get<{ items: Goal[] }>("/api/goals"),
  });
  const goals = sortAlpha(data?.items ?? [], (g) => g.name);
  const goal = goals.find((g) => g.id === goalId);

  const save = useMutation({
    mutationFn: async () => {
      const next = Number(goal!.currentAmount) + Number(amount);
      if (getStorageMode() === "local") {
        const r = await getStorageProvider().update("goals", goal!.id, { currentAmount: next } as never);
        if (r.status !== "success") throw new Error(r.message);
        return;
      }
      await api.patch(`/api/goals/${goal!.id}`, { currentAmount: next });
    },
    onSuccess: () => {
      for (const k of ["goals", "capital-summary", "activity-feed", "dashboard-summary"]) qc.invalidateQueries({ queryKey: [k] });
      toast("Savings added", "success");
      onDone();
    },
    onError: (e) => toast((e as Error).message || "Could not add savings", "error"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!goal) return setError("Please choose a savings goal.");
    if (!(Number(amount) > 0)) return setError("Please enter an amount.");
    setError("");
    save.mutate();
  };

  if (data && goals.length === 0) {
    return (
      <div className="ppm-card" style={{ textAlign: "center" }}>
        <div className="ppm-name">No savings goals yet</div>
        <div className="ppm-meta" style={{ margin: "6px 0 14px" }}>Create a goal first, then add savings to it.</div>
        <button type="button" className="ppm-sheet-submit" onClick={onCreateGoal}>Create a goal</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="ppm-field">
        <label htmlFor="sav-goal">Savings goal</label>
        <select id="sav-goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">Select goal</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        {goal && <div className="ppm-meta">Saved {formatCurrency(Number(goal.currentAmount), settings.currency)} of {formatCurrency(Number(goal.targetAmount), settings.currency)}</div>}
      </div>
      <div className="ppm-field">
        <label htmlFor="sav-amount">Amount (₹)</label>
        <input id="sav-amount" inputMode="decimal" placeholder="Amount required" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
      </div>
      {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
      <div className="ppm-sheet-actions">
        <button type="submit" className="ppm-sheet-submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Add Savings"}</button>
        <button type="button" className="ppm-sheet-cancel" onClick={onDone} disabled={save.isPending}>Cancel</button>
      </div>
    </form>
  );
}
