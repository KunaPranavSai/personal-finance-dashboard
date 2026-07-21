"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EVENT_META, TONE_CLASSES } from "@/components/admin/Timeline";
import { Activity as ActivityIcon } from "lucide-react";

interface AdminActivityItem {
  id: string;
  event: string;
  detail?: string | null;
  createdAt: string;
  ip?: string | null;
  user: { name: string; email: string; uid: string } | null;
}

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
        <AdminPageHeader icon={History} title="Activity Logs" description="Every account-change event across the platform, filterable." />
        <Card className="mb-4">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Event Type</label>
                <select value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }} className={selectCls}>
                  <option value="">All Events</option>
                  {Object.entries(EVENT_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
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
              <EmptyState icon={History} title="No activity found" description="Try widening your date range or clearing filters." />
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
                      {items.map((a) => {
                        const meta = EVENT_META[a.event] ?? { label: a.event, icon: ActivityIcon, tone: "navy" };
                        return (
                          <tr key={a.id} className="border-b border-black/5 transition-colors hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]">
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", TONE_CLASSES[meta.tone])}>
                                  <meta.icon className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <span className="font-medium text-navy dark:text-white">{meta.label}</span>
                                  {a.detail && <span className="block text-xs text-navy/40 dark:text-white/40">{a.detail}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 pr-3 text-navy/70 dark:text-white/70">{a.user ? `${a.user.name} (${a.user.email})` : "—"}</td>
                            <td className="py-2 pr-3 text-navy/70 dark:text-white/70 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                            <td className="py-2 font-mono text-xs text-navy/60 dark:text-white/60">{a.ip ?? "—"}</td>
                          </tr>
                        );
                      })}
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
