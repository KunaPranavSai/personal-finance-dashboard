"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { AlertTriangle, KeyRound, IdCard, ShieldCheck, ShieldOff, Mail, ArrowRight } from "lucide-react";

interface SecuritySummary {
  counts: Record<string, number>;
  trend: { day: string; event: string; count: number }[];
}

const EVENT_META: Record<string, { label: string; icon: typeof AlertTriangle; tone: string; color: string }> = {
  login_failed: { label: "Failed Logins", icon: AlertTriangle, tone: "bg-red-500/10 text-red-500", color: "#C0392B" },
  password_changed: { label: "Password Changes", icon: KeyRound, tone: "bg-teal/10 text-teal", color: "#0EA5A5" },
  password_reset: { label: "Password Resets", icon: KeyRound, tone: "bg-amber-500/10 text-amber-600", color: "#F1C40F" },
  uid_changed: { label: "UID Changes", icon: IdCard, tone: "bg-blue-500/10 text-blue-600", color: "#2471A3" },
  "2fa_enabled": { label: "2FA Enabled", icon: ShieldCheck, tone: "bg-emerald-500/10 text-emerald-600", color: "#1E8449" },
  "2fa_disabled": { label: "2FA Disabled", icon: ShieldOff, tone: "bg-red-500/10 text-red-500", color: "#7D3C98" },
  password_reset_requested: { label: "Reset Requests", icon: Mail, tone: "bg-navy/10 text-navy/70 dark:bg-white/10 dark:text-white/70", color: "#1F2A44" },
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
        {isLoading || !data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              {events.map((e) => {
                const meta = EVENT_META[e];
                return (
                  <Card key={e}>
                    <CardContent className="flex items-center gap-3 pt-5">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.tone}`}>
                        <meta.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs text-navy/50 dark:text-white/50">{meta.label} (30d)</p>
                        <p className="text-lg font-bold text-navy dark:text-white">{data.counts[e] ?? 0}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="mt-6">
              <CardHeader><CardTitle>Security Events (30 days)</CardTitle></CardHeader>
              <CardContent>
                {trendData.length === 0 ? (
                  <p className="py-10 text-center text-sm text-navy/50 dark:text-white/50">No security events in the last 30 days.</p>
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
