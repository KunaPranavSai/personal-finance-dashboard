"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { AlertTriangle, KeyRound, IdCard, ShieldCheck, ShieldOff, Mail, ArrowRight, ShieldAlert } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard, StatCardSkeleton } from "@/components/admin/StatCard";

interface SecuritySummary {
  counts: Record<string, number>;
  trend: { day: string; event: string; count: number }[];
}

const EVENT_META: Record<string, { label: string; icon: typeof AlertTriangle; tone: "teal" | "amber" | "red" | "emerald" | "navy"; color: string }> = {
  login_failed: { label: "Failed Logins", icon: AlertTriangle, tone: "red", color: "#C0392B" },
  password_changed: { label: "Password Changes", icon: KeyRound, tone: "teal", color: "#0EA5A5" },
  password_reset: { label: "Password Resets", icon: KeyRound, tone: "amber", color: "#F1C40F" },
  uid_changed: { label: "UID Changes", icon: IdCard, tone: "navy", color: "#2471A3" },
  "2fa_enabled": { label: "2FA Enabled", icon: ShieldCheck, tone: "emerald", color: "#1E8449" },
  "2fa_disabled": { label: "2FA Disabled", icon: ShieldOff, tone: "red", color: "#7D3C98" },
  password_reset_requested: { label: "Reset Requests", icon: Mail, tone: "navy", color: "#1F2A44" },
};

// Reshape the flat {day,event,count}[] into one row per day with a column per event, for the trend chart.
function pivotTrend(trend: SecuritySummary["trend"]): Record<string, string | number>[] {
  const days = new Map<string, Record<string, string | number>>();
  for (const row of trend) {
    const existing = days.get(row.day) ?? { day: row.day };
    existing[row.event] = row.count;
    days.set(row.day, existing);
  }
  return Array.from(days.values()).sort((a, b) => String(a.day).localeCompare(String(b.day)));
}

export default function AdminSecurityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-security-summary"],
    queryFn: () => api.get<SecuritySummary>("/api/admin/security/summary"),
  });

  const trendData = data ? pivotTrend(data.trend) : [];
  const events = Object.keys(EVENT_META);

  return (
    <>
      <Topbar title="Security Center" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={ShieldAlert} title="Security Center" description="Account-security signals across every user, last 30 days." />
        {isLoading || !data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              {events.map((e) => {
                const meta = EVENT_META[e];
                return <StatCard key={e} label={`${meta.label} (30d)`} value={data.counts[e] ?? 0} icon={meta.icon} tone={meta.tone} />;
              })}
            </div>

            <Card className="mt-6">
              <CardHeader><CardTitle>Security Events (30 days)</CardTitle></CardHeader>
              <CardContent>
                {trendData.length === 0 ? (
                  <EmptyState icon={ShieldCheck} title="No security events" description="Nothing to show for the last 30 days — that's a good sign." />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--foreground)" strokeOpacity={0.1} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} width={30} />
                      <Tooltip />
                      <Legend wrapperStyle={{ color: "var(--foreground)", fontSize: 12, opacity: 0.8 }} />
                      {["login_failed", "password_changed", "uid_changed", "2fa_enabled", "2fa_disabled"].map((e) => (
                        <Line key={e} type="monotone" dataKey={e} name={EVENT_META[e].label} stroke={EVENT_META[e].color} strokeWidth={2} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-navy/60 dark:text-white/60">
                  Force logout, lock/unlock, or reset a specific user&apos;s password/UID from their row menu in{" "}
                  <Link href="/admin/users" className="inline-flex items-center gap-1 font-medium text-teal hover:underline">
                    All Users <ArrowRight className="h-3.5 w-3.5" />
                  </Link>.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
