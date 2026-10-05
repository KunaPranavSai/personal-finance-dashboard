"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/AppTopbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/PpCard";
import { Button } from "@/components/ui/PpButton";
import { Badge } from "@/components/ui/PpBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, ApiClientError } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { formatCurrency, formatDateIN } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Bill } from "@/types";
import { Receipt, Repeat, Plus, Pencil, Trash2, X, Search, ArrowUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BILL_TYPES } from "@/lib/reference";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { useToast } from "@/components/ui/Toast";
import { usePpToast } from "@/components/ui/PpToast";
import { usePpConfirm } from "@/components/ui/PpConfirm";
import { generateIdempotencyKey } from "@/lib/idempotencyKey";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { BillFormSheet } from "@/components/mobile/BillFormSheet";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";

type MobileBillState = "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "UNPAID";
function mobileBillState(b: Bill): MobileBillState {
  const overdue = new Date(b.dueDate) < new Date(new Date().toDateString()) && b.paidAmount < b.amount;
  if (overdue) return "OVERDUE";
  if (b.paidAmount >= b.amount && b.amount > 0) return "PAID";
  if (b.paidAmount > 0) return "PARTIALLY_PAID";
  return "UNPAID";
}
const MOBILE_BILL_STATE_LABEL: Record<MobileBillState, string> = { PAID: "Paid", PARTIALLY_PAID: "Partially paid", OVERDUE: "Overdue", UNPAID: "Unpaid" };
const MOBILE_BILL_STATE_CLASS: Record<MobileBillState, string> = { PAID: "under", PARTIALLY_PAID: "near", OVERDUE: "over", UNPAID: "near" };

const billSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.string().min(1),
  dueDate: z.string().min(1, "Due date is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  paidAmount: z.coerce.number().nonnegative().default(0),
  autoPay: z.boolean().default(false),
  interestRate: z.literal("").or(z.coerce.number()).optional(),
  tenureMonths: z.literal("").or(z.coerce.number()).optional(),
  notes: z.string().optional().or(z.literal("")),
});

type BillForm = z.infer<typeof billSchema>;

/** Surfaces the real backend/validation message instead of a generic string
 * — ApiClientError.message is already the server's `error` field (Zod
 * validation details, an expired-session 401, etc.), see lib/api.ts. */
function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

function BillModal({ open, editing, onClose }: {
  open: boolean; editing: Bill | null; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const ppToast = usePpToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BillForm>({
    resolver: zodResolver(billSchema),
    defaultValues: editing ? {
      name: editing.name, type: editing.type, dueDate: editing.dueDate.slice(0, 10),
      amount: editing.amount, paidAmount: editing.paidAmount, autoPay: editing.autoPay,
      interestRate: editing.interestRate ?? "", tenureMonths: editing.tenureMonths ?? "",
      notes: editing.notes ?? "",
    } : { name: "", type: "EMI", dueDate: "", amount: 0, paidAmount: 0, autoPay: false, interestRate: "", tenureMonths: "", notes: "" },
  });

  // Stable for the life of one create attempt — reused across manual retries
  // of the same submission, regenerated only when the modal opens fresh for
  // a new (non-editing) entry or after a successful create.
  const createIdempotencyKeyRef = useRef(generateIdempotencyKey());
  useEffect(() => {
    if (open && !editing) createIdempotencyKeyRef.current = generateIdempotencyKey();
  }, [open, editing]);

  const createMutation = useMutation({
    mutationFn: async (data: BillForm) => {
      const payload = { ...data, interestRate: data.interestRate === "" ? null : Number(data.interestRate), tenureMonths: data.tenureMonths === "" ? null : Number(data.tenureMonths) };
      if (getStorageMode() === "local") {
        const outcome = await getStorageProvider().create<Bill & { createdAt: string; updatedAt: string; [k: string]: unknown }>("bills", payload as never);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return api.post<Bill>("/api/bills", payload, createIdempotencyKeyRef.current);
    },
    onMutate: () => ({ handle: ppToast.start("Saving bill…") }),
    onSuccess: (_result, _values, context) => {
      // dashboard-summary's upcomingBills reads this collection too.
      queryClient.invalidateQueries({ queryKey: ["bills"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"], refetchType: "all" });
      createIdempotencyKeyRef.current = generateIdempotencyKey();
      onClose(); reset(); context?.handle.success("Bill added");
    },
    onError: (err, _values, context) => {
      const message = getErrorMessage(err, "Failed to save bill");
      context?.handle.error(message);
      toast(message, "error");
    },
  });
  const updateMutation = useMutation({
    mutationFn: async (data: BillForm) => {
      const payload = { ...data, interestRate: data.interestRate === "" ? null : Number(data.interestRate), tenureMonths: data.tenureMonths === "" ? null : Number(data.tenureMonths) };
      if (getStorageMode() === "local") {
        const outcome = await getStorageProvider().update<Bill & { createdAt: string; updatedAt: string; [k: string]: unknown }>("bills", editing!.id, payload as never);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return api.patch<Bill>(`/api/bills/${editing!.id}`, payload);
    },
    onMutate: () => ({ handle: ppToast.start("Updating bill…") }),
    onSuccess: (_result, _values, context) => {
      queryClient.invalidateQueries({ queryKey: ["bills"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"], refetchType: "all" });
      onClose(); reset(); context?.handle.success("Bill updated");
    },
    onError: (err, _values, context) => {
      const message = getErrorMessage(err, "Failed to update bill");
      context?.handle.error(message);
      toast(message, "error");
    },
  });

  const onSubmit = handleSubmit((data) => {
    if (editing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={editing ? "Edit bill" : "Add bill"}>
      <FocusTrap active={open}>
      <div className="w-full max-w-md rounded-xl2 bg-pp-surface p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-pp-text">{editing ? "Edit" : "Add"} Bill</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-pp-text-dim" /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><label className="text-xs text-pp-text-dim">Name</label>
            <input {...register("name")} placeholder="Name required" className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm " />
            {errors.name && <p className="text-xs text-vulcanico">{errors.name.message}</p>}
          </div>
          <div><label className="text-xs text-pp-text-dim">Type</label>
            <select {...register("type")} className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm ">
              {BILL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-pp-text-dim">Due Date</label>
              <input type="date" {...register("dueDate")} className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm " />
              {errors.dueDate && <p className="text-xs text-vulcanico">{errors.dueDate.message}</p>}
            </div>
            <div><label className="text-xs text-pp-text-dim">Amount</label>
              <input type="number" step="0.01" {...register("amount")} placeholder="Amount required" className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm " />
              {errors.amount && <p className="text-xs text-vulcanico">{errors.amount.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-pp-text-dim">Paid Amount</label>
              <input type="number" step="0.01" {...register("paidAmount")} className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm " />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register("autoPay")} className="rounded" />
                <span className="text-xs text-pp-text-dim">Auto Pay</span>
              </label>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
          </Button>
        </form>
      </div>
      </FocusTrap>
    </div>
  );
}

export default function BillsPage() {
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "overdue" | "upcoming">("all");
  const [sortBy, setSortBy] = useState<"name" | "dueDate" | "amount">("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const ppToast = usePpToast();
  const confirmDialog = usePpConfirm();

  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileEditing, setMobileEditing] = useState<Bill | null>(null);
  const [mobileDeleteTarget, setMobileDeleteTarget] = useState<Bill | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bills"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider()
            .list<Bill & { createdAt: string; updatedAt: string; [k: string]: unknown }>("bills")
            .then((items) => ({ items }))
        : api.get<{ items: Bill[] }>("/api/bills"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (getStorageMode() === "local") {
        const outcome = await getStorageProvider().remove("bills", id);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return;
      }
      return api.delete(`/api/bills/${id}`);
    },
    onMutate: () => ({ handle: ppToast.start("Removing bill…") }),
    onSuccess: (_data, _id, context) => {
      queryClient.invalidateQueries({ queryKey: ["bills"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"], refetchType: "all" });
      context?.handle.success("Bill deleted");
    },
    onError: (err, _id, context) => {
      const message = getErrorMessage(err, "Failed to delete bill");
      context?.handle.error(message);
      toast(message, "error");
    },
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    let result = [...items];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((b) => b.name.toLowerCase().includes(q) || b.type.toLowerCase().includes(q) || (b.notes ?? "").toLowerCase().includes(q));
    }
    if (typeFilter) {
      result = result.filter((b) => b.type === typeFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((b) => {
        const due = new Date(b.dueDate);
        const isPaid = b.paidAmount >= b.amount;
        const isOverdue = due < now && !isPaid;
        if (statusFilter === "paid") return isPaid;
        if (statusFilter === "overdue") return isOverdue;
        if (statusFilter === "upcoming") return !isPaid && !isOverdue;
        return true;
      });
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "dueDate") cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      else if (sortBy === "amount") cmp = a.amount - b.amount;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [items, search, typeFilter, statusFilter, sortBy, sortDir, now]);

  const totalBills = items.reduce((s, b) => s + b.amount, 0);
  const totalPaid = items.reduce((s, b) => s + b.paidAmount, 0);
  const upcomingCount = items.filter((b) => new Date(b.dueDate) >= now && b.paidAmount < b.amount).length;
  const overdueCount = items.filter((b) => new Date(b.dueDate) < now && b.paidAmount < b.amount).length;

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  };

  if (isMobile) {
    const mItems = [...(data?.items ?? [])].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return (
      <MobileShell title="Bills & EMIs">
        <div className="ppm-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>Bills &amp; EMIs</h2>
            <p>{mItems.length} tracked</p>
          </div>
          <button type="button" className="ppm-link-btn" onClick={() => { setMobileEditing(null); setMobileSheetOpen(true); }}>+ Add</button>
        </div>

        {isLoading && <LoadingCard lines={4} />}
        {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}
        {!isLoading && !isError && mItems.length === 0 && (
          <EmptyCard icon={<Receipt size={22} />} title="No bills yet" subtitle="Tap + Add to track a bill, EMI, subscription or rent payment." />
        )}

        {!isLoading && !isError && mItems.length > 0 && (
          <div className="ppm-card">
            {mItems.map((b) => {
              const state = mobileBillState(b);
              return (
                <div className="ppm-list-item" key={b.id} onClick={() => { setMobileEditing(b); setMobileSheetOpen(true); }}>
                  <div className="ppm-ic" aria-hidden="true">{b.autoPay ? <Repeat size={18} /> : <Receipt size={18} />}</div>
                  <div className="ppm-info">
                    <div className="ppm-name">{b.name}</div>
                    <div className="ppm-meta">{b.type} · Due {formatDateIN(b.dueDate)}</div>
                  </div>
                  <div className="ppm-amt">
                    {formatCurrency(b.amount, cur)}
                    <span className={`ppm-status ${MOBILE_BILL_STATE_CLASS[state]}`} style={{ display: "inline-block", marginTop: 3 }}>{MOBILE_BILL_STATE_LABEL[state]}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${b.name}`}
                    className="ppm-row-action"
                    onClick={(e) => { e.stopPropagation(); setMobileDeleteTarget(b); }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <BillFormSheet open={mobileSheetOpen} onClose={() => { setMobileSheetOpen(false); setMobileEditing(null); }} editing={mobileEditing} />
        <ConfirmSheet
          open={Boolean(mobileDeleteTarget)}
          onClose={() => setMobileDeleteTarget(null)}
          onConfirm={() => mobileDeleteTarget && deleteMutation.mutate(mobileDeleteTarget.id)}
          title="Delete bill"
          message={`Delete "${mobileDeleteTarget?.name}"? This can't be undone.`}
          isPending={deleteMutation.isPending}
        />
      </MobileShell>
    );
  }

  return (
    <>
      <Topbar title="Bills & EMI" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 2xl:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-pp-text-dim">Manage your recurring bills and EMI payments.</p>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Add Bill</Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="min-w-0"><p className="text-xs text-pp-text-dim">Total Bills</p><p className="text-xl font-bold text-pp-text truncate">{formatCurrency(totalBills, cur)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="min-w-0"><p className="text-xs text-pp-text-dim">Total Paid</p><p className="text-xl font-bold text-mantis truncate">{formatCurrency(totalPaid, cur)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="min-w-0"><p className="text-xs text-pp-text-dim">Upcoming</p><p className="text-xl font-bold text-turmeric truncate">{upcomingCount}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="min-w-0"><p className="text-xs text-pp-text-dim">Overdue</p><p className="text-xl font-bold text-vulcanico truncate">{overdueCount}</p></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>All Bills & EMI</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-pp-border px-2 py-1 ">
                  <Search className="h-3.5 w-3.5 text-pp-text-dim" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-24 bg-transparent text-xs outline-none placeholder:text-pp-text-dim " />
                </div>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-pp-border px-2 py-1 text-xs ">
                  <option value="">All Types</option>
                  {BILL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-pp-border px-2 py-1 text-xs ">
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Upcoming</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-pp-surface-2" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Receipt} title="No bills found"
                description={items.length === 0 ? "Add bills to track payments and due dates." : "No matching bills."}
                actionLabel={items.length === 0 ? "Add Bill" : undefined}
                onAction={items.length === 0 ? () => { setEditing(null); setModalOpen(true); } : undefined} />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pp-border text-left text-pp-text-dim">
                        <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("name")}>
                          Name <ArrowUpDown className="inline h-3 w-3" />
                        </th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("dueDate")}>
                          Due Date <ArrowUpDown className="inline h-3 w-3" />
                        </th>
                        <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("amount")}>
                          Amount <ArrowUpDown className="inline h-3 w-3" />
                        </th>
                        <th className="pb-2 font-medium">Paid</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b) => {
                        const dueDate = new Date(b.dueDate);
                        const isOverdue = dueDate < now && b.paidAmount < b.amount;
                        const isPaid = b.paidAmount >= b.amount;
                        return (
                          <tr key={b.id} className="border-b border-pp-border dark:border-white/5">
                            <td className="py-2 font-medium text-pp-text truncate max-w-[150px]">{b.name}</td>
                            <td className="py-2"><Badge tone="gray">{b.type}</Badge></td>
                            <td className={`py-2 whitespace-nowrap ${isOverdue ? "text-vulcanico font-medium" : "text-pp-text-dim"}`}>{formatDateIN(b.dueDate)}</td>
                            <td className="py-2 text-pp-text whitespace-nowrap">{formatCurrency(b.amount, cur)}</td>
                            <td className="py-2 text-pp-text-dim whitespace-nowrap">{formatCurrency(b.paidAmount, cur)}</td>
                            <td className="py-2">
                              {isPaid ? <Badge tone="green">Paid</Badge> : isOverdue ? <Badge tone="red">Overdue</Badge> : <Badge tone="yellow">Upcoming</Badge>}
                            </td>
                            <td className="py-2">
                              <div className="flex gap-1">
                                <button onClick={() => { setEditing(b); setModalOpen(true); }} aria-label="Edit" className="rounded-lg p-1.5 text-pp-text-dim hover:bg-pp-surface-2 hover:text-pp-text/40 dark:hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={async () => { if (await confirmDialog({ message: "Delete this bill?" })) deleteMutation.mutate(b.id); }} aria-label="Delete" className="rounded-lg p-1.5 hover:bg-vulcanico/10 dark:hover:bg-vulcanico/10"><Trash2 className="h-3.5 w-3.5 text-vulcanico" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2 md:hidden">
                  {filtered.map((b) => {
                    const dueDate = new Date(b.dueDate);
                    const isOverdue = dueDate < now && b.paidAmount < b.amount;
                    const isPaid = b.paidAmount >= b.amount;
                    return (
                      <div key={b.id} className="rounded-xl2 border border-pp-border bg-pp-surface p-3 ">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-pp-text">{b.name}</p>
                            <Badge tone="gray">{b.type}</Badge>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-pp-text">{formatCurrency(b.amount, cur)}</p>
                            {isPaid ? <Badge tone="green">Paid</Badge> : isOverdue ? <Badge tone="red">Overdue</Badge> : <Badge tone="yellow">Upcoming</Badge>}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`text-xs ${isOverdue ? "text-vulcanico font-medium" : "text-pp-text-dim"}`}>
                            Due {formatDateIN(b.dueDate)} · Paid {formatCurrency(b.paidAmount, cur)}
                          </span>
                          <div className="flex shrink-0 gap-1">
                            <button onClick={() => { setEditing(b); setModalOpen(true); }} className="rounded-lg p-1.5 text-pp-text-dim hover:bg-pp-surface-2 hover:text-pp-text/40 dark:hover:text-white" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={async () => { if (await confirmDialog({ message: "Delete this bill?" })) deleteMutation.mutate(b.id); }} className="rounded-lg p-1.5 hover:bg-vulcanico/10 dark:hover:bg-vulcanico/10" aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-vulcanico" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <BillModal open={modalOpen} editing={editing} onClose={() => { setModalOpen(false); setEditing(null); }} />
    </>
  );
}
