"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Topbar } from "@/components/layout/Topbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard, StatCardSkeleton } from "@/components/admin/StatCard";
import { Timeline, TimelineEvent } from "@/components/admin/Timeline";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Users, UserCheck, Clock, UserX,
  Activity as ActivityIcon, ArrowRight, HardDrive, AlertTriangle, RefreshCw, ShieldAlert, Crown,
} from "lucide-react";

interface AdminStats {
  users: { total: number; active: number; pending: number; suspended: number; admins: number; superAdmins: number };
  signups: { today: number; week: number; month: number };
  signupTrend: { day: string; count: number }[];
  userActivityTrend: { day: string; count: number }[];
  errorActivityCount: number;
  recentFailedAuth: { id: string; detail: string | null; createdAt: string; user: { name: string; email: string } | null }[];
  recentActivity: { id: string; event: string; detail: string | null; createdAt: string; user: { name: string; email: string } | null }[];
  migrationSummary: {
    NEW_USER: number;
    DRIVE_SETUP_REQUIRED: number;
    MIGRATION_REQUIRED: number;
    MIGRATION_IN_PROGRESS: number;
    MIGRATION_COMPLETED: number;
    MIGRATION_FAILED: number;
  };
  driveConnectedCount: number;
  systemHealth: {
    database: { status: string; latencyMs: number | null };
    email: { status: string };
    driveApi: { status: string };
    uptimeSeconds: number;
  };
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
              <StatCard label="System Health" value={data.systemHealth.database.status === "ok" ? "Healthy" : "Issue"} icon={ActivityIcon} tone={data.systemHealth.database.status === "ok" ? "emerald" : "red"} />
              <StatCard label="Drive Connected" value={data.driveConnectedCount} icon={HardDrive} tone="teal" />
              <StatCard label="Error Events (30d)" value={data.errorActivityCount} icon={AlertTriangle} tone={data.errorActivityCount > 0 ? "amber" : "emerald"} />
              <StatCard label="Admins" value={data.users.admins} icon={ShieldAlert} tone="navy" />
              <StatCard label="Super Admins" value={data.users.superAdmins} icon={Crown} tone="navy" />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h2 className="cc-mono text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Google Drive Migration</h2>
              <Link href="/admin/migration" className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--cc-accent)" }}>
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

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="cc-panel p-4">
                <p className="cc-mono mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Signup Trend (30 days)</p>
                {data.signupTrend.length === 0 ? (
                  <EmptyState icon={Users} title="No signups yet" description="New registrations will show up here as they come in." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.signupTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--cc-border)" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--cc-text-faint)" }} axisLine={{ stroke: "var(--cc-border)" }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--cc-text-faint)" }} axisLine={{ stroke: "var(--cc-border)" }} tickLine={false} width={30} />
                      <Tooltip contentStyle={{ background: "var(--cc-panel-alt)", border: "1px solid var(--cc-border)", fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" stroke="#2fe6e0" strokeWidth={2} dot={false} name="Signups" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="cc-panel p-4">
                <p className="cc-mono mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>User Activity (30 days)</p>
                {data.userActivityTrend.length === 0 ? (
                  <EmptyState icon={ActivityIcon} title="No activity yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.userActivityTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--cc-border)" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--cc-text-faint)" }} axisLine={{ stroke: "var(--cc-border)" }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--cc-text-faint)" }} axisLine={{ stroke: "var(--cc-border)" }} tickLine={false} width={30} />
                      <Tooltip contentStyle={{ background: "var(--cc-panel-alt)", border: "1px solid var(--cc-border)", fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2} dot={false} name="Activity" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="cc-panel p-4">
                <p className="cc-mono mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Recent Failed Auth</p>
                {data.recentFailedAuth.length === 0 ? (
                  <EmptyState icon={ShieldAlert} title="No failed logins" />
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {data.recentFailedAuth.map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-xs">
                        <span className="text-navy/70 dark:text-white/70">{a.user ? `${a.user.name} (${a.user.email})` : "Unknown account"}</span>
                        <span className="text-navy/40 dark:text-white/40">{new Date(a.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="cc-panel p-4 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <p className="cc-mono text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Recent Admin Actions</p>
                  <Link href="/admin/activity" className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--cc-accent)" }}>
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {timelineItems.length === 0 ? (
                  <EmptyState icon={ActivityIcon} title="No recent activity" />
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    <Timeline items={timelineItems} />
                  </div>
                )}
              </div>
            </div>

            <p className="cc-mono mt-4 text-[10px]" style={{ color: "var(--cc-text-faint)" }}>
              Email: {data.systemHealth.email.status} · Drive API: {data.systemHealth.driveApi.status} · DB latency: {data.systemHealth.database.latencyMs ?? "—"}ms
            </p>
          </>
        )}
      </main>
    </>
  );
}
