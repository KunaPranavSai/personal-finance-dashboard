"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, Search, Mail, CheckCircle2, AlertTriangle, RefreshCw, UserPlus, ShieldQuestion } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { api, ApiClientError } from "@/lib/api";
import { cn } from "@/lib/format";

type MigrationState =
  | "NEW_USER"
  | "DRIVE_SETUP_REQUIRED"
  | "MIGRATION_REQUIRED"
  | "MIGRATION_IN_PROGRESS"
  | "MIGRATION_COMPLETED"
  | "MIGRATION_FAILED";

interface MigrationRow {
  userId: string;
  name: string;
  email: string;
  uid: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  accountEmail: string | null;
  state: MigrationState;
  lastConnectAttemptAt: string | null;
  lastConnectError: string | null;
}

const STATE_META: Record<MigrationState, { label: string; tone: string; icon: typeof HardDrive }> = {
  NEW_USER: { label: "New User", tone: "bg-navy/10 text-navy/70 dark:bg-white/10 dark:text-white/70", icon: UserPlus },
  DRIVE_SETUP_REQUIRED: { label: "Drive Setup Required", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: HardDrive },
  MIGRATION_REQUIRED: { label: "Migration Required", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: HardDrive },
  MIGRATION_IN_PROGRESS: { label: "In Progress", tone: "bg-teal/10 text-teal", icon: RefreshCw },
  MIGRATION_COMPLETED: { label: "Completed", tone: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
  MIGRATION_FAILED: { label: "Failed", tone: "bg-red-500/10 text-red-500", icon: AlertTriangle },
};

const STATE_FILTERS: { value: MigrationState | ""; label: string }[] = [
  { value: "", label: "All States" },
  { value: "MIGRATION_REQUIRED", label: "Migration Required" },
  { value: "MIGRATION_IN_PROGRESS", label: "In Progress" },
  { value: "MIGRATION_FAILED", label: "Failed" },
  { value: "MIGRATION_COMPLETED", label: "Completed" },
  { value: "DRIVE_SETUP_REQUIRED", label: "Drive Setup Required" },
  { value: "NEW_USER", label: "New User" },
];

const NOTIFIABLE: MigrationState[] = ["MIGRATION_REQUIRED", "MIGRATION_FAILED", "MIGRATION_IN_PROGRESS"];

function StateBadge({ state }: { state: MigrationState }) {
  const meta = STATE_META[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", meta.tone)}>
      <meta.icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export default function AdminMigrationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [state, setState] = useState<MigrationState | "">("");
  const [page, setPage] = useState(1);
  const [notifying, setNotifying] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (search) params.set("search", search);
  if (state) params.set("state", state);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-migration-status", search, state, page],
    queryFn: () => api.get<{ items: MigrationRow[]; pagination: { page: number; totalPages: number; total: number } }>(`/api/admin/migration/status?${params.toString()}`),
  });

  const items = data?.items ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  const handleNotify = async (row: MigrationRow) => {
    setNotifying(row.userId);
    try {
      const res = await api.post<{ ok: boolean; emailSent: boolean }>(`/api/admin/users/${row.userId}/notify-migration`);
      toast(res.emailSent ? `Reminder sent to ${row.email}` : "Reminder logged, but email delivery failed", res.emailSent ? "success" : "error");
      queryClient.invalidateQueries({ queryKey: ["admin-migration-status"] });
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to send reminder", "error");
    } finally {
      setNotifying(null);
    }
  };

  return (
    <>
      <Topbar title="Migration Status" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader
          icon={HardDrive}
          title="Migration Status"
          description="Google Drive connection and legacy-data migration status per account. Derived from account records only — this view never accesses any user's Drive contents."
        />

        <div className="cc-panel mb-4 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[220px] flex-1">
            <label className="cc-mono mb-1 block text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--cc-text-faint)" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Name, email, or UID"
                className="w-full rounded border bg-transparent py-2 pl-9 pr-3 text-sm"
                style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
              />
            </div>
          </div>
          <div>
            <label className="cc-mono mb-1 block text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>State</label>
            <select
              value={state}
              onChange={(e) => { setState(e.target.value as MigrationState | ""); setPage(1); }}
              className="rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
            >
              {STATE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>

        <div className="cc-panel p-4">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded bg-white/[0.03]" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={ShieldQuestion} title="No accounts found" description="Try a different search or state filter." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-faint)" }}>
                      <th className="sticky left-0 bg-[var(--cc-panel)] pb-2 pr-3 font-medium">Account</th>
                      <th className="pb-2 pr-3 font-medium">State</th>
                      <th className="pb-2 pr-3 font-medium">Drive Account</th>
                      <th className="pb-2 pr-3 font-medium">Last Attempt</th>
                      <th className="pb-2 pr-3 font-medium">Error</th>
                      <th className="pb-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.userId} className="border-b align-top transition-colors hover:bg-white/[0.03]" style={{ borderColor: "var(--cc-border)" }}>
                        <td className="sticky left-0 bg-[var(--cc-panel)] py-3 pr-3">
                          <p className="font-medium" style={{ color: "var(--cc-text)" }}>{row.name}</p>
                          <p className="text-xs" style={{ color: "var(--cc-text-faint)" }}>{row.email}</p>
                        </td>
                        <td className="py-3 pr-3"><StateBadge state={row.state} /></td>
                        <td className="py-3 pr-3" style={{ color: "var(--cc-text-dim)" }}>{row.accountEmail ?? "—"}</td>
                        <td className="py-3 pr-3 whitespace-nowrap" style={{ color: "var(--cc-text-dim)" }}>
                          {row.lastConnectAttemptAt ? new Date(row.lastConnectAttemptAt).toLocaleString() : "—"}
                        </td>
                        <td className="max-w-[240px] truncate py-3 pr-3 text-xs" style={{ color: "var(--cc-red)" }} title={row.lastConnectError ?? undefined}>
                          {row.lastConnectError ?? "—"}
                        </td>
                        <td className="py-3">
                          {NOTIFIABLE.includes(row.state) ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => handleNotify(row)} disabled={notifying === row.userId} className="min-h-[44px] sm:min-h-0">
                              <Mail className="h-3.5 w-3.5" /> {notifying === row.userId ? "Sending…" : "Notify User"}
                            </Button>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--cc-text-faint)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="min-h-[44px] rounded px-3 py-1.5 disabled:opacity-40" style={{ color: "var(--cc-text-dim)" }}>Previous</button>
                  <span style={{ color: "var(--cc-text-faint)" }}>Page {page} of {totalPages}</span>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="min-h-[44px] rounded px-3 py-1.5 disabled:opacity-40" style={{ color: "var(--cc-text-dim)" }}>Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
