"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { FocusTrap } from "../ui/FocusTrap";
import { Transaction } from "@/types";
import { useEffect } from "react";
import { useCategories, useAccounts, usePaymentMethods, ENTRY_TYPES } from "@/lib/reference";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().min(1, "Category is required"),
  merchant: z.string().optional(),
  accountId: z.string().optional(),
  paymentMethodTypeId: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function TransactionFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
}) {
  const queryClient = useQueryClient();
  const { data: categories, isLoading: catLoading, error: catError } = useCategories();
  const { data: accounts, isLoading: accLoading, error: accError } = useAccounts();
  const { data: paymentMethods, isLoading: pmLoading } = usePaymentMethods();

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "EXPENSE", date: new Date().toISOString().slice(0, 10) },
  });

  useEffect(() => {
    if (editing) {
      reset({
        date: editing.date.slice(0, 10),
        description: editing.description,
        amount: editing.amount,
        type: editing.type,
        categoryId: editing.categoryId,
        merchant: editing.merchant ?? "",
        accountId: editing.accountId ?? "",
        paymentMethodTypeId: editing.paymentMethodTypeId ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      reset({ type: "EXPENSE", date: new Date().toISOString().slice(0, 10) });
    }
  }, [editing, reset, open]);

  const selectedType = watch("type");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      editing
        ? api.patch(`/api/transactions/${editing.id}`, values)
        : api.post("/api/transactions", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onClose();
    },
  });

  if (!open) return null;

  const filteredCategories = (categories?.items ?? []).filter((c) => c.type === selectedType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={editing ? "Edit transaction" : "New transaction"} onClick={onClose}>
      <FocusTrap active={open}>
      <div className="w-full max-w-lg rounded-xl2 bg-white p-6 shadow-xl dark:bg-navy-dark" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy dark:text-white">
          {editing ? "Edit Transaction" : "Add Transaction"}
        </h2>

        {catError && (
          <p className="mt-2 text-xs text-red-600">Failed to load categories. Refresh and try again.</p>
        )}

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="mt-4 grid grid-cols-2 gap-4"
        >
          <div className="col-span-1">
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Type</label>
            <select {...register("type")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:bg-white/5">
              {ENTRY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="col-span-1">
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Date</label>
            <input type="date" {...register("date")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:bg-white/5" />
            {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>}
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Description</label>
            <input {...register("description")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:bg-white/5" placeholder="e.g. Grocery shopping" />
            {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
          </div>

          <div className="col-span-1">
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Amount (₹)</label>
            <input type="number" step="0.01" {...register("amount")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:bg-white/5" placeholder="0.00" />
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
          </div>

          <div className="col-span-1">
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Category</label>
            <select {...register("categoryId")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:bg-white/5">
              <option value="">{catLoading ? "Loading…" : "Select…"}</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.categoryId && <p className="mt-1 text-xs text-red-600">{errors.categoryId.message}</p>}
          </div>

          <div className="col-span-1">
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Account</label>
            <select {...register("accountId")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:bg-white/5">
              <option value="">{accLoading ? "Loading…" : "None"}</option>
              {(accounts?.items ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-1">
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Payment Method</label>
            <select {...register("paymentMethodTypeId")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:bg-white/5">
              <option value="">{pmLoading ? "Loading…" : "None"}</option>
              {(paymentMethods?.items ?? []).map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-1">
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Merchant</label>
            <input {...register("merchant")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:bg-white/5" />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Notes</label>
            <textarea {...register("notes")} rows={2} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:bg-white/5" />
          </div>

          {mutation.isError && (
            <p className="col-span-2 text-xs text-red-600">
              {(mutation.error as Error)?.message ?? "Something went wrong"}
            </p>
          )}

          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending || catLoading || accLoading}>
              {mutation.isPending ? "Saving..." : editing ? "Save Changes" : "Add Transaction"}
            </Button>
          </div>
        </form>
      </div>
      </FocusTrap>
    </div>
  );
}
