"use client";

import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, HardDrive, Mail, ShieldAlert, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { Alert, Badge, EmptyState, ErrorState, PageHeader, Panel, Skeleton, Stat } from "@/components/admin/ui";
import { eventLabel, isHighSeverity } from "@/lib/adminEvents";
import { fillDays, MigrationState, useAdminStats } from "@/lib/adminHooks";
import { fmtDateTime, fmtDay, fmtNumber, fmtRelative, fmtUptime } from "@/lib/adminFormat";

const MIGRATION_ROWS: { key: MigrationState; label: string; tone: "green" | "amber" | "red" | "blue" | "" }[] = [
  { key: "MIGRATION_COMPLETED", label: "Completed", tone: "green" },
  { key: "MIGRATION_IN_PROGRESS", label: "In progress", tone: "blue" },
  { key: "MIGRATION_REQUIRED", label: "Migration required", tone: "amber" },
  { key: "DRIVE_SETUP_REQUIRED", label: "Drive setup needed", tone: "amber" },
  { key: "MIGRATION_FAILED", label: "Failed", tone: "red" },
  { key: "NEW_USER", label: "New users", tone: "" },
];

function Trend({ data, name }: { data: { day: string; count: number }[]; name: string }) {
  const id = `g-${name.replace(/\W/g, "")}`;
  return (
    <div role="img" aria-label={`${name}: ${data.reduce((a, b) => a + b.count, 0)} in the last 30 days`}>
      <ResponsiveContainer width="100%" height={210}>
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ad-accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--ad-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--ad-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tickFormatter={fmtDay} interval="preserveStartEnd" minTickGap={28} tick={{ fontSize: 11, fill: "var(--ad-faint)" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--ad-faint)" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip labelFormatter={(d) => fmtDay(String(d))} formatter={(v) => [fmtNumber(Number(v)), name]}
            contentStyle={{ background: "var(--ad-surface-2)", border: "1px solid var(--ad-border-strong)", borderRadius: 8, fontSize: 12, color: "var(--ad-text)" }} />
          <Area type="monotone" dataKey="count" stroke="var(--ad-accent)" strokeWidth={2} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useAdminStats();

  if (isError) return <><PageHeader title="Dashboard" /><ErrorState onRetry={() => void refetch()} message="The dashboard numbers could not be loaded." /></>;

  const needsAttention = data ? data.migrationSummary.MIGRATION_REQUIRED + data.migrationSummary.MIGRATION_FAILED : 0;
  const healthy = data?.systemHealth.database.status === "ok";

  return (
    <>
      <PageHeader title="Dashboard" description="Live platform status. All times are IST." />

      {data && (needsAttention > 0 || data.emailFailureCount > 0 || !healthy) && (
        <div className="mb-4 grid gap-2">
          {!healthy && <Alert tone="error" title="Database check failed">The platform may be degraded. See <Link className="underline" href="/admin/system-health">Health &amp; Integrations</Link>.</Alert>}
          {needsAttention > 0 && <Alert tone="warn">{needsAttention} account{needsAttention === 1 ? " needs" : "s need"} migration attention. <Link className="underline" href="/admin/migration">Open Migration</Link></Alert>}
          {data.emailFailureCount > 0 && <Alert tone="warn">{data.emailFailureCount} automated email{data.emailFailureCount === 1 ? "" : "s"} failed to send in the last 30 days. <Link className="underline" href="/admin/automated-emails">Review Email Automations</Link></Alert>}
        </div>
      )}

      <div className="ad-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {isLoading || !data ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={92} className="rounded-xl" />) : (
          <>
            <Stat label="Users" icon={Users} value={fmtNumber(data.users.total)} hint={`Verified accounts · ${data.users.explorers} explorer${data.users.explorers === 1 ? "" : "s"} not counted`} href="/admin/users?verification=verified" />
            <Stat label="Active" icon={UserCheck} tone="green" value={fmtNumber(data.users.active)} href="/admin/users?status=ACTIVE" />
            <Stat label="Suspended" icon={UserX} tone={data.users.suspended ? "red" : undefined} value={fmtNumber(data.users.suspended)} href="/admin/users?status=SUSPENDED" />
            <Stat label="New sign-ups today" icon={UserPlus} value={fmtNumber(data.signups.today)} hint={`${data.signups.week} this week · ${data.signups.month} this month`} />
            <Stat label="Google Drive connected" icon={HardDrive} tone="accent" value={fmtNumber(data.driveConnectedCount)} href="/admin/migration" />
            <Stat label="Errors (30 days)" icon={AlertTriangle} tone={data.errorActivityCount ? "amber" : "green"} value={fmtNumber(data.errorActivityCount)} hint="Failed actions, excluding email" href="/admin/activity?severity=high" />
            <Stat label="Email failures (30 days)" icon={Mail} tone={data.emailFailureCount ? "amber" : "green"} value={fmtNumber(data.emailFailureCount)} href="/admin/automated-emails" />
            <Stat label="Admins" icon={ShieldAlert} value={fmtNumber(data.users.admins + data.users.superAdmins)} hint={`${data.users.superAdmins} super admin${data.users.superAdmins === 1 ? "" : "s"}`} />
          </>
        )}
      </div>

      <div className="ad-grid mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
        <Panel title="Sign-ups, last 30 days">
          {data ? <Trend data={fillDays(data.signupTrend)} name="Sign-ups" /> : <Skeleton h={210} />}
        </Panel>
        <Panel title="Account activity, last 30 days">
          {data ? <Trend data={fillDays(data.userActivityTrend)} name="Activity" /> : <Skeleton h={210} />}
        </Panel>

        <Panel title="Google Drive migration" actions={<Link href="/admin/migration" className="ad-btn sm">Open</Link>}>
          {data ? (
            <ul className="m-0 list-none p-0">
              {MIGRATION_ROWS.map((r) => (
                <li key={r.key} className="ad-row" style={{ padding: "9px 0" }}>
                  <span className="flex-1">{r.label}</span>
                  <Badge tone={r.tone}>{fmtNumber(data.migrationSummary[r.key])}</Badge>
                </li>
              ))}
            </ul>
          ) : <Skeleton h={200} />}
        </Panel>

        <Panel title="Recent failed sign-ins" actions={<Link href="/admin/activity?event=login_failed" className="ad-btn sm">View all</Link>}>
          {!data ? <Skeleton h={200} /> : data.recentFailedAuth.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No failed sign-ins" />
          ) : (
            <ul className="m-0 list-none p-0">
              {data.recentFailedAuth.slice(0, 6).map((a) => (
                <li key={a.id} className="ad-row" style={{ padding: "9px 0" }}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{a.user?.name ?? "Unknown account"}</div>
                    <div className="ad-faint truncate text-xs">{a.user?.email}</div>
                  </div>
                  <span className="ad-faint shrink-0 text-xs" title={fmtDateTime(a.createdAt)}>{fmtRelative(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent admin actions" className="lg:col-span-2" actions={<Link href="/admin/activity" className="ad-btn sm">Audit log</Link>}>
          {!data ? <Skeleton h={200} /> : data.recentActivity.length === 0 ? (
            <EmptyState icon={Activity} title="No recent admin actions" />
          ) : (
            <ul className="m-0 list-none p-0">
              {data.recentActivity.slice(0, 8).map((a) => (
                <li key={a.id} className="ad-row" style={{ padding: "9px 0" }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-medium">{eventLabel(a.event)}</span>{isHighSeverity(a.event) && <Badge tone="red">High</Badge>}</div>
                    <div className="ad-faint truncate text-xs">{a.detail ?? a.user?.email ?? ""}</div>
                  </div>
                  <span className="ad-faint shrink-0 text-xs" title={fmtDateTime(a.createdAt)}>{fmtRelative(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {data && (
        <p className="ad-faint mt-4 text-xs">
          Database {healthy ? "healthy" : "issue"}{data.systemHealth.database.latencyMs != null ? ` (${data.systemHealth.database.latencyMs} ms)` : ""} · Email {data.systemHealth.email.status} · Drive API {data.systemHealth.driveApi.status} · Uptime {fmtUptime(data.systemHealth.uptimeSeconds)}
        </p>
      )}
    </>
  );
}
