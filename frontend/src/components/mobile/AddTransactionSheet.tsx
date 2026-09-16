"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { createLocalTransaction, updateLocalTransaction } from "@/lib/services/transactionsService";
import { useCategories, useAccounts, usePaymentMethods } from "@/lib/reference";
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

const todayIso = () => new Date().toISOString().slice(0, 10);

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

  const categories = (categoriesData?.items ?? []).filter((c) => c.type === type);
  const accounts = accountsData?.items ?? [];
  const paymentMethods = paymentMethodsData?.items ?? [];

  const reset = () => {
    setType("EXPENSE");
    setDescription("");
    setAmount("");
    setDate(todayIso());
    setCategoryId("");
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

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!description.trim() || description.length > 200) next.description = "Enter a description (up to 200 characters).";
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) next.amount = "Enter an amount greater than 0.";
    if (!categoryId) next.categoryId = "Select a category.";
    if (!date) next.date = "Select a date.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      description: description.trim(),
      amount: Number(amount),
      type,
      date,
      categoryId,
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
          <button type="button" className={type === "EXPENSE" ? "on" : ""} onClick={() => { setType("EXPENSE"); setCategoryId(""); }}>
            Expense
          </button>
          <button type="button" className={type === "INCOME" ? "on" : ""} onClick={() => { setType("INCOME"); setCategoryId(""); }}>
            Income
          </button>
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-txn-desc">Description<span className="req">*</span></label>
          <input id="ppm-txn-desc" value={description} maxLength={200} placeholder="e.g. Blue Tokai Coffee" onChange={(e) => setDescription(e.target.value)} />
          {errors.description && <div className="err">{errors.description}</div>}
        </div>

        <div className="ppm-field-row">
          <div className="ppm-field">
            <label htmlFor="ppm-txn-amount">Amount (₹)<span className="req">*</span></label>
            <input id="ppm-txn-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {errors.amount && <div className="err">{errors.amount}</div>}
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-txn-date">Date<span className="req">*</span></label>
            <input id="ppm-txn-date" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
            {errors.date && <div className="err">{errors.date}</div>}
          </div>
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-txn-category">Category<span className="req">*</span></label>
          <select id="ppm-txn-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.categoryId && <div className="err">{errors.categoryId}</div>}
          {categories.length === 0 && <div className="err" style={{ color: "var(--ppm-text-dim)" }}>No {type.toLowerCase()} categories yet — add one from Settings on desktop.</div>}
        </div>

        {accounts.length > 0 && (
          <div className="ppm-field">
            <label htmlFor="ppm-txn-account">Wallet / Account</label>
            <select id="ppm-txn-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        {paymentMethods.length > 0 && (
          <div className="ppm-field">
            <label htmlFor="ppm-txn-pm">Money Source</label>
            <select id="ppm-txn-pm" value={paymentMethodTypeId} onChange={(e) => setPaymentMethodTypeId(e.target.value)}>
              <option value="">None</option>
              {paymentMethods.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

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
    </MobileSheet>
  );
}
