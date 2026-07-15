"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { Account } from "@/types";
import { Landmark, Plus, Pencil, Trash2, Banknote } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FocusTrap } from "@/components/ui/FocusTrap";

const accountSchema = z.object({ name: z.string().min(1, "Name is required").max(50) });
type AccountForm = z.infer<typeof accountSchema>;

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<{ items: Account[] }>("/api/accounts"),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<Account>("/api/accounts", { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["accounts"] }); setShowModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch<Account>(`/api/accounts/${id}`, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["accounts"] }); setShowModal(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/accounts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const items = data?.items ?? [];

  return (
    <>
      <Topbar title="Accounts" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-navy/50 dark:text-white/50">{items.length} account(s)</p>
            <Button size="sm" onClick={() => { setEditing(null); setShowModal(true); }}>
              <Plus className="h-4 w-4" /> Add Account
            </Button>
          </div>

          <Card>
            <CardHeader><CardTitle>All Accounts</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
              ) : items.length === 0 ? (
                <EmptyState icon={Landmark} title="No accounts yet" description="Create your first account to start tracking." action={<Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> Create Account</Button>} />
              ) : (
                <div className="space-y-2">
                  {items.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-black/5 px-4 py-3 dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/10">
                          <Banknote className="h-4 w-4 text-teal" />
                        </div>
                        <span className="text-sm font-medium text-navy dark:text-white">{a.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditing(a); setShowModal(true); }}
                          className="rounded-lg p-1.5 text-navy/40 hover:bg-black/5 dark:text-white/40 dark:hover:bg-white/10"
                          aria-label={`Edit ${a.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete "${a.name}"?`)) deleteMutation.mutate(a.id); }}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          aria-label={`Delete ${a.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {showModal && (
        <AccountFormModal
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={(name) => editing ? updateMutation.mutate({ id: editing.id, name }) : createMutation.mutate(name)}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </>
  );
}

function AccountFormModal({ editing, onClose, onSave, isPending }: {
  editing: Account | null;
  onClose: () => void;
  onSave: (name: string) => void;
  isPending: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: editing?.name ?? "" },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={editing ? "Edit account" : "New account"} onClick={onClose}>
      <FocusTrap active={true}>
      <div className="w-full max-w-sm rounded-xl2 bg-white p-6 shadow-xl dark:bg-navy-dark" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy dark:text-white">{editing ? "Edit Account" : "New Account"}</h2>
        <form onSubmit={handleSubmit((d) => onSave(d.name))} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Account Name</label>
            <input {...register("name")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" placeholder="e.g. HDFC Savings" autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : editing ? "Save" : "Create"}</Button>
          </div>
        </form>
      </div>
      </FocusTrap>
    </div>
  );
}
