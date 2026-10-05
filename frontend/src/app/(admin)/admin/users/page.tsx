"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { ActionMenu, Column, DataTable, EmptyState, PageHeader, Pagination, Panel, SelectField, StatusBadge, TextField, useDebounced } from "@/components/admin/ui";
import { AdminExportMenu } from "@/components/admin/AdminExportMenu";
import { AdminUserLite, UserDialog, UserDialogs } from "@/components/admin/UserDialogs";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { fmtDate, fmtRelative } from "@/lib/adminFormat";

interface Row extends AdminUserLite {
  createdAt: string; lastLoginAt: string | null; twoFactorEnabled: boolean; accountType: "verified" | "explorer"; migrationState: string | null;
}
interface Page { page: number; pageSize: number; total: number; totalPages: number; items: Row[] }

function UsersList() {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [role, setRole] = useState(params.get("role") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [verification, setVerification] = useState(params.get("verification") ?? "");
  const [sort, setSort] = useState({ sort: "createdAt", dir: "desc" as "asc" | "desc" });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [active, setActive] = useState<{ user: Row; dialog: UserDialog } | null>(null);
  const dq = useDebounced(q);

  // Any filter change goes back to page 1.
  useEffect(() => { setPage(1); }, [dq, role, status, verification, sort]);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: sort.sort, dir: sort.dir });
  if (dq.trim()) qs.set("q", dq.trim());
  if (role) qs.set("role", role);
  if (status) qs.set("status", status);
  if (verification) qs.set("verification", verification);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["admin", "users", qs.toString()],
    queryFn: () => api.get<Page>(`/api/admin/users?${qs}`),
    placeholderData: (prev) => prev,
  });

  const toggleSort = (key: string) => setSort((s) => (s.sort === key ? { sort: key, dir: s.dir === "asc" ? "desc" : "asc" } : { sort: key, dir: key === "name" || key === "email" ? "asc" : "desc" }));
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin"] });
  const filtered = Boolean(dq.trim() || role || status || verification);
  const clear = () => { setQ(""); setRole(""); setStatus(""); setVerification(""); };

  const columns: Column<Row>[] = [
    { key: "name", header: "User", sortKey: "name", primary: true, render: (u) => (
      <div className="min-w-0">
        <div className="font-semibold">{u.name || "(no name)"}{me?.uid === u.uid && <span className="ad-faint font-normal"> (you)</span>}</div>
        <div className="ad-faint break-all text-xs">{u.email} · {u.uid}</div>
      </div>
    ) },
    { key: "role", header: "Role", render: (u) => <StatusBadge kind="role" value={u.role} /> },
    { key: "status", header: "Status", render: (u) => <StatusBadge kind="status" value={u.status} /> },
    { key: "acct", header: "Account", render: (u) => <StatusBadge kind="account" value={u.accountType} /> },
    { key: "drive", header: "Drive", render: (u) => <StatusBadge kind="migration" value={u.migrationState} /> },
    { key: "created", header: "Joined", sortKey: "createdAt", render: (u) => <span className="whitespace-nowrap">{fmtDate(u.createdAt)}</span> },
    { key: "login", header: "Last sign-in", sortKey: "lastLoginAt", render: (u) => <span className="whitespace-nowrap">{u.lastLoginAt ? fmtRelative(u.lastLoginAt) : <span className="ad-faint">Never</span>}</span> },
    { key: "actions", header: "Actions", hideLabelOnCard: true, align: "right", render: (u) => {
      const self = me?.uid === u.uid;
      const locked = u.role === "SUPER_ADMIN" && me?.role !== "SUPER_ADMIN";
      const open = (dialog: UserDialog) => () => setActive({ user: u, dialog });
      return (
        <ActionMenu label={`Actions for ${u.name}`} actions={[
          { label: "Open User 360", href: `/admin/users/${u.id}` },
          { label: "Edit details", onSelect: open("edit"), disabled: locked, hint: locked ? "Only a Super Admin can modify a Super Admin" : undefined },
          { label: "Reset password", onSelect: open("reset-password"), disabled: locked },
          { label: "Change User ID", onSelect: open("reset-uid"), disabled: locked },
          { label: "Sign out everywhere", onSelect: open("force-logout"), disabled: self || locked },
          u.status === "SUSPENDED" ? { label: "Restore account", onSelect: open("activate"), disabled: locked } : { label: "Suspend account", onSelect: open("suspend"), disabled: self || locked, danger: true },
          { label: "Delete account", onSelect: open("delete"), disabled: self || locked, danger: true, hint: self ? "You can't delete your own account" : undefined },
        ]} />
      );
    } },
  ];

  return (
    <>
      <PageHeader title="Users" description={data ? `${data.total} ${filtered ? "matching" : "total"} account${data.total === 1 ? "" : "s"}` : "Accounts across the platform"} actions={<AdminExportMenu type="users" />} />
      <Panel padded={false}>
        <div className="ad-toolbar" role="search">
          <div className="relative" style={{ flex: "1 1 240px" }}>
            <Search size={16} className="ad-faint absolute left-3 top-[12px]" aria-hidden="true" />
            <TextField label="Search" hideLabel value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, UID or phone" style={{ paddingLeft: 36 }} />
          </div>
          <div style={{ flex: "0 1 150px" }}><SelectField label="Role" hideLabel value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role"><option value="">All roles</option><option value="USER">User</option><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super Admin</option></SelectField></div>
          <div style={{ flex: "0 1 150px" }}><SelectField label="Status" hideLabel value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></SelectField></div>
          <div style={{ flex: "0 1 170px" }}><SelectField label="Account type" hideLabel value={verification} onChange={(e) => setVerification(e.target.value)} aria-label="Filter by account type"><option value="">All accounts</option><option value="verified">Verified</option><option value="explorer">Explorer</option></SelectField></div>
        </div>
        <DataTable<Row>
          caption="Users" columns={columns} rows={data?.items} rowKey={(u) => u.id} loading={isLoading || isFetching}
          error={isError ? (error instanceof Error ? error.message : "Couldn't load users") : null} onRetry={() => void refetch()}
          sort={sort} onSort={toggleSort} onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
          empty={<EmptyState icon={Users} title={filtered ? "No users match these filters" : "No users yet"} description={filtered ? "Try a different search or clear the filters." : undefined}
            action={filtered ? <button className="ad-btn sm" onClick={clear}>Clear filters</button> : undefined} />}
        />
        {data && data.total > 0 && <Pagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} noun="users" />}
      </Panel>
      <UserDialogs user={active?.user ?? null} dialog={active?.dialog ?? null} onClose={() => setActive(null)} onDone={refresh} />
    </>
  );
}

export default function AdminUsersPage() {
  return <Suspense fallback={null}><UsersList /></Suspense>;
}
