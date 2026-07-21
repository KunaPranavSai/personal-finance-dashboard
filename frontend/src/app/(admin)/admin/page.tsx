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
  LayoutDashboard, Users, UserCheck, Clock, UserX, Wallet, ArrowLeftRight, PiggyBank, Target,
  TrendingUp, Receipt, Activity as ActivityIcon, ArrowRight,
} from "lucide-react";

interface AdminStats {
  users: { total: number; active: number; pending: number; suspended: number };
  signups: { today: number; week: number; month: number };
  records: { accounts: number; transactions: number; budgets: number; goals: number; investments: number; bills: number; categories: number };
  signupTrend: { day: string; count: number }[];
  recentActivity: { id: string; event: string; detail: string | null; createdAt: string; user: { name: string; email: string } | null }[];
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

  return (
    <>
      <Topbar title="Admin Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader
          icon={LayoutDashboard}
          title="Platform Overview"
          description="High-level stats across every account on Penny Pilot."
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

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-6">
              <StatCard label="Accounts" value={data.records.accounts} icon={Wallet} tone="navy" />
              <StatCard label="Transactions" value={data.records.transactions} icon={ArrowLeftRight} tone="navy" />
              <StatCard label="Budgets" value={data.records.budgets} icon={PiggyBank} tone="navy" />
              <StatCard label="Goals" value={data.records.goals} icon={Target} tone="navy" />
              <StatCard label="Investments" value={data.records.investments} icon={TrendingUp} tone="navy" />
              <StatCard label="Bills" value={data.records.bills} icon={Receipt} tone="navy" />
            </div>

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
