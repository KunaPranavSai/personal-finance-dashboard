"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/PpButton";
import { FocusTrap } from "../ui/FocusTrap";
import { useExpenseCategories } from "@/lib/reference";
import { postWithOfflineQueue } from "@/lib/offlineAwarePost";
import { generateIdempotencyKey } from "@/lib/idempotencyKey";
import { getStorageMode } from "@/lib/storage";
import { createLocalBudget } from "@/lib/services/budgetsService";
import { useToast } from "../ui/Toast";
import { usePpToast } from "../ui/PpToast";
import type { Budget } from "@/types";

const schema = z.object({
  categoryId: z.string().min(1, "Choose a category for this budget."),
  amount: z.coerce.number({ invalid_type_error: "Enter the budget as a number, like 5000." })
    .refine((n) => Number.isFinite(n) && n > 0, "Enter a budget amount greater than zero.")
    .refine((n) => n <= 1_000_000_000, "That amount is too large. Check for extra digits."),
});
type FormValues = z.infer<typeof schema>;

export function BudgetFormModal({
  open, onClose, periodKey,
}: { open: boolean; onClose: () => void; periodKey: string }) {
  const queryClient = useQueryClient();
  const { data: categories, isLoading, error } = useExpenseCategories();
  const { toast } = useToast();
  const ppToast = usePpToast();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Stable for the life of one create attempt — reused across manual retries
  // of the same submission, regenerated only when the modal opens fresh or
  // after a successful create.
  const createIdempotencyKeyRef = useRef(generateIdempotencyKey());
  useEffect(() => {
    if (open) createIdempotencyKeyRef.current = generateIdempotencyKey();
  }, [open]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (getStorageMode() === "local") {
        const created = await createLocalBudget({ ...values, period: "MONTHLY", periodKey });
        return { queued: false, data: created };
      }
      return postWithOfflineQueue<Budget>("budget", "/api/budgets", { ...values, period: "MONTHLY", periodKey }, createIdempotencyKeyRef.current);
    },
    onMutate: () => ({ handle: ppToast.start("Saving budget…") }),
    onSuccess: (result, _values, context) => {
      // dashboard-summary's budgetUtilizationPct reads this collection too.
      queryClient.invalidateQueries({ queryKey: ["budgets"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"], refetchType: "all" });
      createIdempotencyKeyRef.current = generateIdempotencyKey();
      if (result && typeof result === "object" && "queued" in result && result.queued) {
        toast("You're offline — this will be saved automatically once you're back online.", "success");
        context?.handle.success("Budget queued — will sync when back online");
      } else {
        context?.handle.success("Budget added");
      }
      onClose();
    },
    onError: (_err, _values, context) => {
      context?.handle.error("Couldn't save budget — try again");
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-popup-backdrop" role="dialog" aria-modal="true" aria-label="Set budget" onClick={onClose}>
      <FocusTrap active={open}>
      <div className="w-full max-w-sm rounded-xl2 bg-pp-surface p-6 shadow-xl animate-popup-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-pp-text">Set Monthly Budget</h2>
        {error && <p className="mt-2 text-xs text-vulcanico">Failed to load categories.</p>}
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-pp-text-dim">Category</label>
            <select {...register("categoryId")} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm ">
              <option value="">{isLoading ? "Loading…" : "Select…"}</option>
              {(categories?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId && <p className="mt-1 text-xs text-vulcanico">{errors.categoryId.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-pp-text-dim">Monthly Budget (₹)</label>
            <input type="number" step="0.01" {...register("amount")} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm " />
            {errors.amount && <p className="mt-1 text-xs text-vulcanico">{errors.amount.message}</p>}
          </div>
          {mutation.isError && (
            <p className="text-xs text-vulcanico">{(mutation.error as Error)?.message ?? "Something went wrong"}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending || isLoading}>Save Budget</Button>
          </div>
        </form>
      </div>
      </FocusTrap>
    </div>
  );
}
