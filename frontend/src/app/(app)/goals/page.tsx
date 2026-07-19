"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Goal } from "@/types";
import { Target, Plus, Pencil, Trash2, X, TrendingUp, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GOAL_CATEGORIES } from "@/lib/reference";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { useToast } from "@/components/ui/Toast";

const goalSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  category: z.string().min(1, "Category is required"),
  targetAmount: z.coerce.number().positive("Target must be positive"),
  currentAmount: z.coerce.number().nonnegative().default(0),
  monthlyContribution: z.coerce.number().nonnegative().default(0),
});

type GoalForm = z.infer<typeof goalSchema>;

function GoalModal({ open, editing, onClose }: {
  open: boolean; editing: Goal | null; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: editing ?? { name: "", category: "", targetAmount: 0, currentAmount: 0, monthlyContribution: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (data: GoalForm) => api.post<Goal>("/api/goals", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["goals"] }); onClose(); reset(); toast("Goal created", "success"); },
    onError: () => { toast("Failed to create goal", "error"); },
  });
  const updateMutation = useMutation({
    mutationFn: (data: GoalForm) => api.patch<Goal>(`/api/goals/${editing!.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["goals"] }); onClose(); reset(); toast("Goal updated", "success"); },
    onError: () => { toast("Failed to update goal", "error"); },
  });

  const onSubmit = handleSubmit((data) => {
    if (editing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={editing ? "Edit goal" : "Add goal"}>
      <FocusTrap active={open}>
      <div className="w-full max-w-md rounded-xl2 bg-white p-6 dark:bg-navy-dark max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy dark:text-white">{editing ? "Edit" : "Add"} Goal</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-navy/50" /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><label className="text-xs text-navy/50 dark:text-white/50">Name *</label>
            <input {...register("name")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div><label className="text-xs text-navy/50 dark:text-white/50">Category *</label>
            <select {...register("category")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
              <option value="">Select category…</option>
              {GOAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-navy/50 dark:text-white/50">Target Amount *</label>
              <input type="number" step="0.01" {...register("targetAmount")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
              {errors.targetAmount && <p className="text-xs text-red-500">{errors.targetAmount.message}</p>}
            </div>
            <div><label className="text-xs text-navy/50 dark:text-white/50">Current Amount</label>
              <input type="number" step="0.01" {...register("currentAmount")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
            </div>
          </div>
          <div><label className="text-xs text-navy/50 dark:text-white/50">Monthly Contribution</label>
            <input type="number" step="0.01" {...register("monthlyContribution")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
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

export default function GoalsPage() {
  const { settings } = useSettingsContext();
  const cur = settings.currency;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<{ items: Goal[] }>("/api/goals"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/goals/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["goals"] }); toast("Goal deleted", "success"); },
    onError: () => { toast("Failed to delete goal", "error"); },
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((g) => g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <>
      <Topbar title="Financial Goals" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-navy/50 dark:text-white/50">Set and track your financial goals.</p>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Add Goal</Button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-black/10 px-2 py-1 dark:border-white/10">
            <Search className="h-3.5 w-3.5 text-navy/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search goals..." className="w-40 bg-transparent text-xs outline-none placeholder:text-navy/30 dark:text-white" />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}
          </div>
        ) : items.length === 0 ? (
          <Card><CardContent className="pt-5">
            <EmptyState icon={Target} title="No goals set"
              description="Create financial goals to track your progress." actionLabel="Add Goal" onAction={() => { setEditing(null); setModalOpen(true); }} />
          </CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="pt-5">
            <EmptyState icon={Target} title="No matching goals" description="Try a different search term." />
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((g) => {
              const pct = g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0;
              const remaining = g.targetAmount - g.currentAmount;
              return (
                <Card key={g.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-navy dark:text-white truncate">{g.name}</h3>
                        <p className="text-xs text-navy/50 dark:text-white/50">{g.category}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditing(g); setModalOpen(true); }} className="rounded-lg p-1.5 hover:bg-black/5"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (confirm("Delete this goal?")) deleteMutation.mutate(g.id); }} className="rounded-lg p-1.5 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-navy/50 dark:text-white/50 mb-1">
                        <span>{formatPercent(pct)} complete</span>
                        <span className="truncate ml-2">{formatCurrency(g.currentAmount, cur)} / {formatCurrency(g.targetAmount, cur)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.min(pct * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-navy/50 dark:text-white/50">
                      <TrendingUp className="h-3 w-3 shrink-0" />
                      <span className="truncate">{formatCurrency(g.monthlyContribution, cur)}/mo — {formatCurrency(remaining, cur)} remaining</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <GoalModal open={modalOpen} editing={editing} onClose={() => { setModalOpen(false); setEditing(null); }} />
    </>
  );
}
