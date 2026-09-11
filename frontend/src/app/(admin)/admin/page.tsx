"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard, StatCardSkeleton } from "@/components/admin/StatCard";
import { Timeline, TimelineEvent } from "@/components/admin/Timeline";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Users, UserCheck, Clock, UserX,
  Activity as ActivityIcon, ArrowRight, HardDrive, AlertTriangle, RefreshCw,
} from "lucide-react";

interface AdminStats {
  users: { total: number; active: number; pending: number; suspended: number };
  signups: { today: number; week: number; month: number };
  signupTrend: { day: string; count: number }[];
  recentActivity: { id: string; event: string; detail: string | null; createdAt: string; user: { name: string; email: string } | null }[];
  migrationSummary: {
    NEW_USER: number;
    DRIVE_SETUP_REQUIRED: number;
    MIGRATION_REQUIRED: number;
    MIGRATION_IN_PROGRESS: number;
    MIGRATION_COMPLETED: number;
    MIGRATION_FAILED: number;
  };
  systemHealth: { database: string; uptimeSeconds: number };
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/api/admin/stats"),
  });

  const timelineItems: TimelineEvent[] = (data?.recentActivity ?? []).map((a) => ({
    id: a.id, event: a.event, detail: a.detail, createdAt: a.createdAt,
    actorLabel: a.user ? `${a.user.name} (${a.user.email})` : null,
  }));

  const needsAttention = (data?.migrationSummary.MIGRATION_REQUIRED ?? 0) + (data?.migrationSummary.MIGRATION_FAILED ?? 0);

  return (
    <>
      <Topbar title="Admin Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader
          icon={LayoutDashboard}
          title="Platform Overview"
          description="Operational status across every account on Penny Pilot."
        />

        {isLoading || !data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <StatCard label="Total Users" value={data.users.total} icon={Users} />
              <StatCard label="Active Users" value={data.users.active} icon={UserCheck} tone="emerald" />
              <StatCard label="Pending Approvals" value={data.users.pending} icon={Clock} tone="amber" />
              <StatCard label="Suspended Users" value={data.users.suspended} icon={UserX} tone="red" />
              <StatCard label="New Signups (Today)" value={data.signups.today} icon={Users} />
              <StatCard label="New Signups (Week)" value={data.signups.week} icon={Users} />
              <StatCard label="New Signups (Month)" value={data.signups.month} icon={Users} />
              <StatCard label="System Health" value={data.systemHealth.database === "ok" ? "Healthy" : "Issue"} icon={ActivityIcon} tone={data.systemHealth.database === "ok" ? "emerald" : "red"} />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy/70 dark:text-white/70">Google Drive Migration</h2>
              <Link href="/admin/migration" className="flex items-center gap-1 text-xs font-medium text-teal hover:underline">
                View details <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <StatCard label="Migration Required" value={data.migrationSummary.MIGRATION_REQUIRED} icon={HardDrive} tone="amber" />
              <StatCard label="In Progress" value={data.migrationSummary.MIGRATION_IN_PROGRESS} icon={RefreshCw} tone="navy" />
              <StatCard label="Migration Failed" value={data.migrationSummary.MIGRATION_FAILED} icon={AlertTriangle} tone="red" />
              <StatCard label="Migration Completed" value={data.migrationSummary.MIGRATION_COMPLETED} icon={UserCheck} tone="emerald" />
            </div>
            {needsAttention > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {needsAttention} account{needsAttention === 1 ? "" : "s"} need{needsAttention === 1 ? "s" : ""} attention — see{" "}
                <Link href="/admin/migration" className="font-medium underline">Migration Status</Link>.
              </p>
            )}

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Signup Trend (30 days)</CardTitle></CardHeader>
                <CardContent>
                  {data.signupTrend.length === 0 ? (
                    <EmptyState icon={Users} title="No signups yet" description="New registrations will show up here as they come in." />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={data.signupTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--foreground)" strokeOpacity={0.1} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} width={30} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#0EA5A5" strokeWidth={2} dot={false} name="Signups" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Recent Activity</CardTitle>
                  <Link href="/admin/activity" className="flex items-center gap-1 text-xs font-medium text-teal hover:underline">
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardHeader>
                <CardContent>
                  {timelineItems.length === 0 ? (
                    <EmptyState icon={ActivityIcon} title="No recent activity" />
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <Timeline items={timelineItems} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </>
  );
}
