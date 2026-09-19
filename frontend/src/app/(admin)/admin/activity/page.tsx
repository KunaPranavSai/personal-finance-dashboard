"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { History, AlertTriangle, KeyRound, IdCard, ShieldCheck, ShieldOff, Mail } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard, StatCardSkeleton } from "@/components/admin/StatCard";
import { EVENT_META, TONE_COLOR } from "@/components/admin/Timeline";
import { Activity as ActivityIcon, X } from "lucide-react";

interface AdminActivityItem {
  id: string;
  event: string;
  detail?: string | null;
  createdAt: string;
  ip?: string | null;
  userAgent?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  user: { name: string; email: string; uid: string } | null;
}

function severityOf(event: string): "high" | "normal" {
  return /failed|locked|suspend/i.test(event) ? "high" : "normal";
}

interface SecuritySummary {
  counts: Record<string, number>;
  trend: { day: string; event: string; count: number }[];
}

const SECURITY_EVENT_META: Record<string, { label: string; icon: typeof AlertTriangle; tone: "teal" | "amber" | "red" | "emerald" | "navy"; color: string }> = {
  login_failed: { label: "Failed Logins", icon: AlertTriangle, tone: "red", color: "#C0392B" },
  password_changed: { label: "Password Changes", icon: KeyRound, tone: "teal", color: "#0EA5A5" },
  password_reset: { label: "Password Resets", icon: KeyRound, tone: "amber", color: "#F1C40F" },
  uid_changed: { label: "UID Changes", icon: IdCard, tone: "navy", color: "#2471A3" },
  "2fa_enabled": { label: "2FA Enabled", icon: ShieldCheck, tone: "emerald", color: "#1E8449" },
  "2fa_disabled": { label: "2FA Disabled", icon: ShieldOff, tone: "red", color: "#7D3C98" },
  password_reset_requested: { label: "Reset Requests", icon: Mail, tone: "navy", color: "#1F2A44" },
};

function pivotTrend(trend: SecuritySummary["trend"]): Record<string, string | number>[] {
  const days = new Map<string, Record<string, string | number>>();
  for (const row of trend) {
    const existing = days.get(row.day) ?? { day: row.day };
    existing[row.event] = row.count;
    days.set(row.day, existing);
  }
  return Array.from(days.values()).sort((a, b) => String(a.day).localeCompare(String(b.day)));
}

const selectCls = "rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white";

export default function AdminActivityPage() {
  const [event, setEvent] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [severity, setSeverity] = useState<"" | "high" | "normal">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminActivityItem | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (event) params.set("event", event);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (severity) params.set("severity", severity);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity", event, from, to, severity, page],
    queryFn: () => api.get<{ items: AdminActivityItem[]; pagination: { page: number; totalPages: number; total: number } }>(`/api/admin/activity?${params.toString()}`),
  });

  const { data: securityData, isLoading: securityLoading } = useQuery({
    queryKey: ["admin-security-summary"],
    queryFn: () => api.get<SecuritySummary>("/api/admin/security/summary"),
  });

  // Severity filtering is applied server-side (GET /api/admin/activity `severity` param) so
  // pagination stays correct — severityOf() below is only used for the row badge, not filtering.
  const items = data?.items ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;
  const securityTrend = securityData ? pivotTrend(securityData.trend) : [];
  const securityEvents = Object.keys(SECURITY_EVENT_META);

  return (
    <>
      <Topbar title="Activity & Audit Logs" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={History} title="Activity & Audit Logs" description="Account-security signals and every account-change event across the platform." />

        {securityLoading || !securityData ? (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              {securityEvents.map((e) => {
                const meta = SECURITY_EVENT_META[e];
                return <StatCard key={e} label={`${meta.label} (30d)`} value={securityData.counts[e] ?? 0} icon={meta.icon} tone={meta.tone} />;
              })}
            </div>
            <Card className="mb-6">
              <CardHeader><CardTitle>Security Events (30 days)</CardTitle></CardHeader>
              <CardContent>
                {securityTrend.length === 0 ? (
                  <EmptyState icon={ShieldCheck} title="No security events" description="Nothing to show for the last 30 days — that's a good sign." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={securityTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--foreground)" strokeOpacity={0.1} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} width={30} />
                      <Tooltip />
                      <Legend wrapperStyle={{ color: "var(--foreground)", fontSize: 12, opacity: 0.8 }} />
                      {["login_failed", "password_changed", "uid_changed", "2fa_enabled", "2fa_disabled"].map((e) => (
                        <Line key={e} type="monotone" dataKey={e} name={SECURITY_EVENT_META[e].label} stroke={SECURITY_EVENT_META[e].color} strokeWidth={2} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}

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
              <div>
                <label className="mb-1 block text-xs font-medium text-navy/50 dark:text-white/50">Severity</label>
                <select value={severity} onChange={(e) => { setSeverity(e.target.value as typeof severity); setPage(1); }} className={selectCls}>
                  <option value="">All Severities</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                </select>
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
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                        <th className="sticky left-0 bg-white pb-2 pr-3 font-medium dark:bg-navy-dark">Event</th>
                        <th className="pb-2 pr-3 font-medium">User</th>
                        <th className="pb-2 pr-3 font-medium">Time</th>
                        <th className="pb-2 font-medium">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((a) => {
                        const meta = EVENT_META[a.event] ?? { label: a.event, icon: ActivityIcon, tone: "navy" };
                        const color = TONE_COLOR[meta.tone];
                        const sev = severityOf(a.event);
                        return (
                          <tr
                            key={a.id}
                            onClick={() => setSelected(a)}
                            className="cursor-pointer border-b border-black/5 transition-colors hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
                          >
                            <td className="sticky left-0 bg-white py-2 pr-3 dark:bg-navy-dark">
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
                                  <meta.icon className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <span className="font-medium text-navy dark:text-white">{meta.label}</span>
                                  {sev === "high" && <span className="ml-1.5 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-500">High</span>}
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

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div
            className="h-full w-full max-w-sm overflow-y-auto border-l border-black/10 bg-white p-5 dark:border-white/10 dark:bg-navy-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-navy dark:text-white">Event Detail</p>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ["Event", EVENT_META[selected.event]?.label ?? selected.event],
                ["Severity", severityOf(selected.event)],
                ["Detail", selected.detail ?? "—"],
                ["Actor / Target", selected.user ? `${selected.user.name} (${selected.user.email}) · UID ${selected.user.uid}` : "—"],
                ["Timestamp", new Date(selected.createdAt).toLocaleString()],
                ["IP Address", selected.ip ?? "—"],
                ["Browser", selected.browser ?? "—"],
                ["OS", selected.os ?? "—"],
                ["Device", selected.device ?? "—"],
                ["User Agent", selected.userAgent ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-medium uppercase tracking-wider text-navy/40 dark:text-white/40">{label}</p>
                  <p className="break-words text-navy/80 dark:text-white/80">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
