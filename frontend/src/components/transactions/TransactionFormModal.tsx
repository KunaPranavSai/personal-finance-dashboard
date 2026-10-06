"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { createLocalTransaction, updateLocalTransaction } from "@/lib/services/transactionsService";
import { Button } from "../ui/PpButton";
import { FocusTrap } from "../ui/FocusTrap";
import { Transaction, Category, Account, PaymentMethodType } from "@/types";
import { useEffect, useRef, useState } from "react";
import { useCategories, useAccounts, usePaymentMethods, ENTRY_TYPES } from "@/lib/reference";
import { sortAlpha, localToday } from "@/lib/transactionDefaults";
import { suggestFromDescription, useSmartHistory } from "@/lib/smartCategorize";
import { QuickCreateModal } from "../ui/QuickCreateModal";
import { postWithOfflineQueue } from "@/lib/offlineAwarePost";
import { generateIdempotencyKey } from "@/lib/idempotencyKey";
import { useToast } from "../ui/Toast";
import { usePpToast } from "../ui/PpToast";

/** Shared by all three "+ Add New…" quick-create mutations below: creates a
 * reference record through the active storage provider (Drive REST API or
 * local IndexedDB) so quick-create works identically in both storage modes. */
async function createReferenceRecord<T extends { id: string }>(
  collection: "categories" | "accounts" | "paymentMethods",
  apiPath: string,
  data: Record<string, unknown>
): Promise<T> {
  if (getStorageMode() === "local") {
    const outcome = await getStorageProvider().create<T & { createdAt: string; updatedAt: string }>(collection, data as never);
    if (outcome.status !== "success") throw new Error(outcome.message);
    return outcome.data;
  }
  return api.post<T>(apiPath, data, generateIdempotencyKey());
}

const schema = z.object({
  date: z.string().min(1, "Please select a date.").refine((d) => d <= localToday(), "The date can't be in the future."),
  description: z.string().trim().min(1, "Describe what this was for, like \"Weekly groceries\".").max(200, "Keep the description under 200 characters."),
  amount: z.coerce.number({ invalid_type_error: "Enter the amount as a number, like 450 or 1200.50." })
    .refine((n) => Number.isFinite(n), "Enter the amount as a number, like 450 or 1200.50.")
    .refine((n) => n > 0, "Enter an amount greater than zero.")
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "The amount can have at most 2 decimal places.")
    .refine((n) => n <= 1_000_000_000, "That amount is too large. Check for extra digits."),
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().optional(),
  merchant: z.string().max(100, "Keep the merchant under 100 characters.").optional(),
  accountId: z.string().optional(),
  paymentMethodTypeId: z.string().optional(),
  notes: z.string().max(1000, "Keep notes under 1000 characters.").optional(),
});

type FormValues = z.infer<typeof schema>;

export function TransactionFormModal({
  open,
  onClose,
  editing,
  fixedType,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  fixedType?: "INCOME" | "EXPENSE";
}) {
  const queryClient = useQueryClient();
  const { data: categories, isLoading: catLoading, error: catError } = useCategories();
  const { data: accounts, isLoading: accLoading, error: accError } = useAccounts();
  const { data: paymentMethods, isLoading: pmLoading } = usePaymentMethods();

  const [quickCreate, setQuickCreate] = useState<"category" | "account" | "paymentMethod" | null>(null);
  const [smart, setSmart] = useState(false);
  const history = useSmartHistory();

  // Stable for the life of one create attempt — reused across manual retries
  // of the same submission, regenerated only when a fresh entry starts
  // (below) or after a successful create, so a retry can never be mistaken
  // for a brand-new record by the backend's idempotency check.
  const createIdempotencyKeyRef = useRef(generateIdempotencyKey());

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: fixedType ?? "EXPENSE", date: localToday() },
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
      reset({ type: fixedType ?? "EXPENSE", date: new Date().toISOString().slice(0, 10), accountId: "", paymentMethodTypeId: "" });
      // A fresh (non-edit) form session is a new logical create attempt.
      createIdempotencyKeyRef.current = generateIdempotencyKey();
    }
  }, [editing, reset, open, fixedType]);

  const selectedType = watch("type");
  const watchedAccountId = watch("accountId");
  const watchedPaymentMethodTypeId = watch("paymentMethodTypeId");
  const { toast } = useToast();
  const ppToast = usePpToast();

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (getStorageMode() === "local") {
        return editing ? updateLocalTransaction(editing.id, values) : createLocalTransaction(values);
      }
      return editing
        ? api.patch(`/api/transactions/${editing.id}`, values)
        : postWithOfflineQueue(values.type === "INCOME" ? "income" : "expense", "/api/transactions", values, createIdempotencyKeyRef.current);
    },
    onMutate: (values) => {
      const label = values.type === "INCOME" ? "Income" : "Expense";
      return { handle: ppToast.start(editing ? `Updating ${label.toLowerCase()}…` : `Saving ${label.toLowerCase()}…`), label };
    },
    onSuccess: (result, _values, context) => {
      // Create succeeded — the next submission (if any) is a new attempt.
      if (!editing) createIdempotencyKeyRef.current = generateIdempotencyKey();
      // refetchType: "all" (not just TanStack's default "active") — the KPI summary card on
      // this same page is a real bug repro: with the default, its query was invalidated but
      // did not actually refetch until a manual page reload, leaving a stale total on screen
      // right after a create/edit even though the write itself succeeded and persisted.
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
      queryClient.invalidateQueries({ queryKey: ["smart-history"] });
      if (result && typeof result === "object" && "queued" in result && result.queued) {
        toast("You're offline — this will be saved automatically once you're back online.", "success");
        context?.handle.success(`${context.label} queued — will sync when back online`);
      } else {
        context?.handle.success(editing ? `${context.label} updated` : `${context.label} added`);
      }
      onClose();
    },
    onError: (_err, values, context) => {
      context?.handle.error(`Couldn't save ${values.type === "INCOME" ? "income" : "expense"} — try again`);
    },
  });

  const createCategory = useMutation({
    mutationFn: (name: string) =>
      createReferenceRecord<Category>("categories", "/api/categories", { name, type: selectedType, subcategories: [] }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setValue("categoryId", created.id);
      setQuickCreate(null);
    },
  });

  const createAccount = useMutation({
    mutationFn: (name: string) => createReferenceRecord<Account>("accounts", "/api/accounts", { name }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setValue("accountId", created.id);
      setValue("paymentMethodTypeId", "");
      setQuickCreate(null);
    },
  });

  const createPaymentMethod = useMutation({
    mutationFn: (name: string) => createReferenceRecord<PaymentMethodType>("paymentMethods", "/api/payment-methods", { name }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      setValue("paymentMethodTypeId", created.id);
      setValue("accountId", "");
      setQuickCreate(null);
    },
  });

  if (!open) return null;

  const NEW_OPTION = "__new__";
  const NEW_ACCOUNT_OPTION = "__new_account__";
  const NEW_PM_OPTION = "__new_pm__";
  const filteredCategories = sortAlpha((categories?.items ?? []).filter((c) => c.type === selectedType), (c) => c.name);
  const sourceLabel = selectedType === "INCOME" ? "Money Source" : "Wallet";
  const descField = register("description");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-popup-backdrop" role="dialog" aria-modal="true" aria-label={editing ? "Edit transaction" : "New transaction"} onClick={onClose}>
      <FocusTrap active={open}>
      <div className="w-full max-w-lg rounded-xl2 bg-pp-surface p-6 shadow-xl animate-popup-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-pp-text">
          {editing ? `Edit ${fixedType === "INCOME" ? "Income" : fixedType === "EXPENSE" ? "Expense" : "Transaction"}` : `Add ${fixedType === "INCOME" ? "Income" : fixedType === "EXPENSE" ? "Expense" : "Transaction"}`}
        </h2>

        {catError && (
          <p className="mt-2 text-xs text-vulcanico">Failed to load categories. Refresh and try again.</p>
        )}

        <form
          onSubmit={handleSubmit(async (values) => {
            // categoryId is required server-side: untouched + unmatched falls back to the per-type "Other".
            let categoryId = values.categoryId;
            if (!categoryId) {
              const other = (categories?.items ?? []).find((c) => c.type === values.type && /^other/i.test(c.name));
              categoryId = other?.id ?? (await createReferenceRecord<Category>("categories", "/api/categories", { name: "Other", type: values.type, subcategories: [] })).id;
              queryClient.invalidateQueries({ queryKey: ["categories"] });
            }
            mutation.mutate({ ...values, categoryId });
          })}
          className="mt-4 grid grid-cols-2 gap-4"
        >
          {!fixedType && (
            <div className="col-span-1">
              <label className="text-xs font-medium text-pp-text-dim">Type</label>
              <select {...register("type")} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm ">
                {ENTRY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          )}

          <div className="col-span-1">
            <label className="text-xs font-medium text-pp-text-dim">Date</label>
            <input type="date" {...register("date")} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm " />
            {errors.date && <p className="mt-1 text-xs text-vulcanico">{errors.date.message}</p>}
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-pp-text-dim">Description</label>
            <input {...descField} onChange={(e) => {
              void descField.onChange(e);
              // Smart pick: category + wallet/source from the description, but never over a choice the user made by hand.
              if (!editing) {
                const s = suggestFromDescription(e.target.value, watch("type") as "EXPENSE" | "INCOME", { categories: filteredCategories, accounts: accounts?.items ?? [], paymentMethods: paymentMethods?.items ?? [], history });
                if (!dirtyFields.categoryId) setValue("categoryId", s?.categoryId ?? "");
                if (!dirtyFields.accountId && !dirtyFields.paymentMethodTypeId) { setValue("accountId", s?.accountId ?? ""); setValue("paymentMethodTypeId", s?.paymentMethodTypeId ?? ""); }
                setSmart(Boolean(s));
              }
            }} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm " placeholder="Description required" />
            {errors.description && <p className="mt-1 text-xs text-vulcanico">{errors.description.message}</p>}
            {smart && !dirtyFields.categoryId && <p className="mt-1 text-xs text-pp-text-dim">✨ Smart-selected from your description — change the category or wallet anytime.</p>}
          </div>

          <div className="col-span-1">
            <label className="text-xs font-medium text-pp-text-dim">Amount (₹)</label>
            <input type="number" step="0.01" {...register("amount")} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm " placeholder="Amount required" />
            {errors.amount && <p className="mt-1 text-xs text-vulcanico">{errors.amount.message}</p>}
          </div>

          <div className="col-span-1">
            <label className="text-xs font-medium text-pp-text-dim">Category</label>
            <select
              {...register("categoryId")}
              onChange={(e) => { if (e.target.value === NEW_OPTION) { setQuickCreate("category"); return; } register("categoryId").onChange(e); }}
              className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm "
            >
              <option value="">{catLoading ? "Loading…" : "Select category"}</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value={NEW_OPTION}>+ Add Category</option>
            </select>
                      </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-pp-text-dim">{sourceLabel}</label>
            <select
              value={watchedAccountId ? `account:${watchedAccountId}` : watchedPaymentMethodTypeId ? `pm:${watchedPaymentMethodTypeId}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === NEW_ACCOUNT_OPTION) { setQuickCreate("account"); return; }
                if (v === NEW_PM_OPTION) { setQuickCreate("paymentMethod"); return; }
                if (v.startsWith("account:")) { setValue("accountId", v.slice(8), { shouldDirty: true }); setValue("paymentMethodTypeId", "", { shouldDirty: true }); }
                else if (v.startsWith("pm:")) { setValue("paymentMethodTypeId", v.slice(3), { shouldDirty: true }); setValue("accountId", "", { shouldDirty: true }); }
                else { setValue("accountId", ""); setValue("paymentMethodTypeId", ""); }
              }}
              className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm "
            >
              <option value="">{accLoading || pmLoading ? "Loading…" : `Select ${sourceLabel.toLowerCase()}`}</option>
              <optgroup label={sourceLabel}>
                {sortAlpha(accounts?.items ?? [], (a) => a.name).map((a) => <option key={a.id} value={`account:${a.id}`}>{a.name}</option>)}
                <option value={NEW_ACCOUNT_OPTION}>+ Add {sourceLabel}</option>
              </optgroup>
              {(paymentMethods?.items ?? []).length > 0 && (
              <optgroup label="Payment Methods">
                {sortAlpha(paymentMethods?.items ?? [], (pm) => pm.name).map((pm) => <option key={pm.id} value={`pm:${pm.id}`}>{pm.name}</option>)}
                <option value={NEW_PM_OPTION}>+ Add Payment Method</option>
              </optgroup>
              )}
            </select>
          </div>

          <div className="col-span-1">
            <label className="text-xs font-medium text-pp-text-dim">Merchant</label>
            <input {...register("merchant")} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm " />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-pp-text-dim">Notes</label>
            <textarea {...register("notes")} rows={2} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm " />
          </div>

          {mutation.isError && (
            <p className="col-span-2 text-xs text-vulcanico">
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

      {quickCreate === "category" && (
        <QuickCreateModal
          title={`Add New ${selectedType === "INCOME" ? "Income" : "Expense"} Category`}
          placeholder="e.g. Groceries"
          onSave={(name) => createCategory.mutate(name)}
          onClose={() => setQuickCreate(null)}
          isPending={createCategory.isPending}
          error={createCategory.isError ? (createCategory.error as Error)?.message ?? "Failed to create category" : null}
        />
      )}
      {quickCreate === "account" && (
        <QuickCreateModal
          title="Add New Wallet"
          placeholder="e.g. HDFC Savings"
          onSave={(name) => createAccount.mutate(name)}
          onClose={() => setQuickCreate(null)}
          isPending={createAccount.isPending}
          error={createAccount.isError ? (createAccount.error as Error)?.message ?? "Failed to create wallet" : null}
        />
      )}
      {quickCreate === "paymentMethod" && (
        <QuickCreateModal
          title="Add New Money Source"
          placeholder="e.g. UPI"
          onSave={(name) => createPaymentMethod.mutate(name)}
          onClose={() => setQuickCreate(null)}
          isPending={createPaymentMethod.isPending}
          error={createPaymentMethod.isError ? (createPaymentMethod.error as Error)?.message ?? "Failed to create money source" : null}
        />
      )}
    </div>
  );
}
