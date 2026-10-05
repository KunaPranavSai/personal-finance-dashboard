"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { History, KeyRound, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { AdminExportMenu } from "@/components/admin/AdminExportMenu";
import { Badge, Column, DataTable, EmptyState, Modal, PageHeader, Pagination, Panel, SelectField, Skeleton, Stat, TextField } from "@/components/admin/ui";
import { eventLabel, EVENT_OPTIONS, isHighSeverity } from "@/lib/adminEvents";
import { fillDays } from "@/lib/adminHooks";
import { fmtDateTime, fmtDay } from "@/lib/adminFormat";
import { api } from "@/lib/api";

interface Item {
  id: string; event: string; detail: string | null; createdAt: string; ip: string | null; userAgent: string | null; browser: string | null; os: string | null; device: string | null;
  user: { name: string; email: string; uid: string } | null;
}
interface Summary { counts: Record<string, number>; trend: { day: string; event: string; count: number }[] }

const SERIES = [
  { event: "login_failed", label: "Failed sign-ins", color: "var(--ad-red)" },
  { event: "password_changed", label: "Password changes", color: "var(--ad-accent)" },
  { event: "uid_changed", label: "User ID changes", color: "var(--ad-blue)" },
  { event: "2fa_enabled", label: "Two-factor enabled", color: "var(--ad-green)" },
  { event: "2fa_disabled", label: "Two-factor disabled", color: "var(--ad-amber)" },
];

function Audit() {
  const params = useSearchParams();
  const [event, setEvent] = useState(params.get("event") ?? "");
  const [severity, setSeverity] = useState(params.get("severity") ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Item | null>(null);
  useEffect(() => setPage(1), [event, severity, from, to]);

  const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (event) qs.set("event", event);
  if (severity) qs.set("severity", severity);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const list = useQuery({
    queryKey: ["admin", "audit", qs.toString()],
    queryFn: () => api.get<{ items: Item[]; pagination: { total: number } }>(`/api/admin/activity?${qs}`),
    placeholderData: (p) => p,
  });
  const summary = useQuery({ queryKey: ["admin", "security-summary"], queryFn: () => api.get<Summary>("/api/admin/security/summary") });

  const chart = (() => {
    if (!summary.data) return [];
    const base = fillDays([]).map((d) => ({ day: d.day } as Record<string, string | number>));
    const idx = new Map(base.map((r) => [r.day as string, r]));
    for (const t of summary.data.trend) { const row = idx.get(t.day); if (row) row[t.event] = t.count; }
    return base;
  })();
  const hasTrend = (summary.data?.trend.length ?? 0) > 0;

  const columns: Column<Item>[] = [
    { key: "event", header: "Event", primary: true, render: (a) => (
      <div><span className="font-semibold">{eventLabel(a.event)}</span>{isHighSeverity(a.event) && <> <Badge tone="red">High</Badge></>}
        {a.detail && <div className="ad-faint text-xs">{a.detail}</div>}</div>
    ) },
    { key: "user", header: "Account", render: (a) => (a.user ? <div><div>{a.user.name}</div><div className="ad-faint text-xs">{a.user.email}</div></div> : <span className="ad-faint">System</span>) },
    { key: "time", header: "When (IST)", render: (a) => fmtDateTime(a.createdAt) },
    { key: "ip", header: "IP address", render: (a) => a.ip ?? "—" },
  ];
  const filtered = Boolean(event || severity || from || to);

  return (
    <>
      <PageHeader title="Security & Audit" description="Sign-in and account-security signals, plus an audit trail of every account change. Times are IST." actions={<AdminExportMenu type="audit" from={from || undefined} to={to || undefined} />} />

      <div className="ad-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {summary.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={88} className="rounded-xl" />) : (
          <>
            <Stat label="Failed sign-ins (30 days)" icon={ShieldAlert} tone={(summary.data?.counts.login_failed ?? 0) > 0 ? "red" : "green"} value={summary.data?.counts.login_failed ?? 0} />
            <Stat label="Password changes" icon={KeyRound} value={(summary.data?.counts.password_changed ?? 0) + (summary.data?.counts.password_reset ?? 0)} hint="Changes and resets" />
            <Stat label="Two-factor enabled" icon={ShieldCheck} tone="green" value={summary.data?.counts["2fa_enabled"] ?? 0} />
            <Stat label="Two-factor disabled" icon={ShieldOff} tone={(summary.data?.counts["2fa_disabled"] ?? 0) > 0 ? "amber" : undefined} value={summary.data?.counts["2fa_disabled"] ?? 0} />
          </>
        )}
      </div>

      <Panel title="Security events, last 30 days" className="mt-4">
        {summary.isLoading ? <Skeleton h={240} /> : !hasTrend ? <EmptyState icon={ShieldCheck} title="No security events" description="Nothing in the last 30 days." /> : (
          <div role="img" aria-label="Line chart of security events per day for the last 30 days">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chart} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--ad-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickFormatter={fmtDay} interval="preserveStartEnd" minTickGap={28} tick={{ fontSize: 11, fill: "var(--ad-faint)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--ad-faint)" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip labelFormatter={(d) => fmtDay(String(d))} contentStyle={{ background: "var(--ad-surface-2)", border: "1px solid var(--ad-border-strong)", borderRadius: 8, fontSize: 12, color: "var(--ad-text)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {SERIES.map((s) => <Line key={s.event} type="monotone" dataKey={s.event} name={s.label} stroke={s.color} strokeWidth={2} dot={false} connectNulls />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel padded={false} className="mt-4">
        <div className="ad-panel-h"><h2>Audit log</h2></div>
        <div className="ad-toolbar" role="search">
          <div style={{ flex: "1 1 220px" }}><SelectField label="Event" hideLabel value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Filter by event"><option value="">All events</option>{EVENT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</SelectField></div>
          <div style={{ flex: "0 1 150px" }}><SelectField label="Severity" hideLabel value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Filter by severity"><option value="">All severities</option><option value="high">High</option><option value="normal">Normal</option></SelectField></div>
          <div style={{ flex: "0 1 160px" }}><TextField label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div style={{ flex: "0 1 160px" }}><TextField label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <DataTable<Item> caption="Audit log" columns={columns} rows={list.data?.items} rowKey={(a) => a.id} loading={list.isLoading || list.isFetching}
          error={list.isError ? "Couldn't load the audit log" : null} onRetry={() => void list.refetch()} onRowClick={setSelected}
          empty={<EmptyState icon={History} title={filtered ? "No events match these filters" : "No activity recorded yet"} description={filtered ? "Widen the date range or clear a filter." : undefined} />} />
        {list.data && list.data.pagination.total > 0 && <Pagination page={page} pageSize={25} total={list.data.pagination.total} onPage={setPage} noun="events" />}
      </Panel>

      <Modal open={selected !== null} onClose={() => setSelected(null)} variant="drawer" title="Event details">
        {selected && (
          <dl className="ad-kv">
            {([
              ["Event", eventLabel(selected.event)], ["Severity", isHighSeverity(selected.event) ? "High" : "Normal"], ["Detail", selected.detail],
              ["Account", selected.user ? `${selected.user.name} (${selected.user.email}) · UID ${selected.user.uid}` : "System"], ["When", fmtDateTime(selected.createdAt)],
              ["IP address", selected.ip], ["Browser", selected.browser], ["Operating system", selected.os], ["Device", selected.device], ["User agent", selected.userAgent],
            ] as [string, string | null][]).map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}
          </dl>
        )}
      </Modal>
    </>
  );
}

export default function AdminSecurityPage() {
  return <Suspense fallback={null}><Audit /></Suspense>;
}
