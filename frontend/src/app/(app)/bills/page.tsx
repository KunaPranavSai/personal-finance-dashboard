"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatCurrency, formatDateIN } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Bill } from "@/types";
import { Receipt, Plus, Pencil, Trash2, X, Search, ArrowUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BILL_TYPES } from "@/lib/reference";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { useToast } from "@/components/ui/Toast";

const billSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.string().min(1),
  dueDate: z.string().min(1, "Due date is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  paidAmount: z.coerce.number().nonnegative().default(0),
  autoPay: z.boolean().default(false),
  interestRate: z.coerce.number().optional().or(z.literal("")),
  tenureMonths: z.coerce.number().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type BillForm = z.infer<typeof billSchema>;

function BillModal({ open, editing, onClose }: {
  open: boolean; editing: Bill | null; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BillForm>({
    resolver: zodResolver(billSchema),
    defaultValues: editing ? {
      name: editing.name, type: editing.type, dueDate: editing.dueDate.slice(0, 10),
      amount: editing.amount, paidAmount: editing.paidAmount, autoPay: editing.autoPay,
      interestRate: editing.interestRate ?? "", tenureMonths: editing.tenureMonths ?? "",
      notes: editing.notes ?? "",
    } : { name: "", type: "EMI", dueDate: "", amount: 0, paidAmount: 0, autoPay: false, interestRate: "", tenureMonths: "", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: BillForm) => {
      const payload = { ...data, interestRate: data.interestRate === "" ? null : Number(data.interestRate), tenureMonths: data.tenureMonths === "" ? null : Number(data.tenureMonths) };
      return api.post<Bill>("/api/bills", payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bills"] }); onClose(); reset(); toast("Bill added", "success"); },
    onError: () => { toast("Failed to save bill", "error"); },
  });
  const updateMutation = useMutation({
    mutationFn: (data: BillForm) => {
      const payload = { ...data, interestRate: data.interestRate === "" ? null : Number(data.interestRate), tenureMonths: data.tenureMonths === "" ? null : Number(data.tenureMonths) };
      return api.patch<Bill>(`/api/bills/${editing!.id}`, payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bills"] }); onClose(); reset(); toast("Bill updated", "success"); },
    onError: () => { toast("Failed to update bill", "error"); },
  });

  const onSubmit = handleSubmit((data) => {
    if (editing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={editing ? "Edit bill" : "Add bill"}>
      <FocusTrap active={open}>
      <div className="w-full max-w-md rounded-xl2 bg-white p-6 dark:bg-navy-dark max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy dark:text-white">{editing ? "Edit" : "Add"} Bill</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-navy/50" /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><label className="text-xs text-navy/50 dark:text-white/50">Name *</label>
            <input {...register("name")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div><label className="text-xs text-navy/50 dark:text-white/50">Type *</label>
            <select {...register("type")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
              {BILL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-navy/50 dark:text-white/50">Due Date *</label>
              <input type="date" {...register("dueDate")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
              {errors.dueDate && <p className="text-xs text-red-500">{errors.dueDate.message}</p>}
            </div>
            <div><label className="text-xs text-navy/50 dark:text-white/50">Amount *</label>
              <input type="number" step="0.01" {...register("amount")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
              {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-navy/50 dark:text-white/50">Paid Amount</label>
              <input type="number" step="0.01" {...register("paidAmount")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register("autoPay")} className="rounded" />
                <span className="text-xs text-navy/50 dark:text-white/50">Auto Pay</span>
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

  const { data, isLoading } = useQuery({
    queryKey: ["bills"],
    queryFn: () => api.get<{ items: Bill[] }>("/api/bills"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/bills/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bills"] }); toast("Bill deleted", "success"); },
    onError: () => { toast("Failed to delete bill", "error"); },
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

  return (
    <>
      <Topbar title="Bills & EMI" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-navy/50 dark:text-white/50">Manage your recurring bills and EMI payments.</p>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Add Bill</Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="min-w-0"><p className="text-xs text-navy/50">Total Bills</p><p className="text-xl font-bold text-navy dark:text-white truncate">{formatCurrency(totalBills, cur)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="min-w-0"><p className="text-xs text-navy/50">Total Paid</p><p className="text-xl font-bold text-emerald-600 truncate">{formatCurrency(totalPaid, cur)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="min-w-0"><p className="text-xs text-navy/50">Upcoming</p><p className="text-xl font-bold text-amber-600 truncate">{upcomingCount}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="min-w-0"><p className="text-xs text-navy/50">Overdue</p><p className="text-xl font-bold text-red-600 truncate">{overdueCount}</p></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>All Bills & EMI</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-black/10 px-2 py-1 dark:border-white/10">
                  <Search className="h-3.5 w-3.5 text-navy/40" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-24 bg-transparent text-xs outline-none placeholder:text-navy/30 dark:text-white" />
                </div>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5">
                  <option value="">All Types</option>
                  {BILL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5">
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
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Receipt} title="No bills found"
                description={items.length === 0 ? "Add bills to track payments and due dates." : "No matching bills."}
                actionLabel={items.length === 0 ? "Add Bill" : undefined}
                onAction={items.length === 0 ? () => { setEditing(null); setModalOpen(true); } : undefined} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
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
                        <tr key={b.id} className="border-b border-black/5 dark:border-white/5">
                          <td className="py-2 font-medium text-navy dark:text-white truncate max-w-[150px]">{b.name}</td>
                          <td className="py-2"><Badge tone="gray">{b.type}</Badge></td>
                          <td className={`py-2 whitespace-nowrap ${isOverdue ? "text-red-600 font-medium" : "text-navy/70 dark:text-white/70"}`}>{formatDateIN(b.dueDate)}</td>
                          <td className="py-2 text-navy dark:text-white whitespace-nowrap">{formatCurrency(b.amount, cur)}</td>
                          <td className="py-2 text-navy/70 dark:text-white/70 whitespace-nowrap">{formatCurrency(b.paidAmount, cur)}</td>
                          <td className="py-2">
                            {isPaid ? <Badge tone="green">Paid</Badge> : isOverdue ? <Badge tone="red">Overdue</Badge> : <Badge tone="yellow">Upcoming</Badge>}
                          </td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              <button onClick={() => { setEditing(b); setModalOpen(true); }} className="rounded-lg p-1.5 hover:bg-black/5"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { if (confirm("Delete this bill?")) deleteMutation.mutate(b.id); }} className="rounded-lg p-1.5 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BillModal open={modalOpen} editing={editing} onClose={() => { setModalOpen(false); setEditing(null); }} />
    </>
  );
}
