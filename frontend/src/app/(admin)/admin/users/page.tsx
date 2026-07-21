"use client";

import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { MoreVertical, Pencil, RotateCcw, IdCard, HardDrive, Trash2, Search, ShieldCheck, ShieldOff, LogOut, Users } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  ManagedUser, STATUS_STYLES, EditUserModal, ResetPasswordModal, ResetUidModal, UsageModal, DeleteUserModal,
} from "@/components/admin/UserManagementShared";

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

type ModalState =
  | { type: "edit"; user: ManagedUser }
  | { type: "reset-password"; user: ManagedUser }
  | { type: "reset-uid"; user: ManagedUser }
  | { type: "usage"; user: ManagedUser }
  | { type: "delete"; user: ManagedUser }
  | null;

const selectCls = "rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white";

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "createdAt" | "lastLoginAt">("createdAt");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data: allUsers, isLoading, refetch } = useQuery({
    queryKey: ["users-all"],
    queryFn: () => api.get<{ items: ManagedUser[] }>("/api/auth/users"),
  });

  const closeModal = useCallback(() => setModal(null), []);

  const filtered = useMemo(() => {
    let items = allUsers?.items ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.uid.toLowerCase().includes(q));
    }
    if (roleFilter) items = items.filter((u) => u.role === roleFilter);
    if (statusFilter) items = items.filter((u) => u.status === statusFilter);
    return [...items].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "lastLoginAt") return (b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0) - (a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [allUsers, search, roleFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const superAdminCount = (allUsers?.items ?? []).filter((u) => u.role === "SUPER_ADMIN").length;

  const forceLogout = useCallback(async (u: ManagedUser) => {
    setBusy(true);
    try {
      const data = await api.post<{ ok: boolean; message: string }>(`/api/admin/users/${u.id}/force-logout`);
      toast(data.message, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to force logout", "error");
    } finally {
      setBusy(false);
      setOpenMenuId(null);
    }
  }, [toast]);

  return (
    <>
      <Topbar title="All Users" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={Users} title="All Users" description={`${allUsers?.items.length ?? 0} total accounts across the platform.`} />
        <Card className="mb-4">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/30 dark:text-white/30" />
                  <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Name, email, or UID" className={cn(selectCls, "w-full pl-9")} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Role</label>
                <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className={selectCls}>
                  <option value="">All Roles</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="USER">User</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Status</label>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Sort By</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={selectCls}>
                  <option value="createdAt">Registered Date</option>
                  <option value="name">Name</option>
                  <option value="lastLoginAt">Last Login</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
            ) : pageItems.length === 0 ? (
              <EmptyState icon={Search} title="No users match these filters" description="Try adjusting your search, role, or status filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                      <th className="pb-2 pr-3 font-medium">Name</th>
                      <th className="pb-2 pr-3 font-medium">Email</th>
                      <th className="pb-2 pr-3 font-medium">Mobile</th>
                      <th className="pb-2 pr-3 font-medium">Role</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 pr-3 font-medium">Created</th>
                      <th className="pb-2 pr-3 font-medium">Last Login</th>
                      <th className="pb-2 pr-3 font-medium">2FA</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((u) => {
                      const isSelf = u.uid === currentUser?.uid;
                      const isLastSuperAdmin = u.role === "SUPER_ADMIN" && superAdminCount <= 1;
                      return (
                        <tr key={u.id} className="border-b border-black/5 transition-colors hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]">
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2.5">
                              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", avatarColor(u.id))}>
                                {initials(u.name)}
                              </div>
                              <span className="font-medium text-navy dark:text-white">{u.name}{isSelf && <span className="ml-1.5 text-xs font-normal text-navy/40 dark:text-white/40">(you)</span>}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-navy/70 dark:text-white/70">{u.email}</td>
                          <td className="py-2 pr-3 text-navy/60 dark:text-white/60">{u.phone ?? "—"}</td>
                          <td className="py-2 pr-3 text-navy/60 dark:text-white/60">{u.role.replace("_", " ")}</td>
                          <td className="py-2 pr-3">
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[u.status])}>{u.status}</span>
                          </td>
                          <td className="py-2 pr-3 text-navy/60 dark:text-white/60 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="py-2 pr-3 text-navy/60 dark:text-white/60 whitespace-nowrap">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}</td>
                          <td className="py-2 pr-3">
                            {u.twoFactorEnabled ? <ShieldCheck className="h-4 w-4 text-teal" /> : <ShieldOff className="h-4 w-4 text-navy/30 dark:text-white/30" />}
                          </td>
                          <td className="py-2 text-right relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                if (openMenuId === u.id) { setOpenMenuId(null); return; }
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 });
                                setOpenMenuId(u.id);
                              }}
                              className="rounded-lg p-1.5 text-navy/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
                              aria-label="Row actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === u.id && menuPos && createPortal(
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                                <div
                                  className="fixed z-50 w-48 overflow-hidden rounded-xl border border-black/5 bg-white shadow-lg dark:border-white/10 dark:bg-navy-dark"
                                  style={{ top: menuPos.top, left: menuPos.left }}
                                >
                                  <button type="button" onClick={() => { setModal({ type: "edit", user: u }); setOpenMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5">
                                    <Pencil className="h-3.5 w-3.5" /> Edit details
                                  </button>
                                  <button type="button" onClick={() => { setModal({ type: "reset-password", user: u }); setOpenMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5">
                                    <RotateCcw className="h-3.5 w-3.5" /> Reset password
                                  </button>
                                  <button type="button" onClick={() => { setModal({ type: "reset-uid", user: u }); setOpenMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5">
                                    <IdCard className="h-3.5 w-3.5" /> Reset UID
                                  </button>
                                  <button type="button" onClick={() => { setModal({ type: "usage", user: u }); setOpenMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5">
                                    <HardDrive className="h-3.5 w-3.5" /> View storage used
                                  </button>
                                  <button type="button" disabled={isSelf || busy} onClick={() => forceLogout(u)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-navy/70 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/70 dark:hover:bg-white/5">
                                    <LogOut className="h-3.5 w-3.5" /> Force logout
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSelf || isLastSuperAdmin}
                                    onClick={() => { setModal({ type: "delete", user: u }); setOpenMenuId(null); }}
                                    className="flex w-full items-center gap-2 border-t border-black/5 px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete account
                                  </button>
                                </div>
                              </>,
                              document.body
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg px-3 py-1.5 text-navy/60 hover:bg-black/5 disabled:opacity-40 dark:text-white/60 dark:hover:bg-white/5">Previous</button>
                <span className="text-navy/50 dark:text-white/50">Page {page} of {totalPages}</span>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg px-3 py-1.5 text-navy/60 hover:bg-black/5 disabled:opacity-40 dark:text-white/60 dark:hover:bg-white/5">Next</button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {modal?.type === "edit" && <EditUserModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} onDone={refetch} toast={toast} />}
      {modal?.type === "reset-password" && <ResetPasswordModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} toast={toast} />}
      {modal?.type === "reset-uid" && <ResetUidModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} onDone={refetch} toast={toast} />}
      {modal?.type === "usage" && <UsageModal user={modal.user} onClose={closeModal} />}
      {modal?.type === "delete" && <DeleteUserModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} onDone={refetch} toast={toast} />}
    </>
  );
}
