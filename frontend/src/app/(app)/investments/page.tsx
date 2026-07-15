"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Investment } from "@/types";
import { TrendingUp, Plus, Pencil, Trash2, X, Landmark, Search, ArrowUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { INVESTMENT_CATEGORIES } from "@/lib/reference";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { useToast } from "@/components/ui/Toast";

const investmentSchema = z.object({
  instrument: z.string().min(1, "Instrument is required").max(100),
  category: z.string().min(1, "Category is required"),
  currentValue: z.coerce.number().nonnegative("Must be non-negative"),
  monthlyContribution: z.coerce.number().nonnegative().default(0),
  annualReturnPct: z.coerce.number().default(0),
});

type InvestmentForm = z.infer<typeof investmentSchema>;

function InvestmentModal({ open, editing, onClose }: {
  open: boolean; editing: Investment | null; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<InvestmentForm>({
    resolver: zodResolver(investmentSchema),
    defaultValues: editing ?? { instrument: "", category: "", currentValue: 0, monthlyContribution: 0, annualReturnPct: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (data: InvestmentForm) => api.post<Investment>("/api/investments", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["investments"] }); onClose(); reset(); toast("Investment added", "success"); },
    onError: () => { toast("Failed to save investment", "error"); },
  });
  const updateMutation = useMutation({
    mutationFn: (data: InvestmentForm) => api.patch<Investment>(`/api/investments/${editing!.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["investments"] }); onClose(); reset(); toast("Investment updated", "success"); },
    onError: () => { toast("Failed to update investment", "error"); },
  });

  const onSubmit = handleSubmit((data) => {
    if (editing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={editing ? "Edit investment" : "Add investment"}>
      <FocusTrap active={open}>
      <div className="w-full max-w-md rounded-xl2 bg-white p-6 dark:bg-navy-dark max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy dark:text-white">{editing ? "Edit" : "Add"} Investment</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-navy/50" /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><label className="text-xs text-navy/50 dark:text-white/50">Instrument *</label>
            <input {...register("instrument")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
            {errors.instrument && <p className="text-xs text-red-500">{errors.instrument.message}</p>}
          </div>
          <div><label className="text-xs text-navy/50 dark:text-white/50">Category *</label>
            <select {...register("category")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10">
              <option value="">Select category…</option>
              {INVESTMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
          </div>
          <div><label className="text-xs text-navy/50 dark:text-white/50">Current Value *</label>
            <input type="number" step="0.01" {...register("currentValue")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
            {errors.currentValue && <p className="text-xs text-red-500">{errors.currentValue.message}</p>}
          </div>
          <div><label className="text-xs text-navy/50 dark:text-white/50">Monthly Contribution</label>
            <input type="number" step="0.01" {...register("monthlyContribution")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
          </div>
          <div><label className="text-xs text-navy/50 dark:text-white/50">Annual Return (%)</label>
            <input type="number" step="0.01" {...register("annualReturnPct")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
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

export default function InvestmentsPage() {
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortBy, setSortBy] = useState<"value" | "monthly" | "return" | "name">("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["investments"],
    queryFn: () => api.get<{ items: Investment[] }>("/api/investments"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/investments/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["investments"] }); toast("Investment deleted", "success"); },
    onError: () => { toast("Failed to delete investment", "error"); },
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(() => {
    let result = [...items];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.instrument.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    if (categoryFilter) {
      result = result.filter((i) => i.category === categoryFilter);
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "value") cmp = a.currentValue - b.currentValue;
      else if (sortBy === "monthly") cmp = a.monthlyContribution - b.monthlyContribution;
      else if (sortBy === "return") cmp = a.annualReturnPct - b.annualReturnPct;
      else cmp = a.instrument.localeCompare(b.instrument);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [items, search, categoryFilter, sortBy, sortDir]);

  const totalValue = items.reduce((s, i) => s + i.currentValue, 0);
  const totalMonthly = items.reduce((s, i) => s + i.monthlyContribution, 0);
  const avgReturn = items.length > 0 ? items.reduce((s, i) => s + i.annualReturnPct, 0) / items.length : 0;

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("desc"); }
  };

  return (
    <>
      <Topbar title="Investments" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-navy/50 dark:text-white/50">Track your investment portfolio.</p>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Add Investment</Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal/10"><Landmark className="h-6 w-6 text-teal" /></div>
            <div className="min-w-0"><p className="text-xs text-navy/50 dark:text-white/50">Portfolio Value</p><p className="text-xl font-bold text-navy dark:text-white truncate">{formatCurrency(totalValue, cur)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal/10"><TrendingUp className="h-6 w-6 text-teal" /></div>
            <div className="min-w-0"><p className="text-xs text-navy/50 dark:text-white/50">Monthly Contribution</p><p className="text-xl font-bold text-navy dark:text-white truncate">{formatCurrency(totalMonthly, cur)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 pt-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal/10"><TrendingUp className="h-6 w-6 text-teal" /></div>
            <div className="min-w-0"><p className="text-xs text-navy/50 dark:text-white/50">Avg. Annual Return</p><p className="text-xl font-bold text-navy dark:text-white truncate">{formatPercent(avgReturn / 100)}</p></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>All Investments</CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-black/10 px-2 py-1 dark:border-white/10">
                  <Search className="h-3.5 w-3.5 text-navy/40" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-28 bg-transparent text-xs outline-none placeholder:text-navy/30 dark:text-white" />
                </div>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5">
                  <option value="">All Categories</option>
                  {INVESTMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No investments yet"
                description={items.length === 0 ? "Add your first investment to start tracking." : "No matching investments."}
                actionLabel={items.length === 0 ? "Add Investment" : undefined}
                onAction={items.length === 0 ? () => { setEditing(null); setModalOpen(true); } : undefined} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                      <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("name")}>
                        Instrument <ArrowUpDown className="inline h-3 w-3" />
                      </th>
                      <th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("value")}>
                        Value <ArrowUpDown className="inline h-3 w-3" />
                      </th>
                      <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("monthly")}>
                        Monthly <ArrowUpDown className="inline h-3 w-3" />
                      </th>
                      <th className="pb-2 font-medium cursor-pointer select-none" onClick={() => toggleSort("return")}>
                        Return <ArrowUpDown className="inline h-3 w-3" />
                      </th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv) => (
                      <tr key={inv.id} className="border-b border-black/5 dark:border-white/5">
                        <td className="py-2 font-medium text-navy dark:text-white truncate max-w-[150px]">{inv.instrument}</td>
                        <td className="py-2"><Badge tone="gray">{inv.category}</Badge></td>
                        <td className="py-2 text-navy dark:text-white truncate max-w-[120px]">{formatCurrency(inv.currentValue, cur)}</td>
                        <td className="py-2 text-navy/70 dark:text-white/70">{formatCurrency(inv.monthlyContribution, cur)}</td>
                        <td className="py-2">{formatPercent(inv.annualReturnPct / 100)}</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <button onClick={() => { setEditing(inv); setModalOpen(true); }} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => { if (confirm("Delete this investment?")) deleteMutation.mutate(inv.id); }} className="rounded-lg p-1.5 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <InvestmentModal open={modalOpen} editing={editing} onClose={() => { setModalOpen(false); setEditing(null); }} />
    </>
  );
}
