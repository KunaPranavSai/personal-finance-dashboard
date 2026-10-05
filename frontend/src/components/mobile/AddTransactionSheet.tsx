"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { createLocalTransaction, updateLocalTransaction } from "@/lib/services/transactionsService";
import { useCategories, useAccounts, usePaymentMethods, createLocalCategory } from "@/lib/reference";
import { sortAlpha, localToday, suggestCategoryId } from "@/lib/transactionDefaults";
import { useToast } from "@/components/ui/Toast";
import { generateIdempotencyKey } from "@/lib/idempotencyKey";
import { MobileSheet } from "./MobileSheet";
import type { Transaction } from "@/types";

type EntryType = "EXPENSE" | "INCOME";

interface AddTransactionSheetProps {
  open: boolean;
  onClose: () => void;
  /** When set, the sheet edits this transaction instead of creating a new
   * one — same PATCH /api/transactions/:id (or updateLocalTransaction) the
   * desktop TransactionFormModal uses for edits. */
  editing?: Transaction | null;
}

const todayIso = localToday;
const ADD = "__add__";

/**
 * Mirrors backend/src/schemas/transaction.schema.ts exactly: description
 * (1-200, required), amount (coerced number, > 0, required), type (enum,
 * required), categoryId (required), subcategoryId/accountId/paymentMethodTypeId
 * (optional), notes (<=1000, optional). Writes through the same dual
 * Drive-API / Local-IndexedDB path every other form in the app already uses
 * (getStorageMode()), so a transaction added here shows up identically in
 * the existing desktop Transactions/Expenses/Income pages.
 */
export function AddTransactionSheet({ open, onClose, editing }: AddTransactionSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categoriesData } = useCategories();
  const { data: accountsData } = useAccounts();
  const { data: paymentMethodsData } = usePaymentMethods();
  const isEditing = Boolean(editing);

  const [type, setType] = useState<EntryType>("EXPENSE");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [paymentMethodTypeId, setPaymentMethodTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = sortAlpha((categoriesData?.items ?? []).filter((c) => c.type === type), (c) => c.name);
  const accounts = sortAlpha(accountsData?.items ?? [], (a) => a.name);
  const paymentMethods = sortAlpha(paymentMethodsData?.items ?? [], (p) => p.name);
  const sourceLabel = type === "INCOME" ? "Money Source" : "Wallet";
  // Once the user picks a category themselves, description edits stop overriding it.
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [adding, setAdding] = useState<"category" | "wallet" | null>(null);
  const [newName, setNewName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const addNameRef = useRef<HTMLInputElement>(null);
  // MobileSheet keeps children mounted while closed, so bare autoFocus would fire (and open the keyboard) on page load.
  useEffect(() => { if (adding) addNameRef.current?.focus(); }, [adding]);

  const reset = () => {
    setType("EXPENSE");
    setDescription("");
    setAmount("");
    setDate(todayIso());
    setCategoryId("");
    setCategoryTouched(false);
    setAccountId("");
    setPaymentMethodTypeId("");
    setNotes("");
    setErrors({});
  };

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setDescription(editing.description);
      setAmount(String(editing.amount));
      setDate(editing.date.slice(0, 10));
      setCategoryId(editing.categoryId ?? "");
      setAccountId(editing.accountId ?? "");
      setPaymentMethodTypeId(editing.paymentMethodTypeId ?? "");
      setNotes(editing.notes ?? "");
      setErrors({});
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Stable for the life of one create attempt — reused across manual retries
  // of the same submission, regenerated only when the sheet opens fresh or
  // after a successful create.
  const createIdempotencyKeyRef = useRef(generateIdempotencyKey());
  useEffect(() => {
    if (open && !editing) createIdempotencyKeyRef.current = generateIdempotencyKey();
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (getStorageMode() === "local") {
        return isEditing ? updateLocalTransaction(editing!.id, payload) : createLocalTransaction(payload);
      }
      return isEditing
        ? api.patch(`/api/transactions/${editing!.id}`, payload)
        : api.post("/api/transactions", payload, createIdempotencyKeyRef.current);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["income-expense-trend"] });
      queryClient.invalidateQueries({ queryKey: ["category-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      createIdempotencyKeyRef.current = generateIdempotencyKey();
      toast(isEditing ? "Transaction updated" : `${type === "EXPENSE" ? "Expense" : "Income"} saved`, "success");
      reset();
      onClose();
    },
    onError: (err) => {
      // The write may have partially succeeded server-side even though this
      // request errored (e.g. a timeout after the Drive write committed) —
      // never claim outright failure here beyond what the message says.
      toast((err as Error)?.message || "Couldn't save this transaction. Please check and try again.", "error");
    },
  });

  const onDescription = (v: string) => {
    setDescription(v);
    if (categoryTouched || isEditing) return;
    setCategoryId(suggestCategoryId(v, categories) ?? "");
  };

  const addEntity = async () => {
    const name = newName.trim();
    if (!name || !adding) return;
    setAddBusy(true);
    try {
      const local = getStorageMode() === "local";
      if (adding === "category") {
        const created = local ? await createLocalCategory({ name, type }) : await api.post<{ id: string }>("/api/categories", { name, type });
        await queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: "all" });
        setCategoryId(created.id);
        setCategoryTouched(true);
      } else {
        let id: string;
        if (local) {
          const outcome = await getStorageProvider().create<{ id: string; createdAt: string; updatedAt: string }>("accounts", { name } as never);
          if (outcome.status !== "success") throw new Error(outcome.message);
          id = outcome.data.id;
        } else {
          id = (await api.post<{ id: string }>("/api/accounts", { name })).id;
        }
        await queryClient.invalidateQueries({ queryKey: ["accounts"], refetchType: "all" });
        setAccountId(id);
        setPaymentMethodTypeId("");
      }
      toast(`${adding === "category" ? "Category" : sourceLabel} created`, "success");
      setAdding(null);
      setNewName("");
    } catch (e) {
      toast((e as Error).message || "Could not create it. Please try again.", "error");
    } finally {
      setAddBusy(false);
    }
  };

  // categoryId is required by the API/DB; an untouched, unmatched category falls back to the per-type "Other".
  const resolveCategoryId = async (): Promise<string> => {
    if (categoryId) return categoryId;
    const existing = categories.find((c) => /^other/i.test(c.name));
    if (existing) return existing.id;
    const created = getStorageMode() === "local" ? await createLocalCategory({ name: "Other", type }) : await api.post<{ id: string }>("/api/categories", { name: "Other", type });
    await queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: "all" });
    return created.id;
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!description.trim() || description.length > 200) next.description = "Please enter a description.";
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) next.amount = "Please enter an amount.";
    if (!date) next.date = "Select a date.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    let resolved: string;
    try { resolved = await resolveCategoryId(); } catch (err) { toast((err as Error).message || "Could not save this transaction.", "error"); return; }
    mutation.mutate({
      description: description.trim(),
      amount: Number(amount),
      type,
      date,
      categoryId: resolved,
      accountId: accountId || undefined,
      paymentMethodTypeId: paymentMethodTypeId || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    onClose();
  };

  return (
    <MobileSheet open={open} onClose={handleClose} title={isEditing ? "Edit Transaction" : "Add Transaction"}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="ppm-type-toggle">
          <button type="button" className={type === "EXPENSE" ? "on" : ""} onClick={() => { setType("EXPENSE"); setCategoryId(""); setCategoryTouched(false); setAccountId(""); setPaymentMethodTypeId(""); }}>
            Expense
          </button>
          <button type="button" className={type === "INCOME" ? "on" : ""} onClick={() => { setType("INCOME"); setCategoryId(""); setCategoryTouched(false); setAccountId(""); setPaymentMethodTypeId(""); }}>
            Income
          </button>
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-txn-desc">Description</label>
          <input id="ppm-txn-desc" value={description} maxLength={200} placeholder="Description required" onChange={(e) => onDescription(e.target.value)} />
          {errors.description && <div className="err">{errors.description}</div>}
        </div>

        <div className="ppm-field-row">
          <div className="ppm-field">
            <label htmlFor="ppm-txn-amount">Amount (₹)</label>
            <input id="ppm-txn-amount" inputMode="decimal" placeholder="Amount required" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {errors.amount && <div className="err">{errors.amount}</div>}
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-txn-date">Date</label>
            <input id="ppm-txn-date" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
            {errors.date && <div className="err">{errors.date}</div>}
          </div>
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-txn-category">Category</label>
          <select id="ppm-txn-category" value={categoryId} onChange={(e) => { if (e.target.value === ADD) { setAdding("category"); return; } setCategoryId(e.target.value); setCategoryTouched(true); }}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value={ADD}>+ Add Category</option>
          </select>
        </div>

        <div className="ppm-field">
            <label htmlFor="ppm-txn-wallet">{sourceLabel}</label>
            <select
              id="ppm-txn-wallet"
              value={accountId ? `account:${accountId}` : paymentMethodTypeId ? `pm:${paymentMethodTypeId}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === ADD) { setAdding("wallet"); return; }
                if (v.startsWith("account:")) { setAccountId(v.slice(8)); setPaymentMethodTypeId(""); }
                else if (v.startsWith("pm:")) { setPaymentMethodTypeId(v.slice(3)); setAccountId(""); }
                else { setAccountId(""); setPaymentMethodTypeId(""); }
              }}
            >
              <option value="">Select {sourceLabel.toLowerCase()}</option>
              {accounts.length > 0 && (
                <optgroup label={sourceLabel}>
                  {accounts.map((a) => <option key={a.id} value={`account:${a.id}`}>{a.name}</option>)}
                </optgroup>
              )}
              {paymentMethods.length > 0 && (
                <optgroup label="Payment Methods">
                  {paymentMethods.map((p) => <option key={p.id} value={`pm:${p.id}`}>{p.name}</option>)}
                </optgroup>
              )}
              <option value={ADD}>+ Add {sourceLabel}</option>
            </select>
          </div>

        <div className="ppm-field">
          <label htmlFor="ppm-txn-notes">Notes</label>
          <textarea id="ppm-txn-notes" value={notes} maxLength={1000} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="ppm-sheet-actions">
          <button type="submit" className="ppm-sheet-submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEditing ? "Save Changes" : `Save ${type === "EXPENSE" ? "Expense" : "Income"}`}
          </button>
          <button type="button" className="ppm-sheet-cancel" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </button>
        </div>
      </form>

      <MobileSheet open={adding !== null} onClose={() => { if (!addBusy) { setAdding(null); setNewName(""); } }} title={adding === "category" ? "Add Category" : `Add ${sourceLabel}`}>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void addEntity(); }}>
          <div className="ppm-field">
            <label htmlFor="ppm-add-name">Name</label>
            <input id="ppm-add-name" value={newName} maxLength={60} ref={addNameRef} placeholder="Name required" onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="ppm-sheet-actions">
            <button type="submit" className="ppm-sheet-submit" disabled={addBusy || !newName.trim()}>{addBusy ? "Adding…" : "Add"}</button>
            <button type="button" className="ppm-sheet-cancel" onClick={() => { setAdding(null); setNewName(""); }} disabled={addBusy}>Cancel</button>
          </div>
        </form>
      </MobileSheet>
    </MobileSheet>
  );
}
