"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/Button";
import { FocusTrap } from "../ui/FocusTrap";
import { useExpenseCategories } from "@/lib/reference";
import { postWithOfflineQueue } from "@/lib/offlineAwarePost";
import { useToast } from "../ui/Toast";

const schema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  amount: z.coerce.number().nonnegative(),
});
type FormValues = z.infer<typeof schema>;

export function BudgetFormModal({
  open, onClose, periodKey,
}: { open: boolean; onClose: () => void; periodKey: string }) {
  const queryClient = useQueryClient();
  const { data: categories, isLoading, error } = useExpenseCategories();
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      postWithOfflineQueue("budget", "/api/budgets", { ...values, period: "MONTHLY", periodKey }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      if (result.queued) {
        toast("You're offline — this will be saved automatically once you're back online.", "success");
      }
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Set budget" onClick={onClose}>
      <FocusTrap active={open}>
      <div className="w-full max-w-sm rounded-xl2 bg-white p-6 shadow-xl dark:bg-navy-dark" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy dark:text-white">Set Monthly Budget</h2>
        {error && <p className="mt-2 text-xs text-red-600">Failed to load categories.</p>}
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Category</label>
            <select {...register("categoryId")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
              <option value="">{isLoading ? "Loading…" : "Select…"}</option>
              {(categories?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId && <p className="mt-1 text-xs text-red-600">{errors.categoryId.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Monthly Budget (₹)</label>
            <input type="number" step="0.01" {...register("amount")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:bg-white/5" />
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600">{(mutation.error as Error)?.message ?? "Something went wrong"}</p>
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
