"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ShieldCheck, ShieldOff, Smartphone, HardDrive, Bell, Activity, Settings2,
  LogOut, Fingerprint, Pencil, UserCheck, UserX, KeyRound, Sparkles, Plus, Trash2, Save,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatDateIN } from "@/lib/format";
import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { EditUserModal, ManagedUser } from "@/components/admin/UserManagementShared";
import { useAuth } from "@/lib/AuthContext";
import { ApiClientError } from "@/lib/api";

interface GeoLocation { city: string | null; region: string | null; country: string | null; countryCode: string; ll: [number, number]; timezone: string }

interface UserDetail {
  user: {
    id: string; uid: string; email: string; name: string; phone: string | null;
    role: "SUPER_ADMIN" | "ADMIN" | "USER"; status: string;
    twoFactorEnabled: boolean; mustChangePassword: boolean;
    failedLoginAttempts: number; lockedUntil: string | null;
    onboardedAt: string | null; approvedAt: string | null; rejectedAt: string | null; rejectionReason: string | null;
    lastLoginAt: string | null; createdAt: string; updatedAt: string;
  };
  overview: {
    registeredAt: string; registeredIp: string; lastLogin: string | null; lastLoginIp: string | null;
    lastLoginGeo: GeoLocation | null; lastLoginDevice: string; activeSessionCount: number; macAddress: string;
  };
  storage: {
    connected: boolean; accountEmail: string | null; migrationState: string;
    lastConnectAttemptAt: string | null; lastConnectError: string | null;
    connectedAt: string | null; updatedAt: string | null;
  };
  security: {
    twoFactorEnabled: boolean; passkeyCount: number;
    passkeys: { id: string; name: string; deviceType: string; backedUp: boolean; transports: string[]; lastUsedAt: string | null; createdAt: string }[];
    failedLoginAttempts: number; lockedUntil: string | null;
  };
  sessions: { id: string; ip: string | null; browser: string | null; os: string | null; device: string | null; createdAt: string; lastSeenAt: string; revokedAt: string | null; geo: GeoLocation | null }[];
  notifications: { items: { id: string; type: string; title: string; read: boolean; createdAt: string }[]; unreadCount: number };
  preferences: { settings: Record<string, unknown> | null; profile: Record<string, unknown> | null };
  activity: { id: string; event: string; detail: string | null; ip: string | null; browser: string | null; os: string | null; device: string | null; createdAt: string }[];
}

function geoLabel(geo: GeoLocation | null): string {
  if (!geo) return "Location: Unavailable";
  return [geo.city, geo.region, geo.country].filter(Boolean).join(", ") || "Location: Unavailable";
}

const TABS = ["Overview", "Authentication", "Sessions", "Storage", "Security", "Access", "Notifications", "Preferences", "Activity"] as const;

interface Entitlement {
  userId: string;
  planLabel: string;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  restricted: boolean;
  notifyEligible: boolean;
  emailEligible: boolean;
  updatedAt: string | null;
}
const AUTH_EVENTS = ["login_failed", "password_changed", "password_reset", "password_reset_requested", "uid_changed", "2fa_enabled", "2fa_disabled"];
type Tab = (typeof TABS)[number];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="cc-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>{label}</p>
      <p className="text-sm" style={{ color: "var(--cc-text)" }}>{value ?? "—"}</p>
    </div>
  );
}

function EntitlementsPanel({ userId, toast }: { userId: string; toast: (msg: string, type: "success" | "error") => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-entitlements", userId],
    queryFn: () => api.get<Entitlement>(`/api/admin/users/${userId}/entitlements`),
  });

  const [planLabel, setPlanLabel] = useState("");
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number | null>>({});
  const [restricted, setRestricted] = useState(false);
  const [notifyEligible, setNotifyEligible] = useState(true);
  const [emailEligible, setEmailEligible] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [newFeatureKey, setNewFeatureKey] = useState("");
  const [newLimitKey, setNewLimitKey] = useState("");
  const [saving, setSaving] = useState(false);

  if (data && !seeded) {
    setPlanLabel(data.planLabel);
    setFeatures(data.features ?? {});
    setLimits(data.limits ?? {});
    setRestricted(data.restricted);
    setNotifyEligible(data.notifyEligible);
    setEmailEligible(data.emailEligible);
    setSeeded(true);
  }

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/admin/users/${userId}/entitlements`, {
        planLabel, features, limits, restricted, notifyEligible, emailEligible,
      });
      toast("Entitlements updated", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-user-entitlements", userId] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update entitlements", "error");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="cc-panel h-40 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="cc-panel flex items-start gap-2 p-3">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--cc-text-faint)" }} />
        <p className="text-xs" style={{ color: "var(--cc-text-faint)" }}>
          Extensible, non-billing account configuration. Not a subscription or payment system. Precedence: platform default
          (no plan-tier defaults table exists yet — this layer is skipped) → this user-level row, which is the only layer
          that currently exists.
        </p>
      </div>

      <div className="cc-panel p-4">
        <label className="cc-mono mb-1 block text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Plan Label</label>
        <input value={planLabel} onChange={(e) => setPlanLabel(e.target.value)} className="cc-mono w-full max-w-xs rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }} placeholder="FREE" />
        <p className="mt-1 text-[11px]" style={{ color: "var(--cc-text-faint)" }}>Label only — no plan/tier logic reads this.</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--cc-text-dim)" }}>
            <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} className="h-4 w-4 rounded" /> Restricted
          </label>
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--cc-text-dim)" }}>
            <input type="checkbox" checked={notifyEligible} onChange={(e) => setNotifyEligible(e.target.checked)} className="h-4 w-4 rounded" /> Notify Eligible
          </label>
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--cc-text-dim)" }}>
            <input type="checkbox" checked={emailEligible} onChange={(e) => setEmailEligible(e.target.checked)} className="h-4 w-4 rounded" /> Email Eligible
          </label>
        </div>
        <div className="mt-3 space-y-1 text-[11px]" style={{ color: "var(--cc-text-faint)" }}>
          <p><span style={{ color: "var(--cc-green)" }}>● Enforced:</span> Restricted blocks sign-in (password + passkey) before any session is issued.</p>
          <p><span style={{ color: "var(--cc-green)" }}>● Enforced:</span> Email Eligible is checked before non-security-critical automated emails (see Automated Emails).</p>
          <p><span style={{ color: "var(--cc-amber)" }}>● Future / not yet enforced:</span> Notify Eligible, and every Feature Flag / Limit below — nothing in the app currently reads them.</p>
        </div>
      </div>

      <div className="cc-panel p-4">
        <p className="cc-mono mb-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Feature Flags</p>
        <div className="space-y-2">
          {Object.entries(features).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="cc-mono" style={{ color: "var(--cc-text)" }}>{key}</span>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={val} onChange={(e) => setFeatures((f) => ({ ...f, [key]: e.target.checked }))} className="h-4 w-4 rounded" />
                <button onClick={() => setFeatures((f) => { const n = { ...f }; delete n[key]; return n; })} aria-label={`Remove ${key}`}>
                  <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--cc-red)" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={newFeatureKey} onChange={(e) => setNewFeatureKey(e.target.value)} placeholder="feature_key" className="cc-mono flex-1 rounded border bg-transparent px-3 py-1.5 text-xs" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }} />
          <button
            onClick={() => { if (newFeatureKey.trim()) { setFeatures((f) => ({ ...f, [newFeatureKey.trim()]: true })); setNewFeatureKey(""); } }}
            className="flex items-center gap-1 rounded border px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-dim)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>

      <div className="cc-panel p-4">
        <p className="cc-mono mb-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Limits</p>
        <div className="space-y-2">
          {Object.entries(limits).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="cc-mono" style={{ color: "var(--cc-text)" }}>{key}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={val ?? ""}
                  onChange={(e) => setLimits((l) => ({ ...l, [key]: e.target.value === "" ? null : Number(e.target.value) }))}
                  placeholder="unlimited"
                  className="cc-mono w-24 rounded border bg-transparent px-2 py-1 text-xs"
                  style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
                />
                <button onClick={() => setLimits((l) => { const n = { ...l }; delete n[key]; return n; })} aria-label={`Remove ${key}`}>
                  <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--cc-red)" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={newLimitKey} onChange={(e) => setNewLimitKey(e.target.value)} placeholder="limit_key" className="cc-mono flex-1 rounded border bg-transparent px-3 py-1.5 text-xs" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }} />
          <button
            onClick={() => { if (newLimitKey.trim()) { setLimits((l) => ({ ...l, [newLimitKey.trim()]: null })); setNewLimitKey(""); } }}
            className="flex items-center gap-1 rounded border px-2 py-1.5 text-xs"
            style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-dim)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="cc-mono flex min-h-[44px] items-center gap-1.5 rounded border px-4 py-2 text-xs disabled:opacity-50"
        style={{ borderColor: "var(--cc-border)", color: "var(--cc-accent)" }}
      >
        <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save Entitlements"}
      </button>
    </div>
  );
}

function AccessAsUserPanel({ userId, userName, toast }: { userId: string; userName: string; toast: (msg: string, type: "success" | "error") => void }) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ requestId: string }>(`/api/admin/users/${userId}/access-request`);
      setRequestId(res.requestId);
      toast(`Verification code sent to ${userName}`, "success");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to request access", "error");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!requestId) return;
    setBusy(true);
    try {
      await api.post(`/api/admin/users/${userId}/access-verify`, { requestId, code });
      toast(`Now viewing as ${userName}`, "success");
      window.location.href = "/dashboard";
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Invalid code", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cc-panel p-4" style={{ borderColor: "var(--cc-amber)" }}>
      <p className="cc-mono mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-amber)" }}>
        Access as User — break glass
      </p>
      <p className="mb-3 text-xs" style={{ color: "var(--cc-text-faint)" }}>
        Sends a one-time code to {userName}&apos;s own email. They must give it to you before you can view their account. Logged and time-limited (20 min).
      </p>
      {!requestId ? (
        <button onClick={request} disabled={busy} className="cc-mono flex min-h-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-xs disabled:opacity-50" style={{ borderColor: "var(--cc-amber)", color: "var(--cc-amber)" }}>
          Request Access
        </button>
      ) : (
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="cc-mono w-32 rounded border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }} />
          <button onClick={verify} disabled={busy || code.length !== 6} className="cc-mono flex min-h-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-xs disabled:opacity-50" style={{ borderColor: "var(--cc-amber)", color: "var(--cc-amber)" }}>
            Verify &amp; Access
          </button>
        </div>
      )}
    </div>
  );
}

interface ActivityItem {
  id: string; event: string; detail: string | null; createdAt: string;
  ip: string | null; browser: string | null; os: string | null; device: string | null;
  geo: GeoLocation | null;
  actor: { name: string; email: string } | null;
  isSelfAction: boolean;
}

function UserActivityPanel({ userId, userName }: { userId: string; userName: string }) {
  const [page, setPage] = useState(1);
  const [event, setEvent] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (event) params.set("event", event);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-activity", userId, event, from, to, page],
    queryFn: () => api.get<{ items: ActivityItem[]; pagination: { page: number; totalPages: number } }>(`/api/admin/users/${userId}/activity?${params.toString()}`),
  });
  const items = data?.items ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }} placeholder="Event type" className="cc-mono rounded border bg-transparent px-2 py-1.5 text-xs" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }} />
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="cc-mono rounded border bg-transparent px-2 py-1.5 text-xs" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }} />
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="cc-mono rounded border bg-transparent px-2 py-1.5 text-xs" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }} />
      </div>
      <div className="space-y-1">
        {isLoading ? (
          <div className="cc-panel h-24 animate-pulse" />
        ) : items.length === 0 ? (
          <div className="cc-panel p-6 text-center text-xs cc-mono" style={{ color: "var(--cc-text-faint)" }}>No activity recorded.</div>
        ) : (
          items.map((a) => (
            <div key={a.id} className="cc-panel flex items-center gap-3 p-3">
              <Activity className="h-4 w-4" style={{ color: "var(--cc-accent)" }} />
              <div className="min-w-0 flex-1">
                <p className="cc-mono text-xs" style={{ color: "var(--cc-text)" }}>{a.event}</p>
                {a.detail && <p className="text-xs" style={{ color: "var(--cc-text-dim)" }}>{a.detail}</p>}
                {a.actor && <p className="cc-mono text-[10px]" style={{ color: "var(--cc-amber)" }}>Actor: {a.actor.name} ({a.actor.email}) · Target: {userName}</p>}
                <p className="cc-mono text-[10px]" style={{ color: "var(--cc-text-faint)" }}>
                  {formatDateIN(a.createdAt)}{a.ip ? ` · ${a.ip}` : ""} · {geoLabel(a.geo)}{a.browser ? ` · ${a.browser}/${a.os}` : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs cc-mono" style={{ color: "var(--cc-text-faint)" }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="disabled:opacity-40">Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Overview");
  const [confirmAction, setConfirmAction] = useState<
    null | { kind: "force-logout" } | { kind: "revoke-session"; sessionId: string } | { kind: "status"; status: "ACTIVE" | "SUSPENDED" }
  >(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-detail", params.id],
    queryFn: () => api.get<UserDetail>(`/api/admin/users/${params.id}/detail`),
  });

  if (isLoading || !data) {
    return (
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="cc-panel h-24 animate-pulse" />
      </main>
    );
  }

  const { user, overview, storage, security, sessions, notifications, preferences, activity } = data;

  return (
    <>
      <Topbar title={user.name} />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <button
          onClick={() => router.push("/admin/users")}
          className="cc-mono mb-4 flex items-center gap-1.5 text-xs"
          style={{ color: "var(--cc-text-faint)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Users
        </button>

        {/* User header */}
        <div className="cc-panel cc-glow mb-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold" style={{ color: "var(--cc-text)" }}>{user.name}</p>
                <Badge tone={user.status === "ACTIVE" ? "teal" : user.status === "SUSPENDED" ? "red" : "yellow"}>{user.status}</Badge>
                <Badge tone="gray">{user.role.replace("_", " ")}</Badge>
              </div>
              <p className="cc-mono text-xs" style={{ color: "var(--cc-text-dim)" }}>{user.email} · UID {user.uid}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setEditing(true)}
                className="cc-mono flex min-h-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-xs sm:min-h-0"
                style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-dim)" }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Profile
              </button>
              {user.status !== "ACTIVE" ? (
                <button
                  onClick={() => setConfirmAction({ kind: "status", status: "ACTIVE" })}
                  className="cc-mono flex min-h-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-xs sm:min-h-0"
                  style={{ borderColor: "var(--cc-border)", color: "var(--cc-green)" }}
                >
                  <UserCheck className="h-3.5 w-3.5" /> {user.status === "SUSPENDED" ? "Restore" : "Activate"}
                </button>
              ) : (
                <button
                  disabled={user.role === "SUPER_ADMIN"}
                  onClick={() => setConfirmAction({ kind: "status", status: "SUSPENDED" })}
                  className="cc-mono flex min-h-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-xs disabled:opacity-40 sm:min-h-0"
                  style={{ borderColor: "var(--cc-border)", color: "var(--cc-red)" }}
                >
                  <UserX className="h-3.5 w-3.5" /> Suspend
                </button>
              )}
              <button
                disabled={user.role === "SUPER_ADMIN"}
                onClick={() => setConfirmAction({ kind: "force-logout" })}
                className="cc-mono flex min-h-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-xs disabled:opacity-40 sm:min-h-0"
                style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-dim)" }}
              >
                <LogOut className="h-3.5 w-3.5" /> Force Logout
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Registered" value={formatDateIN(user.createdAt)} />
            <Field label="Last Login" value={user.lastLoginAt ? formatDateIN(user.lastLoginAt) : "Never"} />
            <Field label="Drive Status" value={storage.migrationState.replace(/_/g, " ")} />
            <Field label="Security" value={user.twoFactorEnabled ? "2FA Enabled" : "2FA Off"} />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="cc-mono rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{
                background: tab === t ? "var(--cc-accent-dim)" : "transparent",
                color: tab === t ? "var(--cc-accent)" : "var(--cc-text-faint)",
                border: "1px solid var(--cc-border)",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Overview" && (
          <div className="space-y-4">
            <div className="cc-panel p-4">
              <p className="cc-mono mb-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Registration &amp; Access</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label="Registered" value={formatDateIN(overview.registeredAt)} />
                <Field label="Registration IP" value={overview.registeredIp} />
                <Field label="Last Login" value={overview.lastLogin ? formatDateIN(overview.lastLogin) : "Never"} />
                <Field label="Last Login IP" value={overview.lastLoginIp ?? "Not recorded"} />
                <Field label="Approximate location based on IP" value={geoLabel(overview.lastLoginGeo)} />
                <Field label="Last Device" value={overview.lastLoginDevice} />
                <Field label="MAC Address" value={overview.macAddress} />
                <Field label="Active Sessions" value={overview.activeSessionCount} />
                <Field label="2FA" value={user.twoFactorEnabled ? "Enabled" : "Disabled"} />
                <Field label="Passkeys" value={security.passkeyCount} />
                <Field label="Drive Connected" value={storage.connected ? "Yes" : "No"} />
              </div>
            </div>
            <div className="cc-panel p-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label="Phone" value={user.phone} />
                <Field label="Approved At" value={user.approvedAt ? formatDateIN(user.approvedAt) : null} />
                <Field label="Rejected At" value={user.rejectedAt ? formatDateIN(user.rejectedAt) : null} />
                <Field label="Rejection Reason" value={user.rejectionReason} />
                <Field label="Must Change Password" value={user.mustChangePassword ? "Yes" : "No"} />
                <Field label="Failed Login Attempts" value={user.failedLoginAttempts} />
                <Field label="Locked Until" value={user.lockedUntil ? formatDateIN(user.lockedUntil) : "Not locked"} />
                <Field label="Unread Notifications" value={notifications.unreadCount} />
                <Field label="Updated At" value={formatDateIN(user.updatedAt)} />
              </div>
            </div>
          </div>
        )}

        {tab === "Authentication" && (
          <div className="space-y-4">
            <div className="cc-panel p-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label="Auth Method" value="Password" />
                <Field label="2FA" value={user.twoFactorEnabled ? "Enabled" : "Disabled"} />
                <Field label="Must Change Password" value={user.mustChangePassword ? "Yes" : "No"} />
                <Field label="Failed Login Attempts" value={user.failedLoginAttempts} />
                <Field label="Locked Until" value={user.lockedUntil ? formatDateIN(user.lockedUntil) : "Not locked"} />
                <Field label="Last Login" value={user.lastLoginAt ? formatDateIN(user.lastLoginAt) : "Never"} />
              </div>
            </div>
            <div className="cc-panel p-4">
              <p className="cc-mono mb-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Authentication Events</p>
              {activity.filter((a) => AUTH_EVENTS.includes(a.event)).length === 0 ? (
                <p className="text-xs" style={{ color: "var(--cc-text-faint)" }}>No authentication events recorded.</p>
              ) : (
                <div className="space-y-1">
                  {activity.filter((a) => AUTH_EVENTS.includes(a.event)).map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs" style={{ color: "var(--cc-text-dim)" }}>
                      <span className="cc-mono">{a.event}{a.detail ? ` — ${a.detail}` : ""}</span>
                      <span className="cc-mono" style={{ color: "var(--cc-text-faint)" }}>{formatDateIN(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "Sessions" && (
          <div className="space-y-2">
            {sessions.length === 0 ? (
              <div className="cc-panel p-6 text-center text-xs cc-mono" style={{ color: "var(--cc-text-faint)" }}>No tracked sessions yet.</div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="cc-panel flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-4 w-4" style={{ color: s.revokedAt ? "var(--cc-text-faint)" : "var(--cc-green)" }} />
                    <div>
                      <p className="text-sm" style={{ color: "var(--cc-text)" }}>{s.browser ?? "Unknown"} · {s.os ?? "Unknown"} · {s.device ?? "Unknown"}</p>
                      <p className="cc-mono text-[10px]" style={{ color: "var(--cc-text-faint)" }}>
                        {s.ip ?? "unknown IP"} · {geoLabel(s.geo)} · Last seen {formatDateIN(s.lastSeenAt)}{s.revokedAt ? " · Revoked" : ""}
                      </p>
                    </div>
                  </div>
                  {!s.revokedAt && (
                    <button
                      onClick={() => setConfirmAction({ kind: "revoke-session", sessionId: s.id })}
                      className="cc-mono rounded px-2 py-1 text-[10px] uppercase tracking-wider"
                      style={{ color: "var(--cc-red)", border: "1px solid var(--cc-border)" }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "Storage" && (
          <div className="cc-panel p-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Connected" value={storage.connected ? "Yes" : "No"} />
              <Field label="Drive Account" value={storage.accountEmail} />
              <Field label="Migration State" value={storage.migrationState.replace(/_/g, " ")} />
              <Field label="Connected At" value={storage.connectedAt ? formatDateIN(storage.connectedAt) : null} />
              <Field label="Last Attempt" value={storage.lastConnectAttemptAt ? formatDateIN(storage.lastConnectAttemptAt) : null} />
              <Field label="Last Error" value={storage.lastConnectError} />
            </div>
            <p className="cc-mono mt-4 text-[10px]" style={{ color: "var(--cc-text-faint)" }}>
              <HardDrive className="mr-1 inline h-3 w-3" /> Operational metadata only — Super Admin never has access to this user&apos;s Drive file contents.
            </p>
          </div>
        )}

        {tab === "Security" && (
          <div className="space-y-4">
            <div className="cc-panel p-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label="2FA" value={security.twoFactorEnabled ? <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" style={{ color: "var(--cc-green)" }} /> Enabled</span> : <span className="flex items-center gap-1"><ShieldOff className="h-4 w-4" /> Disabled</span>} />
                <Field label="Passkeys" value={security.passkeyCount} />
                <Field label="Failed Attempts" value={security.failedLoginAttempts} />
              </div>
            </div>
            <div className="cc-panel p-4">
              <p className="cc-mono mb-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Passkeys</p>
              {security.passkeys.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--cc-text-faint)" }}>No passkeys registered.</p>
              ) : (
                <div className="space-y-2">
                  {security.passkeys.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--cc-text-dim)" }}>
                      <Fingerprint className="h-3.5 w-3.5" /> {p.name} · {p.deviceType} · {p.lastUsedAt ? `last used ${formatDateIN(p.lastUsedAt)}` : "never used"}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="cc-panel p-4">
              <p className="cc-mono mb-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Security Actions</p>
              <p className="mb-3 text-xs" style={{ color: "var(--cc-text-faint)" }}>
                Recovery / backup-code / password-reset workflows are user-initiated and not exposed here — the platform-level actions available are the same session controls as the Sessions tab.
              </p>
              <button
                disabled={user.role === "SUPER_ADMIN"}
                onClick={() => setConfirmAction({ kind: "force-logout" })}
                className="cc-mono flex min-h-[44px] items-center gap-1.5 rounded border px-3 py-1.5 text-xs disabled:opacity-40"
                style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-dim)" }}
              >
                <KeyRound className="h-3.5 w-3.5" /> Force Logout (all devices)
              </button>
            </div>
            {currentAdmin?.role === "SUPER_ADMIN" && user.role === "USER" && (
              <AccessAsUserPanel userId={user.id} userName={user.name} toast={toast} />
            )}
          </div>
        )}

        {tab === "Access" && <EntitlementsPanel userId={user.id} toast={toast} />}

        {tab === "Notifications" && (
          <div className="space-y-2">
            {notifications.items.length === 0 ? (
              <div className="cc-panel p-6 text-center text-xs cc-mono" style={{ color: "var(--cc-text-faint)" }}>No notifications.</div>
            ) : (
              notifications.items.map((n) => (
                <div key={n.id} className="cc-panel flex items-center gap-3 p-3">
                  <Bell className="h-4 w-4" style={{ color: n.read ? "var(--cc-text-faint)" : "var(--cc-accent)" }} />
                  <div>
                    <p className="text-sm" style={{ color: "var(--cc-text)" }}>{n.title}</p>
                    <p className="cc-mono text-[10px]" style={{ color: "var(--cc-text-faint)" }}>{n.type} · {formatDateIN(n.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "Preferences" && (
          <div className="cc-panel p-4">
            <p className="cc-mono mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>
              <Settings2 className="h-3.5 w-3.5" /> UI preferences only — never financial data
            </p>
            <pre className="cc-mono overflow-x-auto whitespace-pre-wrap text-xs" style={{ color: "var(--cc-text-dim)" }}>
              {JSON.stringify({ settings: preferences.settings, profile: preferences.profile }, null, 2)}
            </pre>
          </div>
        )}

        {tab === "Activity" && <UserActivityPanel userId={user.id} userName={user.name} />}
      </main>

      {confirmAction?.kind === "force-logout" && (
        <AdminActionConfirm
          title={`Force logout ${user.name}`}
          targetLabel={`${user.name} (${user.email})`}
          explanation="Immediately signs this account out of every active session and revokes all their tracked devices."
          confirmLabel="Force logout"
          onClose={() => setConfirmAction(null)}
          toast={toast}
          onDone={() => queryClient.invalidateQueries({ queryKey: ["admin-user-detail", params.id] })}
          onConfirm={() => api.post<{ ok: boolean; message: string }>(`/api/admin/users/${user.id}/force-logout`)}
        />
      )}
      {confirmAction?.kind === "revoke-session" && (
        <AdminActionConfirm
          title="Revoke session"
          targetLabel={`${user.name} (${user.email})`}
          explanation="Immediately signs out this one device. The account's other active sessions are not affected."
          danger
          confirmLabel="Revoke"
          onClose={() => setConfirmAction(null)}
          toast={toast}
          onDone={() => queryClient.invalidateQueries({ queryKey: ["admin-user-detail", params.id] })}
          onConfirm={() =>
            api.post<{ ok: boolean; message: string }>(
              `/api/admin/users/${user.id}/sessions/${(confirmAction as { kind: "revoke-session"; sessionId: string }).sessionId}/revoke`
            )
          }
        />
      )}
      {confirmAction?.kind === "status" && (
        <AdminActionConfirm
          title={confirmAction.status === "ACTIVE" ? `Activate ${user.name}` : `Suspend ${user.name}`}
          targetLabel={`${user.name} (${user.email})`}
          explanation={
            confirmAction.status === "ACTIVE"
              ? "Restores this account to Active — it can sign in and use the platform again immediately."
              : "Immediately blocks this account from signing in or making any authenticated request, and signs out its active sessions."
          }
          danger={confirmAction.status === "SUSPENDED"}
          confirmLabel={confirmAction.status === "ACTIVE" ? "Activate" : "Suspend account"}
          onClose={() => setConfirmAction(null)}
          toast={toast}
          onDone={() => queryClient.invalidateQueries({ queryKey: ["admin-user-detail", params.id] })}
          onConfirm={() => api.patch<{ ok: boolean; message: string }>(`/api/auth/users/${user.id}`, { status: confirmAction.status })}
        />
      )}
      {editing && (
        <EditUserModal
          user={{ id: user.id, uid: user.uid, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status as ManagedUser["status"], createdAt: user.createdAt, twoFactorEnabled: user.twoFactorEnabled }}
          busy={busy}
          setBusy={setBusy}
          onClose={() => setEditing(false)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ["admin-user-detail", params.id] })}
          toast={toast}
        />
      )}
    </>
  );
}
