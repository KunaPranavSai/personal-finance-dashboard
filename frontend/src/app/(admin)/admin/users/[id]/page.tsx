"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import {
  Alert, Badge, Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, Pagination, Panel, SelectField, Skeleton, StatusBadge,
  Switch, TabPanel, Tabs, TextField,
} from "@/components/admin/ui";
import { AdminUserLite, UserDialog, UserDialogs } from "@/components/admin/UserDialogs";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { eventLabel, EVENT_OPTIONS, isHighSeverity } from "@/lib/adminEvents";
import { fmtDateTime, fmtRelative } from "@/lib/adminFormat";

interface Geo { city: string | null; region: string | null; country: string | null }
interface UserDetail {
  user: {
    id: string; uid: string; email: string; name: string; phone: string | null; role: AdminUserLite["role"]; status: string;
    twoFactorEnabled: boolean; mustChangePassword: boolean; failedLoginAttempts: number; lockedUntil: string | null;
    emailVerifiedAt: string | null; profileCompletedAt: string | null; hasPin: boolean; accountType: "verified" | "explorer";
    lastLoginAt: string | null; createdAt: string; updatedAt: string;
  };
  overview: { lastLoginIp: string | null; lastLoginGeo: Geo | null; lastLoginDevice: string; activeSessionCount: number };
  storage: { connected: boolean; accountEmail: string | null; migrationState: string; lastConnectAttemptAt: string | null; lastConnectError: string | null; connectedAt: string | null };
  security: { twoFactorEnabled: boolean; passkeyCount: number; passkeys: { id: string; name: string; deviceType: string; lastUsedAt: string | null }[]; failedLoginAttempts: number; lockedUntil: string | null };
  sessions: { id: string; ip: string | null; browser: string | null; os: string | null; device: string | null; lastSeenAt: string; revokedAt: string | null; geo: Geo | null }[];
  supervision: { active: boolean; since: string | null; reason: string | null; by: string | null };
  deletion: { scheduled: boolean; requestedAt: string | null; permanentDeletionAt: string | null };
  notifications: { items: { id: string; type: string; title: string; read: boolean; createdAt: string }[]; unreadCount: number };
  preferences: { settings: Record<string, unknown> | null; profile: Record<string, unknown> | null };
}
const geoLabel = (g: Geo | null) => (g ? [g.city, g.region, g.country].filter(Boolean).join(", ") : "") || "Location unavailable";
const TABS = [
  { id: "overview", label: "Overview" }, { id: "security", label: "Security" }, { id: "sessions", label: "Sessions" }, { id: "storage", label: "Storage" },
  { id: "access", label: "Access & limits" }, { id: "notifications", label: "Notifications" }, { id: "preferences", label: "Preferences" }, { id: "activity", label: "Activity" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="ad-kv">{rows.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}</dl>;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabId>("overview");
  const [dialog, setDialog] = useState<UserDialog | null>(null);
  const [revoke, setRevoke] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["admin", "user", id], queryFn: () => api.get<UserDetail>(`/api/admin/users/${id}/detail`) });
  const reload = () => { void queryClient.invalidateQueries({ queryKey: ["admin", "user", id] }); void queryClient.invalidateQueries({ queryKey: ["admin", "users"] }); };

  if (isError) return <><PageHeader title="User" crumbs={[{ label: "Users", href: "/admin/users" }]} /><ErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} /></>;
  if (isLoading || !data) return <><PageHeader title="User" crumbs={[{ label: "Users", href: "/admin/users" }]} /><Skeleton h={120} className="mb-4" /><Skeleton h={260} /></>;

  const { user, overview, storage, security, sessions, notifications, preferences, supervision, deletion } = data;
  const self = me?.uid === user.uid;
  const locked = user.role === "SUPER_ADMIN" && me?.role !== "SUPER_ADMIN";
  const lite: AdminUserLite = { id: user.id, uid: user.uid, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Users", href: "/admin/users" }, { label: user.name }]}
        title={user.name}
        description={<span className="break-all">{user.email} · UID {user.uid}</span>}
        actions={<>
          <Button onClick={() => setDialog("edit")} disabled={locked}>Edit</Button>
          <Button onClick={() => setDialog("reset-password")} disabled={locked}>Reset password</Button>
          <Button onClick={() => setDialog("force-logout")} disabled={self || locked}>Sign out everywhere</Button>
          {user.status === "SUSPENDED"
            ? <Button onClick={() => setDialog("activate")} disabled={locked}>Restore</Button>
            : <Button variant="danger" onClick={() => setDialog("suspend")} disabled={self || locked}>Suspend</Button>}
        </>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge kind="status" value={user.status} /><StatusBadge kind="role" value={user.role} /><StatusBadge kind="account" value={user.accountType} />
        <StatusBadge kind="migration" value={storage.migrationState} />
        {supervision.active && <Badge tone="red">Under Super Admin control</Badge>}
        {deletion.scheduled && <Badge tone="amber">Deletion scheduled</Badge>}
        {user.twoFactorEnabled && <Badge tone="green">Two-factor on</Badge>}
        {user.lockedUntil && new Date(user.lockedUntil) > new Date() && <Badge tone="red">Locked until {fmtDateTime(user.lockedUntil)}</Badge>}
      </div>

      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} label="User sections" />

      <TabPanel id="overview" active={tab === "overview"}>
        <div className="ad-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))" }}>
          <Panel title="Account"><KV rows={[
            ["Joined", fmtDateTime(user.createdAt)], ["Last sign-in", user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "Never"], ["Phone", user.phone],
            ["Email verified", user.emailVerifiedAt ? fmtDateTime(user.emailVerifiedAt) : "Not verified"], ["Profile completed", user.profileCompletedAt ? fmtDateTime(user.profileCompletedAt) : "Not completed"],
            ["Must change password", user.mustChangePassword ? "Yes" : "No"], ["Last updated", fmtDateTime(user.updatedAt)],
            ["Supervision", supervision.active ? `Under Super Admin control since ${fmtDateTime(supervision.since)}` : "Normal"],
            ["Deletion", deletion.scheduled ? `Deletion scheduled — permanent on ${fmtDateTime(deletion.permanentDeletionAt)}` : "Active"],
          ]} /></Panel>
          <Panel title="Last sign-in"><KV rows={[
            ["Device", overview.lastLoginDevice], ["IP address", overview.lastLoginIp ?? "Not recorded"], ["Approximate location", geoLabel(overview.lastLoginGeo)], ["Active sessions", overview.activeSessionCount],
          ]} />
            <p className="ad-hint mt-3">Location is estimated from the IP address and may be inaccurate.</p></Panel>
        </div>
        {user.accountType === "explorer" && <div className="mt-4"><Alert tone="info">This is an explorer account: it has not completed email verification and profile setup, so it is not counted as a real user on the dashboard.</Alert></div>}
      </TabPanel>

      <TabPanel id="security" active={tab === "security"}>
        <div className="ad-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))" }}>
          <Panel title="Sign-in protection"><KV rows={[
            ["Two-factor", security.twoFactorEnabled ? "Enabled" : "Off"], ["Sign-in PIN", user.hasPin ? "Set" : "Not set"], ["Passkeys", security.passkeyCount],
            ["Failed attempts", security.failedLoginAttempts], ["Locked until", security.lockedUntil && new Date(security.lockedUntil) > new Date() ? fmtDateTime(security.lockedUntil) : "Not locked"],
          ]} /></Panel>
          <Panel title="Passkeys">
            {security.passkeys.length === 0 ? <EmptyState title="No passkeys" /> : (
              <ul className="m-0 list-none p-0">{security.passkeys.map((p) => (
                <li key={p.id} className="ad-row"><div className="flex-1"><div>{p.name}</div><div className="ad-faint text-xs">{p.deviceType}</div></div><span className="ad-faint text-xs">{p.lastUsedAt ? `Used ${fmtRelative(p.lastUsedAt)}` : "Never used"}</span></li>
              ))}</ul>
            )}
          </Panel>
        </div>
        {me?.role === "SUPER_ADMIN" && user.role === "USER" && <div className="mt-4"><AccessAsUser userId={user.id} userName={user.name} /></div>}
        {user.role === "USER" && <div className="mt-4"><SupervisionPanel userId={user.id} userName={user.name} email={user.email} info={supervision} deletion={deletion} canEdit={me?.role === "SUPER_ADMIN"} onChanged={reload} /></div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setDialog("reset-uid")} disabled={locked}>Change User ID</Button>
          <Button variant="danger" onClick={() => setDialog("delete")} disabled={self || locked}>Delete account</Button>
        </div>
      </TabPanel>

      <TabPanel id="sessions" active={tab === "sessions"}>
        <Panel padded={false}>
          {sessions.length === 0 ? <EmptyState title="No tracked sessions yet" /> : (
            <ul className="m-0 list-none p-0 px-4">{sessions.map((s) => (
              <li key={s.id} className="ad-row">
                <div className="min-w-0 flex-1">
                  <div>{s.browser ?? "Unknown browser"} · {s.os ?? "Unknown OS"} · {s.device ?? "Unknown device"}</div>
                  <div className="ad-faint text-xs">{s.ip ?? "Unknown IP"} · {geoLabel(s.geo)} · Last seen {fmtRelative(s.lastSeenAt)}</div>
                </div>
                {s.revokedAt ? <Badge>Ended</Badge> : <><Badge tone="green">Active</Badge><Button size="sm" variant="danger" onClick={() => setRevoke(s.id)}>Revoke</Button></>}
              </li>
            ))}</ul>
          )}
        </Panel>
      </TabPanel>

      <TabPanel id="storage" active={tab === "storage"}>
        <Panel title="Google Drive"><KV rows={[
          ["Connected", storage.connected ? "Yes" : "No"], ["Drive account", storage.accountEmail], ["Migration state", <StatusBadge key="m" kind="migration" value={storage.migrationState} />],
          ["Connected on", storage.connectedAt ? fmtDateTime(storage.connectedAt) : null], ["Last attempt", storage.lastConnectAttemptAt ? fmtDateTime(storage.lastConnectAttemptAt) : null], ["Last error", storage.lastConnectError],
        ]} />
          <p className="ad-hint mt-3">Operational metadata only. Administrators never have access to the contents of a user&apos;s Drive.</p></Panel>
      </TabPanel>

      <TabPanel id="access" active={tab === "access"}>{tab === "access" && <Entitlements userId={user.id} />}</TabPanel>

      <TabPanel id="notifications" active={tab === "notifications"}>
        <Panel padded={false}>
          {notifications.items.length === 0 ? <EmptyState title="No notifications" /> : (
            <ul className="m-0 list-none p-0 px-4">{notifications.items.map((n) => (
              <li key={n.id} className="ad-row"><div className="flex-1"><div>{n.title}</div><div className="ad-faint text-xs">{n.type} · {fmtDateTime(n.createdAt)}</div></div>{!n.read && <Badge tone="accent">Unread</Badge>}</li>
            ))}</ul>
          )}
        </Panel>
      </TabPanel>

      <TabPanel id="preferences" active={tab === "preferences"}>
        <Panel title="Interface preferences"><p className="ad-hint mb-2">Display settings only, never financial data.</p>
          <pre className="m-0 overflow-x-auto whitespace-pre-wrap text-xs ad-muted">{JSON.stringify({ settings: preferences.settings, profile: preferences.profile }, null, 2)}</pre></Panel>
      </TabPanel>

      <TabPanel id="activity" active={tab === "activity"}>{tab === "activity" && <UserActivity userId={user.id} />}</TabPanel>

      <UserDialogs user={dialog ? lite : null} dialog={dialog} onClose={() => setDialog(null)} onDone={reload} />
      <ConfirmDialog open={revoke !== null} onClose={() => setRevoke(null)} danger title="Revoke this session" target={`${user.name} (${user.email})`} confirmLabel="Revoke session"
        description="Signs out this one device immediately. Their other sessions are not affected."
        onConfirm={async () => { await api.post(`/api/admin/users/${user.id}/sessions/${revoke}/revoke`); toast("Session revoked", "success"); reload(); }} />
    </>
  );
}

function SupervisionPanel({ userId, userName, email, info, deletion, canEdit, onChanged }: {
  userId: string; userName: string; email: string; info: UserDetail["supervision"]; deletion: UserDetail["deletion"]; canEdit: boolean; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Panel title="Administrator supervision" actions={<Badge tone={info.active ? "red" : "green"}>{info.active ? "Under Super Admin control" : "Normal"}</Badge>}>
      <p className="ad-muted mb-3 mt-0">
        {info.active
          ? `Placed under supervision ${info.since ? fmtDateTime(info.since) : ""}${info.by ? ` by ${info.by}` : ""}${info.reason ? `. Reason: ${info.reason}` : ""}. ${userName} can sign in but sees only a locked screen, and the API refuses all their data and settings requests.`
          : `${userName} has normal access. A Super Admin can lock the account: they can still sign in, but the app and API stay blocked until supervision is revoked.`}
      </p>
      {deletion.scheduled && <div className="mb-3"><Alert tone="warn" title="Deletion scheduled">This account will be permanently deleted on {fmtDateTime(deletion.permanentDeletionAt)}. The owner can reactivate it before then.</Alert></div>}
      {canEdit ? (
        <Button variant={info.active ? "default" : "danger"} onClick={() => { setReason(""); setOpen(true); }}>{info.active ? "Revoke supervision" : "Place under supervision"}</Button>
      ) : <p className="ad-faint m-0 text-xs">Only a Super Admin can start or revoke supervision.</p>}
      <ConfirmDialog open={open} onClose={() => setOpen(false)} danger={!info.active} title={info.active ? "Revoke supervision" : "Place under supervision"} target={`${userName} (${email})`}
        confirmLabel={info.active ? "Revoke supervision" : "Place under supervision"}
        description={info.active ? "The account becomes fully usable again the next time the app checks (within seconds)." : "The user will be blocked from the whole app (data, settings, security and storage) and shown a full-screen notice. They can still sign in. This is recorded in the audit log."}
        onConfirm={async () => { await api.post(`/api/admin/users/${userId}/supervision`, { action: info.active ? "revoke" : "start", reason }); toast(info.active ? "Supervision revoked" : "Account placed under supervision", "success"); onChanged(); }}>
        {!info.active && <TextField label="Reason (optional, visible to admins)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />}
      </ConfirmDialog>
    </Panel>
  );
}

function UserActivity({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [event, setEvent] = useState("");
  const qs = new URLSearchParams({ page: String(page), pageSize: "15" });
  if (event) qs.set("event", event);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "user-activity", userId, qs.toString()],
    queryFn: () => api.get<{ items: { id: string; event: string; detail: string | null; ip: string | null; createdAt: string; actor: { name: string; email: string } | null }[]; pagination: { total: number } }>(`/api/admin/users/${userId}/activity?${qs}`),
    placeholderData: (p) => p,
  });
  return (
    <Panel padded={false}>
      <div className="ad-toolbar"><div style={{ flex: "0 1 260px" }}>
        <SelectField label="Event" hideLabel value={event} aria-label="Filter by event" onChange={(e) => { setEvent(e.target.value); setPage(1); }}>
          <option value="">All events</option>{EVENT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </SelectField></div></div>
      {isError ? <ErrorState onRetry={() => void refetch()} /> : isLoading ? <Skeleton h={160} className="m-4" /> : !data || data.items.length === 0 ? <EmptyState title="No activity recorded" /> : (
        <ul className="m-0 list-none p-0 px-4">{data.items.map((a) => (
          <li key={a.id} className="ad-row">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="font-medium">{eventLabel(a.event)}</span>{isHighSeverity(a.event) && <Badge tone="red">High</Badge>}</div>
              {a.detail && <div className="ad-muted text-[13px]">{a.detail}</div>}
              {a.actor && <div className="ad-faint text-xs">By {a.actor.name} ({a.actor.email})</div>}
            </div>
            <div className="ad-faint shrink-0 text-right text-xs"><div>{fmtDateTime(a.createdAt)}</div>{a.ip && <div>{a.ip}</div>}</div>
          </li>
        ))}</ul>
      )}
      {data && data.pagination.total > 0 && <Pagination page={page} pageSize={15} total={data.pagination.total} onPage={setPage} noun="events" />}
    </Panel>
  );
}

function AccessAsUser({ userId, userName }: { userId: string; userName: string }) {
  const { toast } = useToast();
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast(e instanceof Error ? e.message : "That didn't work", "error"); } finally { setBusy(false); } };
  return (
    <Panel title="Access as user (break-glass)">
      <p className="ad-muted mb-3 mt-0">Sends a one-time code to {userName}&apos;s own email. They must give it to you before you can view their account. The access is logged and expires after 20 minutes.</p>
      {!requestId ? (
        <Button loading={busy} onClick={() => void run(async () => { const r = await api.post<{ requestId: string }>(`/api/admin/users/${userId}/access-request`); setRequestId(r.requestId); toast(`Code sent to ${userName}`, "success"); })}>Send access code to user</Button>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div style={{ width: 180 }}><TextField label="6-digit code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
          <Button variant="primary" loading={busy} disabled={code.length !== 6} onClick={() => void run(async () => { await api.post(`/api/admin/users/${userId}/access-verify`, { requestId, code }); window.location.href = "/dashboard"; })}>Verify and open account</Button>
        </div>
      )}
    </Panel>
  );
}

interface Entitlement { planLabel: string; features: Record<string, boolean>; limits: Record<string, number | null>; restricted: boolean; notifyEligible: boolean; emailEligible: boolean }
function Entitlements({ userId }: { userId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["admin", "entitlements", userId], queryFn: () => api.get<Entitlement>(`/api/admin/users/${userId}/entitlements`) });
  const [draft, setDraft] = useState<Entitlement | null>(null);
  const [newFeature, setNewFeature] = useState("");
  const [newLimit, setNewLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const form = draft ?? data;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading || !form) return <Skeleton h={200} />;
  const set = (patch: Partial<Entitlement>) => setDraft({ ...form, ...patch });
  const save = async () => {
    setSaving(true);
    try { await api.patch(`/api/admin/users/${userId}/entitlements`, form); toast("Saved", "success"); setDraft(null); void queryClient.invalidateQueries({ queryKey: ["admin", "entitlements", userId] }); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "error"); } finally { setSaving(false); }
  };
  return (
    <div className="grid gap-4">
      <Panel title="Account controls">
        <div className="grid gap-1">
          <label className="ad-row"><span className="flex-1"><strong>Restricted</strong><span className="ad-hint block">Blocks sign-in (password and passkey) before a session is issued.</span></span><Switch label="Restricted" checked={form.restricted} onChange={(v) => set({ restricted: v })} /></label>
          <label className="ad-row"><span className="flex-1"><strong>Allow automated emails</strong><span className="ad-hint block">When off, non-essential automated emails to this user are skipped.</span></span><Switch label="Allow automated emails" checked={form.emailEligible} onChange={(v) => set({ emailEligible: v })} /></label>
          <label className="ad-row"><span className="flex-1"><strong>Allow notifications</strong><span className="ad-hint block">Saved for future use; nothing reads this yet.</span></span><Switch label="Allow notifications" checked={form.notifyEligible} onChange={(v) => set({ notifyEligible: v })} /></label>
        </div>
        <div className="mt-3" style={{ maxWidth: 280 }}><TextField label="Plan label" value={form.planLabel} onChange={(e) => set({ planLabel: e.target.value })} hint="A label only; no plan logic reads it." /></div>
      </Panel>
      <Panel title="Feature flags and limits">
        <Alert tone="warn">Saved for future use. Nothing in the app reads these flags or limits yet.</Alert>
        <div className="mt-3 grid gap-2">
          {Object.entries(form.features).map(([k, v]) => (
            <div key={k} className="ad-row" style={{ padding: "6px 0" }}><code className="flex-1">{k}</code><Switch label={k} checked={v} onChange={(c) => set({ features: { ...form.features, [k]: c } })} />
              <Button size="sm" variant="ghost" icon aria-label={`Remove ${k}`} onClick={() => { const f = { ...form.features }; delete f[k]; set({ features: f }); }}><Trash2 size={16} aria-hidden="true" /></Button></div>
          ))}
          {Object.entries(form.limits).map(([k, v]) => (
            <div key={k} className="ad-row" style={{ padding: "6px 0" }}><code className="flex-1">{k}</code>
              <div style={{ width: 120 }}><TextField label={`${k} limit`} hideLabel type="number" placeholder="Unlimited" value={v ?? ""} onChange={(e) => set({ limits: { ...form.limits, [k]: e.target.value === "" ? null : Number(e.target.value) } })} /></div>
              <Button size="sm" variant="ghost" icon aria-label={`Remove ${k}`} onClick={() => { const l = { ...form.limits }; delete l[k]; set({ limits: l }); }}><Trash2 size={16} aria-hidden="true" /></Button></div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <div style={{ width: 200 }}><TextField label="New feature flag" hideLabel placeholder="feature_key" value={newFeature} onChange={(e) => setNewFeature(e.target.value)} /></div>
          <Button size="sm" disabled={!newFeature.trim()} onClick={() => { set({ features: { ...form.features, [newFeature.trim()]: true } }); setNewFeature(""); }}><Plus size={14} aria-hidden="true" />Add flag</Button>
          <div style={{ width: 200 }}><TextField label="New limit" hideLabel placeholder="limit_key" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} /></div>
          <Button size="sm" disabled={!newLimit.trim()} onClick={() => { set({ limits: { ...form.limits, [newLimit.trim()]: null } }); setNewLimit(""); }}><Plus size={14} aria-hidden="true" />Add limit</Button>
        </div>
      </Panel>
      <div><Button variant="primary" loading={saving} disabled={!draft} onClick={() => void save()}>Save changes</Button></div>
    </div>
  );
}
