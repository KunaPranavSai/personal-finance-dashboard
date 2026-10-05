"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, Search } from "lucide-react";
import { Button, Column, ConfirmDialog, DataTable, EmptyState, PageHeader, Pagination, Panel, SelectField, Skeleton, StatusBadge, TextField, useDebounced } from "@/components/admin/ui";
import { MigrationState, useAdminStats } from "@/lib/adminHooks";
import { fmtDateTime, fmtNumber } from "@/lib/adminFormat";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface Row {
  userId: string; name: string; email: string; uid: string; accountEmail: string | null; state: MigrationState;
  lastConnectAttemptAt: string | null; lastConnectError: string | null;
}
const STATES: { value: MigrationState; label: string }[] = [
  { value: "MIGRATION_REQUIRED", label: "Migration required" }, { value: "MIGRATION_IN_PROGRESS", label: "In progress" }, { value: "MIGRATION_FAILED", label: "Failed" },
  { value: "MIGRATION_COMPLETED", label: "Completed" }, { value: "DRIVE_SETUP_REQUIRED", label: "Drive setup needed" }, { value: "NEW_USER", label: "New users" },
];
// The same states the server accepts for a reminder email.
const NOTIFIABLE: MigrationState[] = ["MIGRATION_REQUIRED", "MIGRATION_FAILED", "MIGRATION_IN_PROGRESS"];

export default function AdminMigrationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const stats = useAdminStats();
  const [search, setSearch] = useState("");
  const [state, setState] = useState<MigrationState | "">("");
  const [page, setPage] = useState(1);
  const [remind, setRemind] = useState<Row | null>(null);
  const dq = useDebounced(search);
  useEffect(() => setPage(1), [dq, state]);

  const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (dq.trim()) qs.set("search", dq.trim());
  if (state) qs.set("state", state);
  const list = useQuery({
    queryKey: ["admin", "migration", qs.toString()],
    queryFn: () => api.get<{ items: Row[]; pagination: { total: number } }>(`/api/admin/migration/status?${qs}`),
    placeholderData: (p) => p,
  });

  const columns: Column<Row>[] = [
    { key: "user", header: "Account", primary: true, render: (r) => <div><Link href={`/admin/users/${r.userId}`} className="font-semibold hover:underline">{r.name}</Link><div className="ad-faint break-all text-xs">{r.email}</div></div> },
    { key: "state", header: "State", render: (r) => <StatusBadge kind="migration" value={r.state} /> },
    { key: "drive", header: "Drive account", render: (r) => r.accountEmail ?? "—" },
    { key: "attempt", header: "Last attempt", render: (r) => (r.lastConnectAttemptAt ? fmtDateTime(r.lastConnectAttemptAt) : "—") },
    { key: "error", header: "Last error", render: (r) => (r.lastConnectError ? <span style={{ color: "var(--ad-red)" }}>{r.lastConnectError}</span> : "—") },
    { key: "act", header: "Action", hideLabelOnCard: true, align: "right", render: (r) => NOTIFIABLE.includes(r.state) ? <Button size="sm" onClick={() => setRemind(r)}>Send reminder</Button> : null },
  ];
  const filtered = Boolean(dq.trim() || state);

  return (
    <>
      <PageHeader title="Migration" description="Google Drive connection and data-migration status for each account. This only reads account records; it never opens anyone's Drive." />
      <div className="ad-grid mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {!stats.data ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={72} className="rounded-xl" />) : STATES.map((s) => (
          <button key={s.value} type="button" onClick={() => setState(state === s.value ? "" : s.value)} aria-pressed={state === s.value}
            className="ad-panel ad-stat text-left" style={{ cursor: "pointer", borderColor: state === s.value ? "var(--ad-accent)" : undefined }}>
            <div className="l">{s.label}</div><div className="v" style={{ fontSize: 22 }}>{fmtNumber(stats.data!.migrationSummary[s.value])}</div>
          </button>
        ))}
      </div>
      <Panel padded={false}>
        <div className="ad-toolbar" role="search">
          <div className="relative" style={{ flex: "1 1 240px" }}>
            <Search size={16} className="ad-faint absolute left-3 top-[12px]" aria-hidden="true" />
            <TextField label="Search" hideLabel value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or UID" style={{ paddingLeft: 36 }} />
          </div>
          <div style={{ flex: "0 1 200px" }}><SelectField label="State" hideLabel aria-label="Filter by state" value={state} onChange={(e) => setState(e.target.value as MigrationState | "")}><option value="">All states</option>{STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</SelectField></div>
        </div>
        <DataTable<Row> caption="Migration status" columns={columns} rows={list.data?.items} rowKey={(r) => r.userId} loading={list.isLoading || list.isFetching}
          error={list.isError ? "Couldn't load migration status" : null} onRetry={() => void list.refetch()}
          empty={<EmptyState icon={HardDrive} title={filtered ? "No accounts match" : "No accounts yet"} description={filtered ? "Try another search or state." : undefined} />} />
        {list.data && list.data.pagination.total > 0 && <Pagination page={page} pageSize={25} total={list.data.pagination.total} onPage={setPage} noun="accounts" />}
      </Panel>
      <ConfirmDialog open={remind !== null} onClose={() => setRemind(null)} title="Send migration reminder" target={remind ? `${remind.name} (${remind.email})` : undefined} confirmLabel="Send reminder email"
        description="Emails this person a reminder to connect Google Drive. Uses the “Migration / Drive Setup Required” email, which must be switched on in Email Automations."
        onConfirm={async () => {
          const res = await api.post<{ emailSent: boolean }>(`/api/admin/users/${remind!.userId}/notify-migration`);
          if (!res.emailSent) throw new Error("The reminder was logged but the email was not sent. Check that the email is switched on and the sender is configured.");
          toast(`Reminder sent to ${remind!.email}`, "success");
          void queryClient.invalidateQueries({ queryKey: ["admin"] });
        }} />
    </>
  );
}
