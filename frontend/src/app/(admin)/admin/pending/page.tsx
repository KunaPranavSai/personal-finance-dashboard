"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { UserCheck, UserX, Mail, Phone, Clock, UserPlus } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ManagedUser, ApproveModal, RejectModal } from "@/components/admin/UserManagementShared";

type ModalState = { type: "approve"; user: ManagedUser } | { type: "reject"; user: ManagedUser } | null;

const AVATAR_COLORS = ["bg-teal/15 text-teal", "bg-blue-500/15 text-blue-600", "bg-purple-500/15 text-purple-600", "bg-amber-500/15 text-amber-600", "bg-emerald-500/15 text-emerald-600"];
function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

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
        <AdminPageHeader
          icon={UserPlus}
          title="Pending Approvals"
          description={`${items.length} registration${items.length === 1 ? "" : "s"} awaiting review.`}
        />
        <Card>
          <CardContent className="pt-5">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
            ) : items.length === 0 ? (
              <EmptyState icon={UserCheck} title="All caught up" description="No accounts are currently awaiting approval." />
            ) : (
              <div className="space-y-3">
                {items.map((u, i) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i, 6) * 0.04 }}
                    className="flex flex-col gap-3 rounded-xl border border-black/5 p-4 transition-shadow hover:shadow-md dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold", avatarColor(u.id))}>
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy dark:text-white">{u.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy/50 dark:text-white/50">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</span>
                          {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone}</span>}
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(u.createdAt).toLocaleDateString()}</span>
                        </div>
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
                  </motion.div>
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
