"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";

interface AdminActivityItem {
  id: string;
  event: string;
  detail?: string | null;
  createdAt: string;
  ip?: string | null;
  user: { name: string; email: string; uid: string } | null;
}

const EVENT_LABELS: Record<string, string> = {
  signup_requested: "Signup requested",
  user_approved: "User approved",
  user_rejected: "User rejected",
  user_updated: "User updated",
  user_deleted: "User deleted",
  user_created: "User created",
  password_changed: "Password changed",
  password_reset: "Password reset",
  password_reset_requested: "Reset code requested",
  password_reset_failed: "Failed password reset",
  password_reset_by_admin: "Password reset by admin",
  uid_changed: "UID changed",
  uid_change_failed: "Failed UID change",
  uid_reset_by_admin: "UID reset by admin",
  "2fa_enabled": "2FA enabled",
  "2fa_disabled": "2FA disabled",
  login_failed: "Failed login attempt",
  force_logout_by_admin: "Forced logout",
};

const selectCls = "rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white";

export default function AdminActivityPage() {
  const [event, setEvent] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (event) params.set("event", event);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity", event, from, to, page],
    queryFn: () => api.get<{ items: AdminActivityItem[]; pagination: { page: number; totalPages: number; total: number } }>(`/api/admin/activity?${params.toString()}`),
  });

  const items = data?.items ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <>
      <Topbar title="Activity Logs" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <Card className="mb-4">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Event Type</label>
                <select value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }} className={selectCls}>
                  <option value="">All Events</option>
                  {Object.entries(EVENT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">From</label>
                <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={selectCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">To</label>
                <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={selectCls} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-navy/50 dark:text-white/50">No activity found for these filters.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                        <th className="pb-2 pr-3 font-medium">Event</th>
                        <th className="pb-2 pr-3 font-medium">User</th>
                        <th className="pb-2 pr-3 font-medium">Time</th>
                        <th className="pb-2 font-medium">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((a) => (
                        <tr key={a.id} className="border-b border-black/5 dark:border-white/5">
                          <td className="py-2 pr-3">
                            <span className={cn("font-medium", a.event === "login_failed" ? "text-red-500" : "text-navy dark:text-white")}>{EVENT_LABELS[a.event] ?? a.event}</span>
                            {a.detail && <span className="block text-xs text-navy/40 dark:text-white/40">{a.detail}</span>}
                          </td>
                          <td className="py-2 pr-3 text-navy/70 dark:text-white/70">{a.user ? `${a.user.name} (${a.user.email})` : "—"}</td>
                          <td className="py-2 pr-3 text-navy/70 dark:text-white/70 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                          <td className="py-2 font-mono text-xs text-navy/60 dark:text-white/60">{a.ip ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg px-3 py-1.5 text-navy/60 hover:bg-black/5 disabled:opacity-40 dark:text-white/60 dark:hover:bg-white/5">Previous</button>
                    <span className="text-navy/50 dark:text-white/50">Page {page} of {totalPages}</span>
                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg px-3 py-1.5 text-navy/60 hover:bg-black/5 disabled:opacity-40 dark:text-white/60 dark:hover:bg-white/5">Next</button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
