"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserCheck, UserX, Mail, Phone, Clock } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { ManagedUser, ApproveModal, RejectModal } from "@/components/admin/UserManagementShared";

type ModalState = { type: "approve"; user: ManagedUser } | { type: "reject"; user: ManagedUser } | null;

export default function AdminPendingPage() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["users-pending"],
    queryFn: () => api.get<{ items: ManagedUser[] }>("/api/auth/users/pending"),
  });

  const closeModal = useCallback(() => setModal(null), []);
  const items = data?.items ?? [];

  return (
    <>
      <Topbar title="Pending Approvals" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <Card>
          <CardContent className="pt-5">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-navy/50 dark:text-white/50">No accounts awaiting approval.</p>
            ) : (
              <div className="space-y-3">
                {items.map((u) => (
                  <div key={u.id} className="flex flex-col gap-3 rounded-lg border border-black/5 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy dark:text-white">{u.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy/50 dark:text-white/50">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</span>
                        {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone}</span>}
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" size="sm" onClick={() => setModal({ type: "approve", user: u })}>
                        <UserCheck className="h-4 w-4" /> Approve
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setModal({ type: "reject", user: u })}>
                        <UserX className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {modal?.type === "approve" && <ApproveModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} onDone={refetch} toast={toast} />}
      {modal?.type === "reject" && <RejectModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} onDone={refetch} toast={toast} />}
    </>
  );
}
