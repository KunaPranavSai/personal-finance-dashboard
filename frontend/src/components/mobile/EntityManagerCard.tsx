"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MobileSheet } from "./MobileSheet";
import { ConfirmSheet } from "./ConfirmSheet";
import { LoadingCard, EmptyCard } from "./MobileStates";

interface NamedEntity { id: string; name: string; }

interface EntityManagerCardProps {
  queryKey: string;
  apiPath: string;
  itemLabel: string;
  addLabel: string;
  icon: string;
  emptyTitle: string;
  emptyDescription: string;
}

/**
 * Mobile equivalent of the desktop `EntityManager` in customizations/page.tsx
 * — same generic create/rename/delete over a `{id, name}` collection
 * (Wallets/Accounts and Money Sources/Payment Methods both use this exact
 * shape server-side), same API paths, same delete-blocked error surfaced
 * verbatim (e.g. "Cannot delete account with N linked transaction(s)...").
 */
export function EntityManagerCard({ queryKey, apiPath, itemLabel, addLabel, icon, emptyTitle, emptyDescription }: EntityManagerCardProps) {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<NamedEntity | null>(null);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<NamedEntity | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => api.get<{ items: NamedEntity[] }>(apiPath),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey], refetchType: "all" });

  const createMutation = useMutation({
    mutationFn: (n: string) => api.post<NamedEntity>(apiPath, { name: n }),
    onSuccess: () => { invalidate(); setSheetOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, n }: { id: string; n: string }) => api.patch<NamedEntity>(`${apiPath}/${id}`, { name: n }),
    onSuccess: () => { invalidate(); setSheetOpen(false); setEditing(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${apiPath}/${id}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });

  useEffect(() => {
    if (sheetOpen) setName(editing?.name ?? "");
  }, [sheetOpen, editing]);

  const items = data?.items ?? [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing) updateMutation.mutate({ id: editing.id, n: name.trim() });
    else createMutation.mutate(name.trim());
  };

  return (
    <>
      <div className="ppm-page-title" style={{ padding: "0 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>{items.length} {itemLabel}(s)</p>
        <button type="button" className="ppm-link-btn" onClick={() => { setEditing(null); setSheetOpen(true); }}>+ {addLabel}</button>
      </div>

      {isLoading && <LoadingCard lines={3} />}
      {!isLoading && items.length === 0 && <EmptyCard icon={icon} title={emptyTitle} subtitle={emptyDescription} />}
      {!isLoading && items.length > 0 && (
        <div className="ppm-card">
          {items.map((item) => (
            <div className="ppm-list-item" key={item.id} style={{ cursor: "default" }}>
              <div className="ppm-ic" aria-hidden="true">{icon}</div>
              <div className="ppm-info"><div className="ppm-name">{item.name}</div></div>
              <button type="button" className="ppm-link-btn" onClick={() => { setEditing(item); setSheetOpen(true); }}>Edit</button>
              <button type="button" className="ppm-link-btn" style={{ color: "var(--ppm-critical)" }} onClick={() => setDeleteTarget(item)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      <MobileSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditing(null); }} title={editing ? `Edit ${itemLabel}` : `New ${itemLabel}`}>
        <form onSubmit={handleSubmit}>
          <div className="ppm-field">
            <label htmlFor="ppm-entity-name">Name<span className="req">*</span></label>
            <input id="ppm-entity-name" value={name} maxLength={50} autoFocus onChange={(e) => setName(e.target.value)} />
          </div>
          {(createMutation.isError || updateMutation.isError) && (
            <div className="err" style={{ marginBottom: 10 }}>{((createMutation.error ?? updateMutation.error) as Error)?.message}</div>
          )}
          <div className="ppm-sheet-actions">
            <button type="submit" className="ppm-sheet-submit" disabled={isPending}>{isPending ? "Saving…" : editing ? "Save Changes" : `Add ${itemLabel}`}</button>
            <button type="button" className="ppm-sheet-cancel" onClick={() => { setSheetOpen(false); setEditing(null); }} disabled={isPending}>Cancel</button>
          </div>
        </form>
      </MobileSheet>

      <ConfirmSheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete ${itemLabel}`}
        message={`Delete "${deleteTarget?.name}"?`}
        isPending={deleteMutation.isPending}
        errorMessage={deleteMutation.isError ? (deleteMutation.error as Error)?.message : null}
      />
    </>
  );
}
