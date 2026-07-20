"use client";

import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import {
  Users, UserCheck, Clock, UserX, Wallet, ArrowLeftRight, PiggyBank, Target,
  TrendingUp, Receipt, Tag, Activity as ActivityIcon,
} from "lucide-react";

interface AdminStats {
  users: { total: number; active: number; pending: number; suspended: number };
  signups: { today: number; week: number; month: number };
  records: { accounts: number; transactions: number; budgets: number; goals: number; investments: number; bills: number; categories: number };
  signupTrend: { day: string; count: number }[];
  recentActivity: { id: string; event: string; detail: string | null; createdAt: string; user: { name: string; email: string } | null }[];
  systemHealth: { database: string; uptimeSeconds: number };
}

const EVENT_LABELS: Record<string, string> = {
  user_approved: "User approved",
  user_rejected: "User rejected",
  user_updated: "User updated",
  user_deleted: "User deleted",
  user_created: "User created",
  password_reset_by_admin: "Password reset by admin",
  uid_reset_by_admin: "UID reset by admin",
  force_logout_by_admin: "Forced logout",
  signup_requested: "New signup",
};

function StatCard({ label, value, icon: Icon, tone = "teal" }: { label: string; value: number | string; icon: typeof Users; tone?: "teal" | "amber" | "red" | "emerald" }) {
  const toneClasses: Record<string, string> = {
    teal: "bg-teal/10 text-teal",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    red: "bg-red-500/10 text-red-500",
    emerald: "bg-emerald-500/10 text-emerald-600",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-navy/50 dark:text-white/50">{label}</p>
          <p className="text-lg font-bold text-navy dark:text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/api/admin/stats"),
  });

  return (
    <>
      <Topbar title="Admin Dashboard" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {isLoading || !data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}
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
              <StatCard label="Accounts" value={data.records.accounts} icon={Wallet} />
              <StatCard label="Transactions" value={data.records.transactions} icon={ArrowLeftRight} />
              <StatCard label="Budgets" value={data.records.budgets} icon={PiggyBank} />
              <StatCard label="Goals" value={data.records.goals} icon={Target} />
              <StatCard label="Investments" value={data.records.investments} icon={TrendingUp} />
              <StatCard label="Bills" value={data.records.bills} icon={Receipt} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Signup Trend (30 days)</CardTitle></CardHeader>
                <CardContent>
                  {data.signupTrend.length === 0 ? (
                    <p className="py-10 text-center text-sm text-navy/50 dark:text-white/50">No signups in the last 30 days.</p>
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
                <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
                <CardContent>
                  {data.recentActivity.length === 0 ? (
                    <p className="py-10 text-center text-sm text-navy/50 dark:text-white/50">No recent admin activity.</p>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                      {data.recentActivity.map((a) => (
                        <div key={a.id} className="border-b border-black/5 pb-2 last:border-0 dark:border-white/5">
                          <p className="text-sm font-medium text-navy dark:text-white">{EVENT_LABELS[a.event] ?? a.event}</p>
                          {a.user && <p className="text-xs text-navy/50 dark:text-white/50">{a.user.name} ({a.user.email})</p>}
                          {a.detail && <p className="text-xs text-navy/40 dark:text-white/40">{a.detail}</p>}
                          <p className="text-[11px] text-navy/30 dark:text-white/30">{new Date(a.createdAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Categories" value={data.records.categories} icon={Tag} />
            </div>
          </>
        )}
      </main>
    </>
  );
}
