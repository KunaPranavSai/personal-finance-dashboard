"use client";

import { toUserMessage } from "@/lib/errorMessage";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/AppTopbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/PpCard";
import { Button } from "@/components/ui/PpButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
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
import { usePpToast } from "@/components/ui/PpToast";
import { usePpConfirm } from "@/components/ui/PpConfirm";
import { generateIdempotencyKey } from "@/lib/idempotencyKey";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { GoalFormSheet } from "@/components/mobile/GoalFormSheet";
import { ConfirmSheet } from "@/components/mobile/ConfirmSheet";

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
  const ppToast = usePpToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: editing ?? { name: "", category: "", targetAmount: 0, currentAmount: 0, monthlyContribution: 0 },
  });

  // Stable for the life of one create attempt — reused across manual retries
  // of the same submission, regenerated only when the modal opens fresh for
  // a new (non-editing) entry or after a successful create.
  const createIdempotencyKeyRef = useRef(generateIdempotencyKey());
  useEffect(() => {
    if (open && !editing) createIdempotencyKeyRef.current = generateIdempotencyKey();
  }, [open, editing]);

  const createMutation = useMutation({
    mutationFn: async (data: GoalForm) => {
      if (getStorageMode() === "local") {
        const outcome = await getStorageProvider().create<Goal & { createdAt: string; updatedAt: string; [k: string]: unknown }>("goals", data as never);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return api.post<Goal>("/api/goals", data, createIdempotencyKeyRef.current);
    },
    onMutate: () => ({ handle: ppToast.start("Saving goal…") }),
    onSuccess: (_result, _values, context) => {
      // dashboard-summary's emergencyFund/goalCount read this collection too.
      queryClient.invalidateQueries({ queryKey: ["goals"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"], refetchType: "all" });
      createIdempotencyKeyRef.current = generateIdempotencyKey();
      onClose(); reset(); context?.handle.success("Goal added");
    },
    onError: (err, _values, context) => {
      context?.handle.error("Couldn't save goal — try again");
      toast(toUserMessage(err, "We couldn't add the goal. Check the details and try again."), "error");
    },
  });
  const updateMutation = useMutation({
    mutationFn: async (data: GoalForm) => {
      if (getStorageMode() === "local") {
        const outcome = await getStorageProvider().update<Goal & { createdAt: string; updatedAt: string; [k: string]: unknown }>("goals", editing!.id, data as never);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return api.patch<Goal>(`/api/goals/${editing!.id}`, data);
    },
    onMutate: () => ({ handle: ppToast.start("Updating goal…") }),
    onSuccess: (_result, _values, context) => {
      queryClient.invalidateQueries({ queryKey: ["goals"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"], refetchType: "all" });
      onClose(); reset(); context?.handle.success("Goal updated");
    },
    onError: (err, _values, context) => {
      context?.handle.error("Couldn't update goal — try again");
      toast(toUserMessage(err, "We couldn't update the goal. Try again."), "error");
    },
  });

  const onSubmit = handleSubmit((data) => {
    if (editing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={editing ? "Edit goal" : "Add goal"}>
      <FocusTrap active={open}>
      <div className="w-full max-w-md rounded-xl2 bg-pp-surface p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-pp-text">{editing ? "Edit" : "Add"} Goal</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-pp-text-dim" /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><label className="text-xs text-pp-text-dim">Name</label>
            <input {...register("name")} placeholder="Name required" className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm " />
            {errors.name && <p className="text-xs text-vulcanico">{errors.name.message}</p>}
          </div>
          <div><label className="text-xs text-pp-text-dim">Category</label>
            <select {...register("category")} className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm ">
              <option value="">Select category…</option>
              {GOAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="text-xs text-vulcanico">{errors.category.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-pp-text-dim">Target Amount</label>
              <input type="number" step="0.01" {...register("targetAmount")} placeholder="Target amount required" className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm " />
              {errors.targetAmount && <p className="text-xs text-vulcanico">{errors.targetAmount.message}</p>}
            </div>
            <div><label className="text-xs text-pp-text-dim">Current Amount</label>
              <input type="number" step="0.01" {...register("currentAmount")} className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm " />
            </div>
          </div>
          <div><label className="text-xs text-pp-text-dim">Monthly Contribution</label>
            <input type="number" step="0.01" {...register("monthlyContribution")} className="w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm " />
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
  const ppToast = usePpToast();
  const confirmDialog = usePpConfirm();

  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileEditing, setMobileEditing] = useState<Goal | null>(null);
  const [mobileDeleteTarget, setMobileDeleteTarget] = useState<Goal | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["goals"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider()
            .list<Goal & { createdAt: string; updatedAt: string; [k: string]: unknown }>("goals")
            .then((items) => ({ items }))
        : api.get<{ items: Goal[] }>("/api/goals"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (getStorageMode() === "local") {
        const outcome = await getStorageProvider().remove("goals", id);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return;
      }
      return api.delete(`/api/goals/${id}`);
    },
    onMutate: () => ({ handle: ppToast.start("Removing goal…") }),
    onSuccess: (_data, _id, context) => {
      queryClient.invalidateQueries({ queryKey: ["goals"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"], refetchType: "all" });
      context?.handle.success("Goal deleted");
    },
    onError: (err, _id, context) => {
      context?.handle.error("Couldn't delete goal — try again");
      toast(toUserMessage(err, "We couldn't delete the goal. Try again."), "error");
    },
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((g) => g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q));
  }, [items, search]);

  if (isMobile) {
    return (
      <MobileShell title="Goals">
        <div className="ppm-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>Goals</h2>
            <p>{items.length} active</p>
          </div>
          <button type="button" className="ppm-link-btn" onClick={() => { setMobileEditing(null); setMobileSheetOpen(true); }}>+ Add</button>
        </div>

        {isLoading && <LoadingCard lines={4} />}
        {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}
        {!isLoading && !isError && items.length === 0 && (
          <EmptyCard icon={<Target size={22} />} title="No goals yet" subtitle="Tap + Add to start a savings goal." />
        )}

        {!isLoading && !isError && items.map((g) => {
          const pct = g.targetAmount > 0 ? Math.min(1, g.currentAmount / g.targetAmount) : 0;
          return (
            <div className="ppm-card ppm-budget-card" key={g.id}>
              <div className="ppm-budget-head">
                <span className="name" style={{ display: "flex", alignItems: "center", gap: 6 }}><Target size={15} /> {g.name}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="ppm-link-btn" onClick={() => { setMobileEditing(g); setMobileSheetOpen(true); }}>Edit</button>
                  <button type="button" className="ppm-link-btn" style={{ color: "var(--ppm-critical)" }} onClick={() => setMobileDeleteTarget(g)}>Delete</button>
                </div>
              </div>
              <div className="ppm-bar-track">
                <div className="ppm-bar-fill" style={{ width: `${pct * 100}%`, background: "var(--ppm-accent)" }} />
              </div>
              <div className="ppm-budget-nums">
                <span>{formatPercent(pct)} complete</span>
                <span>{formatCurrency(g.currentAmount, cur)} of {formatCurrency(g.targetAmount, cur)}</span>
              </div>
              {g.monthlyContribution > 0 && (
                <div className="ppm-meta" style={{ marginTop: 6 }}>Contributing {formatCurrency(g.monthlyContribution, cur)}/month · {g.category}</div>
              )}
            </div>
          );
        })}

        <GoalFormSheet open={mobileSheetOpen} onClose={() => { setMobileSheetOpen(false); setMobileEditing(null); }} editing={mobileEditing} />
        <ConfirmSheet
          open={Boolean(mobileDeleteTarget)}
          onClose={() => setMobileDeleteTarget(null)}
          onConfirm={() => mobileDeleteTarget && deleteMutation.mutate(mobileDeleteTarget.id)}
          title="Delete goal"
          message={`Delete "${mobileDeleteTarget?.name}"? This can't be undone.`}
          isPending={deleteMutation.isPending}
        />
      </MobileShell>
    );
  }

  return (
    <>
      <Topbar title="Financial Goals" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 2xl:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-pp-text-dim">Set and track your financial goals.</p>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Add Goal</Button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-pp-border px-2 py-1 ">
            <Search className="h-3.5 w-3.5 text-pp-text-dim" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search goals..." className="w-40 bg-transparent text-xs outline-none placeholder:text-pp-text-dim " />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl2 bg-pp-surface-2" />)}
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
                        <h3 className="font-semibold text-pp-text truncate">{g.name}</h3>
                        <p className="text-xs text-pp-text-dim">{g.category}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditing(g); setModalOpen(true); }} aria-label="Edit" className="rounded-lg p-1.5 hover:bg-pp-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={async () => { if (await confirmDialog({ message: "Delete this goal?" })) deleteMutation.mutate(g.id); }} aria-label="Delete" className="rounded-lg p-1.5 hover:bg-vulcanico/10"><Trash2 className="h-3.5 w-3.5 text-vulcanico" /></button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-pp-text-dim mb-1">
                        <span>{formatPercent(pct)} complete</span>
                        <span className="truncate ml-2">{formatCurrency(g.currentAmount, cur)} / {formatCurrency(g.targetAmount, cur)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-pp-surface-2 overflow-hidden">
                        <div className="h-full rounded-full bg-pp-accent transition-all" style={{ width: `${Math.min(pct * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-pp-text-dim">
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
