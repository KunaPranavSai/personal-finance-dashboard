"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";
import { generateIdempotencyKey } from "@/lib/idempotencyKey";
import { BILL_TYPES } from "@/lib/reference";
import { MobileSheet } from "./MobileSheet";
import type { Bill } from "@/types";

type Stored<T> = T & { createdAt: string; updatedAt: string; [k: string]: unknown };

interface BillFormSheetProps {
  open: boolean;
  onClose: () => void;
  editing: Bill | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Mirrors backend/src/schemas/bill.schema.ts: name (1-100, required), type
 * (1-50, free text — offered here as BILL_TYPES for consistency with the
 * desktop form, still a plain string), dueDate (required), amount/paidAmount
 * (nonnegative), autoPay (boolean), interestRate/tenureMonths (EMI-only,
 * conditionally shown only when type === "EMI" per the design spec's
 * explicit instruction not to invent recurrence/EMI behavior for other
 * types), notes (<=500).
 */
export function BillFormSheet({ open, onClose, editing }: BillFormSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = Boolean(editing);

  const [name, setName] = useState("");
  const [type, setType] = useState<string>(BILL_TYPES[0]);
  const [dueDate, setDueDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [autoPay, setAutoPay] = useState(false);
  const [interestRate, setInterestRate] = useState("");
  const [tenureMonths, setTenureMonths] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setDueDate(editing.dueDate.slice(0, 10));
      setAmount(String(editing.amount));
      setPaidAmount(String(editing.paidAmount ?? 0));
      setAutoPay(editing.autoPay);
      setInterestRate(editing.interestRate != null ? String(editing.interestRate) : "");
      setTenureMonths(editing.tenureMonths != null ? String(editing.tenureMonths) : "");
      setNotes(editing.notes ?? "");
    } else {
      setName(""); setType(BILL_TYPES[0]); setDueDate(todayIso()); setAmount(""); setPaidAmount("0");
      setAutoPay(false); setInterestRate(""); setTenureMonths(""); setNotes("");
    }
    setErrors({});
  }, [open, editing]);

  const createKeyRef = useRef(generateIdempotencyKey());
  useEffect(() => { if (open && !editing) createKeyRef.current = generateIdempotencyKey(); }, [open, editing]);

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (getStorageMode() === "local") {
        const outcome = isEditing
          ? await getStorageProvider().update<Stored<Bill>>("bills", editing!.id, payload as never)
          : await getStorageProvider().create<Stored<Bill>>("bills", payload as never);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return isEditing
        ? api.patch<Bill>(`/api/bills/${editing!.id}`, payload)
        : api.post<Bill>("/api/bills", payload, createKeyRef.current);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast(isEditing ? "Bill updated" : "Bill added", "success");
      onClose();
    },
    onError: (err) => {
      toast((err as Error)?.message || "Couldn't save this bill. Please check and try again.", "error");
    },
  });

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim() || name.length > 100) next.name = "Enter a name (up to 100 characters).";
    if (!type.trim()) next.type = "Select a type.";
    if (!dueDate) next.dueDate = "Select a due date.";
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt < 0) next.amount = "Enter a valid amount.";
    const paid = Number(paidAmount);
    if (paidAmount !== "" && (Number.isNaN(paid) || paid < 0)) next.paidAmount = "Enter a valid paid amount.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      name: name.trim(),
      type,
      dueDate,
      amount: Number(amount),
      paidAmount: Number(paidAmount || 0),
      autoPay,
      interestRate: type === "EMI" && interestRate ? Number(interestRate) : undefined,
      tenureMonths: type === "EMI" && tenureMonths ? Number(tenureMonths) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleClose = () => { if (!mutation.isPending) onClose(); };

  return (
    <MobileSheet open={open} onClose={handleClose} title={isEditing ? "Edit Bill" : "Add Bill"}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="ppm-field">
          <label htmlFor="ppm-bill-name">Name<span className="req">*</span></label>
          <input id="ppm-bill-name" value={name} maxLength={100} placeholder="e.g. HDFC Home EMI" onChange={(e) => setName(e.target.value)} />
          {errors.name && <div className="err">{errors.name}</div>}
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-bill-type">Type<span className="req">*</span></label>
          <select id="ppm-bill-type" value={type} onChange={(e) => setType(e.target.value)}>
            {BILL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="ppm-field-row">
          <div className="ppm-field">
            <label htmlFor="ppm-bill-amount">Amount (₹)<span className="req">*</span></label>
            <input id="ppm-bill-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {errors.amount && <div className="err">{errors.amount}</div>}
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-bill-due">Due Date<span className="req">*</span></label>
            <input id="ppm-bill-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {errors.dueDate && <div className="err">{errors.dueDate}</div>}
          </div>
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-bill-paid">Paid Amount (₹)</label>
          <input id="ppm-bill-paid" inputMode="decimal" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
          {errors.paidAmount && <div className="err">{errors.paidAmount}</div>}
        </div>

        {type === "EMI" && (
          <div className="ppm-field-row">
            <div className="ppm-field">
              <label htmlFor="ppm-bill-rate">Interest Rate (%)</label>
              <input id="ppm-bill-rate" inputMode="decimal" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
            </div>
            <div className="ppm-field">
              <label htmlFor="ppm-bill-tenure">Tenure (months)</label>
              <input id="ppm-bill-tenure" inputMode="numeric" value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} />
            </div>
          </div>
        )}

        <div className="ppm-list-item" style={{ padding: "8px 2px" }}>
          <div className="ppm-info"><div className="ppm-name">Auto-Pay</div></div>
          <button type="button" className={`ppm-toggle${autoPay ? " on" : ""}`} role="switch" aria-checked={autoPay} onClick={() => setAutoPay((v) => !v)} />
        </div>

        <div className="ppm-field">
          <label htmlFor="ppm-bill-notes">Notes</label>
          <textarea id="ppm-bill-notes" value={notes} maxLength={500} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="ppm-sheet-actions">
          <button type="submit" className="ppm-sheet-submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEditing ? "Save Changes" : "Add Bill"}
          </button>
          <button type="button" className="ppm-sheet-cancel" onClick={handleClose} disabled={mutation.isPending}>Cancel</button>
        </div>
      </form>
    </MobileSheet>
  );
}
