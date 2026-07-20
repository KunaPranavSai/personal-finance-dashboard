"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";

import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ExportPreviewModal } from "@/components/ui/ExportPreviewModal";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useToast } from "@/components/ui/Toast";
import { Settings as SettingsIcon, Palette, Globe, Bell, Shield, Download, Database, Eye, Sliders, Save, Copy, Check, History, KeyRound, Users, UserCheck, UserX, Mail, Phone, Clock, CheckCircle, MoreVertical, Pencil, RotateCcw, IdCard, HardDrive, Trash2 } from "lucide-react";
import { cn } from "@/lib/format";
import { CURRENCIES, DATE_FORMATS, WEEK_START_OPTIONS, LANGUAGES, TIMEZONES } from "@/lib/reference";

const TABS = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "currency", label: "Currency & Format", icon: Globe },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "activity", label: "Activity", icon: History },
  { id: "export", label: "Data Export", icon: Download },
  { id: "backup", label: "Backup", icon: Database },
  { id: "privacy", label: "Privacy", icon: Eye },
  { id: "preferences", label: "Preferences", icon: Sliders },
];

const DEFAULT_DASHBOARDS = [
  { value: "dashboard", label: "Main Dashboard" },
  { value: "transactions", label: "Transactions" },
  { value: "analytics", label: "Analytics" },
];

const STARTUP_OPTIONS = [
  { value: "last-viewed", label: "Last Viewed Page" },
  { value: "dashboard", label: "Dashboard" },
  { value: "transactions", label: "Transactions" },
];

const NUMBER_FORMATS = [
  { value: "1,234.56", label: "1,234.56" },
  { value: "1.234,56", label: "1.234,56" },
  { value: "1 234,56", label: "1 234,56" },
];

const REMINDER_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const FIRST_DAY_OPTIONS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
  { value: "saturday", label: "Saturday" },
];

const AUTO_LOCK_OPTIONS = [
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "never", label: "Never" },
];

function ExportTab() {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <Card>
      <CardHeader><CardTitle>Data Export &amp; Backup</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-navy/60 dark:text-white/60">
          Preview what will be included, then download your financial data in CSV, Excel, JSON, or PDF.
        </p>
        <Button type="button" onClick={() => setPreviewOpen(true)}>
          <Download className="h-4 w-4" /> Export data
        </Button>
        <div className="rounded-lg border border-black/5 bg-black/2 p-3 dark:border-white/5 dark:bg-white/2">
          <p className="text-xs text-navy/40 dark:text-white/40">
            Exports include transactions, budgets, investments, bills, goals, accounts, and categories.
          </p>
        </div>
      </CardContent>
      <ExportPreviewModal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} />
    </Card>
  );
}

function TwoFactorSection() {
  const { twoFactorEnabled, setupTwoFactor, confirmTwoFactor, disableTwoFactor } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<"idle" | "qr" | "backup" | "disable">("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justVerified, setJustVerified] = useState(false);
  const [justDisabled, setJustDisabled] = useState(false);

  const startSetup = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const data = await setupTwoFactor();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("qr");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start setup");
    } finally {
      setBusy(false);
    }
  }, [setupTwoFactor]);

  const handleConfirm = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const data = await confirmTwoFactor(code.trim());
      setJustVerified(true);
      setTimeout(() => {
        setBackupCodes(data.backupCodes);
        setStep("backup");
        setCode("");
        setJustVerified(false);
      }, 700);
      toast("Two-factor authentication enabled", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }, [code, confirmTwoFactor, toast]);

  const handleDisable = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      await disableTwoFactor(disablePassword, disableCode.trim());
      setJustDisabled(true);
      setTimeout(() => {
        setStep("idle");
        setDisablePassword("");
        setDisableCode("");
        setJustDisabled(false);
      }, 700);
      toast("Two-factor authentication disabled", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setBusy(false);
    }
  }, [disablePassword, disableCode, disableTwoFactor, toast]);

  const copyBackupCodes = useCallback(() => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [backupCodes]);

  if (step === "backup") {
    return (
      <div className="rounded-lg border border-black/5 p-4 space-y-3 dark:border-white/10">
        <p className="text-sm font-semibold text-navy dark:text-white">Save your backup codes</p>
        <p className="text-xs text-navy/50 dark:text-white/50">Each code can be used once if you lose access to your authenticator app. Store them somewhere safe — they won&apos;t be shown again.</p>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-black/5 p-3 font-mono text-sm dark:bg-white/5">
          {backupCodes.map((c) => <span key={c}>{c}</span>)}
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={copyBackupCodes}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy codes"}
        </Button>
        <Button type="button" size="sm" onClick={() => setStep("idle")}>Done</Button>
      </div>
    );
  }

  if (step === "qr") {
    return (
      <div className="rounded-lg border border-black/5 p-4 space-y-3 dark:border-white/10">
        <p className="text-sm font-semibold text-navy dark:text-white">Scan this QR code</p>
        <p className="text-xs text-navy/50 dark:text-white/50">Use Google Authenticator, Microsoft Authenticator, Authy, or 2FAS to scan the code below, or enter the key manually.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrCode} alt="2FA QR code" className="h-40 w-40 rounded-lg bg-white p-2" />
        <p className="break-all rounded-lg bg-black/5 p-2 font-mono text-xs dark:bg-white/5">{secret}</p>
        <div>
          <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Enter the 6-digit code from your app</label>
          <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
        </div>
        {justVerified ? (
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 text-sm font-medium text-teal"
          >
            <CheckCircle className="h-4 w-4" /> Verified — enabling 2FA…
          </motion.p>
        ) : error ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: [0, -8, 8, -6, 6, -2, 2, 0] }}
            transition={{ duration: 0.4 }}
            className="text-xs text-red-500"
          >
            {error}
          </motion.p>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleConfirm} disabled={busy || !code}>{busy ? "Verifying…" : "Verify & Enable"}</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setStep("idle")}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (step === "disable") {
    return (
      <div className="rounded-lg border border-black/5 p-4 space-y-3 dark:border-white/10">
        <p className="text-sm font-semibold text-navy dark:text-white">Disable Two-Factor Authentication</p>
        <div>
          <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Password</label>
          <PasswordInput value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Verification code</label>
          <input type="text" inputMode="numeric" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="123456" className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
        </div>
        {justDisabled ? (
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 text-sm font-medium text-teal"
          >
            <CheckCircle className="h-4 w-4" /> 2FA disabled
          </motion.p>
        ) : error ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: [0, -8, 8, -6, 6, -2, 2, 0] }}
            transition={{ duration: 0.4 }}
            className="text-xs text-red-500"
          >
            {error}
          </motion.p>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleDisable} disabled={busy || !disablePassword || !disableCode}>{busy ? "Disabling…" : "Disable 2FA"}</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setStep("idle")}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-navy dark:text-white">Two-Factor Authentication</p>
        <p className="text-xs text-navy/50">{twoFactorEnabled ? "Enabled — your account requires a code at sign-in" : "Add an extra layer of security"}</p>
      </div>
      {twoFactorEnabled ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => setStep("disable")}>Disable</Button>
      ) : (
        <Button type="button" size="sm" onClick={startSetup} disabled={busy}>{busy ? "Starting…" : "Enable"}</Button>
      )}
    </div>
  );
}

function ChangeUidSection() {
  const { user, changeUid } = useAuth();
  const { toast } = useToast();
  const [newUid, setNewUid] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleChange = useCallback(async () => {
    setError("");
    if (!/^[a-zA-Z0-9_.@-]{4,50}$/.test(newUid.trim())) {
      setError("UID must be 4-50 characters (letters, numbers, _ . @ -)");
      return;
    }
    setBusy(true);
    try {
      await changeUid(password, newUid.trim());
      setNewUid("");
      setPassword("");
      toast("User ID changed successfully", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change UID");
    } finally {
      setBusy(false);
    }
  }, [newUid, password, changeUid, toast]);

  return (
    <div className="rounded-lg border border-black/5 p-4 space-y-3 dark:border-white/10">
      <p className="text-sm font-semibold text-navy dark:text-white">Change User ID</p>
      <p className="text-xs text-navy/50 dark:text-white/50">Current User ID: <span className="font-mono font-semibold">{user?.uid}</span></p>
      <div>
        <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">New User ID</label>
        <input type="text" value={newUid} onChange={(e) => setNewUid(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" placeholder="New User ID" />
      </div>
      <div>
        <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Confirm with Password</label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" placeholder="Current password" />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button type="button" size="sm" onClick={handleChange} disabled={busy || !newUid || !password}>{busy ? "Changing…" : "Change User ID"}</Button>
    </div>
  );
}

interface ActivityItem {
  id: string;
  event: string;
  detail?: string | null;
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  createdAt: string;
}

const EVENT_LABELS: Record<string, string> = {
  password_changed: "Password changed",
  password_reset: "Password reset",
  password_reset_requested: "Reset code requested",
  password_reset_failed: "Failed password reset",
  uid_changed: "User ID changed",
  uid_change_failed: "Failed UID change",
  "2fa_enabled": "2FA enabled",
  "2fa_disabled": "2FA disabled",
  user_updated: "Account updated by admin",
  password_reset_by_admin: "Password reset by admin",
  uid_reset_by_admin: "UID reset by admin",
  user_approved: "Account approved",
  user_rejected: "Account rejected",
  user_deleted: "Account deleted",
};

function ActivityTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["activity", page],
    queryFn: () => api.get<{ items: ActivityItem[]; pagination: { page: number; totalPages: number; total: number } }>(`/api/activity?page=${page}&pageSize=25`),
  });

  const items = data?.items ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <Card>
      <CardHeader><CardTitle>Account Activity</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-navy/50 dark:text-white/50">No activity recorded yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                    <th className="pb-2 pr-3 font-medium">Event</th>
                    <th className="pb-2 pr-3 font-medium">Time</th>
                    <th className="pb-2 pr-3 font-medium">IP</th>
                    <th className="pb-2 pr-3 font-medium">Browser</th>
                    <th className="pb-2 pr-3 font-medium">OS</th>
                    <th className="pb-2 font-medium">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id} className="border-b border-black/5 dark:border-white/5">
                      <td className="py-2 pr-3">
                        <span className="font-medium text-navy dark:text-white">{EVENT_LABELS[a.event] ?? a.event}</span>
                        {a.detail && <span className="block text-xs text-navy/40 dark:text-white/40">{a.detail}</span>}
                      </td>
                      <td className="py-2 pr-3 text-navy/70 dark:text-white/70 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-navy/60 dark:text-white/60">{a.ip ?? "—"}</td>
                      <td className="py-2 pr-3 text-navy/60 dark:text-white/60">{a.browser ?? "—"}</td>
                      <td className="py-2 pr-3 text-navy/60 dark:text-white/60">{a.os ?? "—"}</td>
                      <td className="py-2 text-navy/60 dark:text-white/60">{a.device ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <Button type="button" size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
                <span className="text-navy/50 dark:text-white/50">Page {page} of {totalPages}</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ManagedUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  createdAt: string;
  approvedAt?: string | null;
}

interface UsageCounts {
  transactions: number; budgets: number; investments: number; bills: number; goals: number;
  categories: number; accounts: number; paymentMethods: number; notifications: number; activityLogs: number;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ACTIVE: "bg-teal/10 text-teal",
  REJECTED: "bg-red-500/10 text-red-500",
  SUSPENDED: "bg-navy/10 text-navy/60 dark:bg-white/10 dark:text-white/60",
};

const USAGE_LABELS: Record<keyof UsageCounts, string> = {
  transactions: "Transactions", budgets: "Budgets", investments: "Investments", bills: "Bills", goals: "Goals",
  categories: "Categories", accounts: "Accounts", paymentMethods: "Payment Methods", notifications: "Notifications", activityLogs: "Activity Log Entries",
};

function ModalShell({ onClose, children, maxWidth = "max-w-sm" }: { onClose: () => void; children: React.ReactNode; maxWidth?: string }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={cn("w-full rounded-2xl bg-white p-6 shadow-2xl dark:bg-navy-dark", maxWidth)}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

type ModalState =
  | { type: "approve"; user: ManagedUser }
  | { type: "reject"; user: ManagedUser }
  | { type: "edit"; user: ManagedUser }
  | { type: "reset-password"; user: ManagedUser }
  | { type: "reset-uid"; user: ManagedUser }
  | { type: "usage"; user: ManagedUser }
  | { type: "delete"; user: ManagedUser }
  | null;

function UserManagementTab() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: pending, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["users-pending"],
    queryFn: () => api.get<{ items: ManagedUser[] }>("/api/auth/users/pending"),
  });

  const { data: allUsers, isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ["users-all"],
    queryFn: () => api.get<{ items: ManagedUser[] }>("/api/auth/users"),
  });

  const refetchBoth = useCallback(() => {
    refetchPending();
    refetchAll();
  }, [refetchPending, refetchAll]);

  const closeModal = useCallback(() => setModal(null), []);

  const pendingItems = pending?.items ?? [];
  const allItems = allUsers?.items ?? [];
  const superAdminCount = allItems.filter((u) => u.role === "SUPER_ADMIN").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Pending Approvals</CardTitle></CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
          ) : pendingItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-navy/50 dark:text-white/50">No accounts awaiting approval.</p>
          ) : (
            <div className="space-y-3">
              {pendingItems.map((u) => (
                <div key={u.id} className="flex flex-col gap-3 rounded-lg border border-black/5 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy dark:text-white">{u.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy/50 dark:text-white/50">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</span>
                      {u.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" size="sm" onClick={() => setModal({ type: "approve", user: u })}>
                      <UserCheck className="h-4 w-4" /> Approve
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setModal({ type: "reject", user: u })}>
                      <UserX className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
        <CardContent>
          {allLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
          ) : allItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-navy/50 dark:text-white/50">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/10 text-left text-navy/50 dark:text-white/50">
                    <th className="pb-2 pr-3 font-medium">Name</th>
                    <th className="pb-2 pr-3 font-medium">Email</th>
                    <th className="pb-2 pr-3 font-medium">Role</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Registered</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map((u) => {
                    const isSelf = u.uid === currentUser?.uid;
                    const isLastSuperAdmin = u.role === "SUPER_ADMIN" && superAdminCount <= 1;
                    return (
                      <tr key={u.id} className="border-b border-black/5 dark:border-white/5">
                        <td className="py-2 pr-3 font-medium text-navy dark:text-white">{u.name}{isSelf && <span className="ml-1.5 text-xs text-navy/40 dark:text-white/40">(you)</span>}</td>
                        <td className="py-2 pr-3 text-navy/70 dark:text-white/70">{u.email}</td>
                        <td className="py-2 pr-3 text-navy/60 dark:text-white/60">{u.role.replace("_", " ")}</td>
                        <td className="py-2 pr-3">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[u.status])}>{u.status}</span>
                        </td>
                        <td className="py-2 pr-3 text-navy/60 dark:text-white/60 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="py-2 text-right relative">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                            className="rounded-lg p-1.5 text-navy/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
                            aria-label="Row actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {openMenuId === u.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-8 z-50 w-44 overflow-hidden rounded-xl border border-black/5 bg-white shadow-lg dark:border-white/10 dark:bg-navy-dark">
                                <button type="button" onClick={() => { setModal({ type: "edit", user: u }); setOpenMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5">
                                  <Pencil className="h-3.5 w-3.5" /> Edit details
                                </button>
                                <button type="button" onClick={() => { setModal({ type: "reset-password", user: u }); setOpenMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5">
                                  <RotateCcw className="h-3.5 w-3.5" /> Reset password
                                </button>
                                <button type="button" onClick={() => { setModal({ type: "reset-uid", user: u }); setOpenMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5">
                                  <IdCard className="h-3.5 w-3.5" /> Reset UID
                                </button>
                                <button type="button" onClick={() => { setModal({ type: "usage", user: u }); setOpenMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5">
                                  <HardDrive className="h-3.5 w-3.5" /> View storage used
                                </button>
                                <button
                                  type="button"
                                  disabled={isSelf || isLastSuperAdmin}
                                  onClick={() => { setModal({ type: "delete", user: u }); setOpenMenuId(null); }}
                                  className="flex w-full items-center gap-2 border-t border-black/5 px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete account
                                </button>
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {modal?.type === "approve" && (
        <ApproveModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} onDone={refetchBoth} toast={toast} />
      )}
      {modal?.type === "reject" && (
        <RejectModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} onDone={refetchBoth} toast={toast} />
      )}
      {modal?.type === "edit" && (
        <EditUserModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} onDone={refetchBoth} toast={toast} />
      )}
      {modal?.type === "reset-password" && (
        <ResetPasswordModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} toast={toast} />
      )}
      {modal?.type === "reset-uid" && (
        <ResetUidModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} onDone={refetchBoth} toast={toast} />
      )}
      {modal?.type === "usage" && (
        <UsageModal user={modal.user} onClose={closeModal} />
      )}
      {modal?.type === "delete" && (
        <DeleteUserModal user={modal.user} busy={busy} setBusy={setBusy} onClose={closeModal} onDone={refetchBoth} toast={toast} />
      )}
    </div>
  );
}

type ToastFn = (msg: string, type: "success" | "error") => void;
interface UserModalProps {
  user: ManagedUser;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onClose: () => void;
  toast: ToastFn;
}

function ApproveModal({ user, busy, setBusy, onClose, onDone, toast }: UserModalProps & { onDone: () => void }) {
  const [uid, setUid] = useState(user.email);
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ emailSent: boolean; password?: string } | null>(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const data = await api.get<{ password: string }>("/api/auth/users/generate-temp-password");
      setPassword(data.password);
    } catch {
      toast("Failed to generate password", "error");
    } finally {
      setGenerating(false);
    }
  }, [toast]);

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api.post<{ ok: boolean; emailSent: boolean; password?: string; message: string }>(`/api/auth/users/${user.id}/approve`, { uid, password: password || undefined, sendEmail });
      setResult({ emailSent: data.emailSent, password: data.password });
      toast(data.message, data.emailSent ? "success" : "error");
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to approve user", "error");
    } finally {
      setBusy(false);
    }
  }, [user.id, uid, password, sendEmail, setBusy, toast, onDone]);

  if (result) {
    return (
      <ModalShell onClose={onClose}>
        <div className="text-center">
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal/10">
            {result.emailSent ? <CheckCircle className="h-7 w-7 text-teal" /> : <Shield className="h-7 w-7 text-amber-500" />}
          </motion.div>
          <p className="mt-3 text-sm font-semibold text-navy dark:text-white">{user.name} approved</p>
          {result.emailSent ? (
            <p className="mt-1 text-xs text-navy/50 dark:text-white/50">Credentials were emailed to {user.email}.</p>
          ) : (
            <div className="mt-3 space-y-2 text-left">
              <p className="text-xs text-amber-600 dark:text-amber-400">Email delivery failed or was skipped — share these credentials with the user directly.</p>
              <p className="rounded-lg bg-black/5 p-2 font-mono text-xs dark:bg-white/5">UID: {uid}<br />Password: {result.password}</p>
            </div>
          )}
          <Button type="button" size="sm" className="mt-4 w-full" onClick={onClose}>Done</Button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <p className="text-sm font-semibold text-navy dark:text-white">Approve {user.name}</p>
      <p className="mt-1 text-xs text-navy/50 dark:text-white/50">Create their sign-in credentials before sending the welcome email.</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">User ID</label>
          <input value={uid} onChange={(e) => setUid(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Temporary Password</label>
          <div className="flex gap-2">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to auto-generate" className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
            <Button type="button" size="sm" variant="secondary" onClick={generate} disabled={generating}>{generating ? "…" : "Generate"}</Button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy dark:text-white">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
          Send credentials to {user.email}
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" size="sm" onClick={submit} disabled={busy || !uid}>{busy ? "Approving…" : "Approve"}</Button>
      </div>
    </ModalShell>
  );
}

function RejectModal({ user, busy, setBusy, onClose, onDone, toast }: UserModalProps & { onDone: () => void }) {
  const [reason, setReason] = useState("");

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      await api.post(`/api/auth/users/${user.id}/reject`, { reason: reason.trim() || undefined });
      toast(`${user.name} rejected`, "success");
      onDone();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to reject user", "error");
    } finally {
      setBusy(false);
    }
  }, [user, reason, setBusy, toast, onDone, onClose]);

  return (
    <ModalShell onClose={onClose}>
      <p className="text-sm font-semibold text-navy dark:text-white">Reject {user.name}?</p>
      <p className="mt-1 text-xs text-navy/50 dark:text-white/50">Optionally include a reason — it will be sent to the applicant by email.</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason (optional)" className="mt-3 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" size="sm" onClick={submit} disabled={busy}>{busy ? "Rejecting…" : "Reject"}</Button>
      </div>
    </ModalShell>
  );
}

function EditUserModal({ user, busy, setBusy, onClose, onDone, toast }: UserModalProps & { onDone: () => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api.patch<{ ok: boolean; message: string }>(`/api/auth/users/${user.id}`, { name, email, phone, role, status });
      toast(data.message, "success");
      onDone();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update user", "error");
    } finally {
      setBusy(false);
    }
  }, [user.id, name, email, phone, role, status, setBusy, toast, onDone, onClose]);

  return (
    <ModalShell onClose={onClose}>
      <p className="text-sm font-semibold text-navy dark:text-white">Edit {user.name}</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as ManagedUser["role"])} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ManagedUser["status"])} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" size="sm" onClick={submit} disabled={busy || !name || !email}>{busy ? "Saving…" : "Save changes"}</Button>
      </div>
    </ModalShell>
  );
}

function ResetPasswordModal({ user, busy, setBusy, onClose, toast }: UserModalProps) {
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ emailSent: boolean; password?: string } | null>(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const data = await api.get<{ password: string }>("/api/auth/users/generate-temp-password");
      setPassword(data.password);
    } catch {
      toast("Failed to generate password", "error");
    } finally {
      setGenerating(false);
    }
  }, [toast]);

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api.post<{ ok: boolean; emailSent: boolean; password?: string }>(`/api/auth/users/${user.id}/reset-password`, { password: password || undefined, sendEmail });
      setResult(data);
      toast(data.emailSent ? "Password reset and emailed" : "Password reset", data.emailSent ? "success" : "error");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to reset password", "error");
    } finally {
      setBusy(false);
    }
  }, [user.id, password, sendEmail, setBusy, toast]);

  if (result) {
    return (
      <ModalShell onClose={onClose}>
        <div className="text-center">
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal/10">
            <CheckCircle className="h-7 w-7 text-teal" />
          </motion.div>
          <p className="mt-3 text-sm font-semibold text-navy dark:text-white">Password reset for {user.name}</p>
          {!result.emailSent && (
            <p className="mt-2 rounded-lg bg-black/5 p-2 font-mono text-xs dark:bg-white/5">New password: {result.password}</p>
          )}
          <Button type="button" size="sm" className="mt-4 w-full" onClick={onClose}>Done</Button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <p className="text-sm font-semibold text-navy dark:text-white">Reset password for {user.name}</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">New Password</label>
          <div className="flex gap-2">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to auto-generate" className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
            <Button type="button" size="sm" variant="secondary" onClick={generate} disabled={generating}>{generating ? "…" : "Generate"}</Button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy dark:text-white">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
          Send new password to {user.email}
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" size="sm" onClick={submit} disabled={busy}>{busy ? "Resetting…" : "Reset password"}</Button>
      </div>
    </ModalShell>
  );
}

function ResetUidModal({ user, busy, setBusy, onClose, onDone, toast }: UserModalProps & { onDone: () => void }) {
  const [uid, setUid] = useState(user.uid);
  const [sendEmail, setSendEmail] = useState(true);

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      await api.post(`/api/auth/users/${user.id}/reset-uid`, { uid, sendEmail });
      toast("UID updated", "success");
      onDone();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to reset UID", "error");
    } finally {
      setBusy(false);
    }
  }, [user.id, uid, sendEmail, setBusy, toast, onDone, onClose]);

  return (
    <ModalShell onClose={onClose}>
      <p className="text-sm font-semibold text-navy dark:text-white">Reset UID for {user.name}</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">New User ID</label>
          <input value={uid} onChange={(e) => setUid(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
        </div>
        <label className="flex items-center gap-2 text-sm text-navy dark:text-white">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
          Notify {user.email} of the change
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" size="sm" onClick={submit} disabled={busy || !uid}>{busy ? "Saving…" : "Reset UID"}</Button>
      </div>
    </ModalShell>
  );
}

function UsageModal({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["user-usage", user.id],
    queryFn: () => api.get<{ counts: UsageCounts; createdAt: string; approvedAt?: string | null }>(`/api/auth/users/${user.id}/usage`),
  });

  return (
    <ModalShell onClose={onClose}>
      <p className="text-sm font-semibold text-navy dark:text-white">Storage used by {user.name}</p>
      {isLoading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 animate-pulse rounded bg-black/5 dark:bg-white/5" />)}</div>
      ) : data ? (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {(Object.keys(USAGE_LABELS) as (keyof UsageCounts)[]).map((k) => (
            <div key={k} className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-1.5 dark:bg-white/5">
              <span className="text-navy/60 dark:text-white/60">{USAGE_LABELS[k]}</span>
              <span className="font-semibold text-navy dark:text-white">{data.counts[k]}</span>
            </div>
          ))}
        </div>
      ) : null}
      <Button type="button" size="sm" className="mt-5 w-full" variant="secondary" onClick={onClose}>Close</Button>
    </ModalShell>
  );
}

function DeleteUserModal({ user, busy, setBusy, onClose, onDone, toast }: UserModalProps & { onDone: () => void }) {
  const submit = useCallback(async () => {
    setBusy(true);
    try {
      await api.delete(`/api/auth/users/${user.id}`);
      toast(`${user.name}'s account has been permanently deleted`, "success");
      onDone();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete user", "error");
    } finally {
      setBusy(false);
    }
  }, [user, setBusy, toast, onDone, onClose]);

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
          <Trash2 className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-navy dark:text-white">Permanently delete {user.name}?</p>
          <p className="mt-1 text-xs text-navy/50 dark:text-white/50">This removes their account and all associated data (transactions, budgets, etc.) immediately. This cannot be undone.</p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" size="sm" variant="danger" onClick={submit} disabled={busy}>{busy ? "Deleting…" : "Delete permanently"}</Button>
      </div>
    </ModalShell>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const { settings, updateSettings, isLoading, isSaving } = useSettingsContext();
  const { toast } = useToast();
  const { user, changePassword } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const tabs = isAdmin ? [...TABS, { id: "users", label: "User Management", icon: Users }] : TABS;
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "general");
  const [localSettings, setLocalSettings] = useState<Record<string, unknown>>({});
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwChanging, setPwChanging] = useState(false);

  const handlePasswordChange = useCallback(async () => {
    setPwError("");
    if (pwForm.next !== pwForm.confirm) { setPwError("New passwords do not match"); return; }
    if (pwForm.next.length < 8) { setPwError("Password must be at least 8 characters"); return; }
    setPwChanging(true);
    try {
      await changePassword(pwForm.current, pwForm.next);
      setPwForm({ current: "", next: "", confirm: "" });
      toast("Password changed successfully", "success");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setPwChanging(false);
    }
  }, [pwForm, changePassword, toast]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    setLocalSettings(settings as unknown as Record<string, unknown>);
  }, [settings]);

  const handleChange = useCallback((key: string, value: unknown) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleNestedChange = useCallback((section: string, key: string, value: unknown) => {
    setLocalSettings((prev) => ({
      ...prev,
      [section]: { ...((prev[section] as Record<string, unknown>) ?? {}), [key]: value },
    }));
  }, []);

  const handleSave = useCallback(() => {
    updateSettings(localSettings);
    toast("Settings saved successfully", "success");
  }, [localSettings, updateSettings, toast]);

  const s = localSettings as Record<string, unknown>;
  const notifs = (s.notifications as Record<string, unknown>) ?? {};
  const sec = (s.security as Record<string, unknown>) ?? {};
  const exp = (s.export as Record<string, unknown>) ?? {};
  const backup = (s.backup as Record<string, unknown>) ?? {};
  const priv = (s.privacy as Record<string, unknown>) ?? {};
  const pref = (s.preferences as Record<string, unknown>) ?? {};

  const renderTab = () => {
    switch (activeTab) {
      case "general":
        return (
          <Card>
            <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Application Name</label>
                <input type="text" value={String(s.applicationName ?? "")} onChange={(e) => handleChange("applicationName", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Default Dashboard</label>
                  <select value={String(s.defaultDashboard ?? "dashboard")} onChange={(e) => handleChange("defaultDashboard", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {DEFAULT_DASHBOARDS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Startup Preference</label>
                  <select value={String(s.startupPreferences ?? "last-viewed")} onChange={(e) => handleChange("startupPreferences", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {STARTUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Date Format</label>
                  <select value={String(s.dateFormat ?? "DD-MM-YYYY")} onChange={(e) => handleChange("dateFormat", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Time Format</label>
                  <select value={String(s.timeFormat ?? "24h")} onChange={(e) => handleChange("timeFormat", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    <option value="24h">24-Hour</option>
                    <option value="12h">12-Hour (AM/PM)</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Timezone</label>
                  <select value={String(s.timezone ?? "Asia/Kolkata")} onChange={(e) => handleChange("timezone", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">First Day of Week</label>
                  <select value={String(s.firstDayOfWeek ?? "monday")} onChange={(e) => handleChange("firstDayOfWeek", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {FIRST_DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Language</label>
                  <select value={String(s.language ?? "en")} onChange={(e) => handleChange("language", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "appearance":
        return (
          <Card>
            <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  {["light", "dark", "system"].map((t) => (
                    <button key={t} onClick={() => handleChange("theme", t)}
                      className={cn("flex items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                        s.theme === t ? "border-teal bg-teal/10 text-teal" : "border-black/10 text-navy/60 hover:bg-black/5 dark:border-white/10 dark:text-white/60"
                      )}>
                      {t === "light" ? "☀️ Light" : t === "dark" ? "🌙 Dark" : "💻 System"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-navy/40 dark:text-white/40">Changes apply instantly. No refresh needed.</p>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "currency":
        return (
          <Card>
            <CardHeader><CardTitle>Currency & Region</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Currency</label>
                  <select value={String(s.currency ?? "INR")} onChange={(e) => { handleChange("currency", e.target.value); handleChange("currencySymbol", e.target.value); }} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-navy/40 dark:text-white/40">All monetary values update instantly across the app.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Currency Symbol</label>
                  <input type="text" value={String(s.currencySymbol ?? s.currency ?? "INR")} onChange={(e) => handleChange("currencySymbol", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Number Format</label>
                  <select value={String(s.numberFormat ?? "1,234.56")} onChange={(e) => handleChange("numberFormat", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {NUMBER_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">First Day of Week</label>
                  <select value={String(s.firstDayOfWeek ?? "monday")} onChange={(e) => handleChange("firstDayOfWeek", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {FIRST_DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Timezone</label>
                  <select value={String(s.timezone ?? "Asia/Kolkata")} onChange={(e) => handleChange("timezone", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Date Format</label>
                  <select value={String(s.dateFormat ?? "DD-MM-YYYY")} onChange={(e) => handleChange("dateFormat", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Time Format</label>
                  <select value={String(s.timeFormat ?? "24h")} onChange={(e) => handleChange("timeFormat", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                    <option value="24h">24-Hour</option>
                    <option value="12h">12-Hour (AM/PM)</option>
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "notifications":
        return (
          <Card>
            <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { key: "email", label: "Email Notifications" },
                  { key: "push", label: "Push / Browser Notifications" },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={Boolean(notifs[opt.key] ?? false)} onChange={(e) => handleNestedChange("notifications", opt.key, e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                    <span className="text-sm text-navy dark:text-white">{opt.label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Reminder Frequency</label>
                <select value={String(notifs.reminderFrequency ?? "daily")} onChange={(e) => handleNestedChange("notifications", "reminderFrequency", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                  {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-3 pt-2 border-t border-black/5 dark:border-white/10">
                <p className="text-xs font-medium text-navy/50 dark:text-white/50">Alert Preferences</p>
                {[
                  { key: "budgetAlerts", label: "Budget Alerts" },
                  { key: "goalUpdates", label: "Goal Progress Alerts" },
                  { key: "billReminders", label: "Bill Reminders" },
                  { key: "insights", label: "Insights & Tips" },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={Boolean(notifs[opt.key] ?? false)} onChange={(e) => handleNestedChange("notifications", opt.key, e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                    <span className="text-sm text-navy dark:text-white">{opt.label}</span>
                  </label>
                ))}
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "security":
        return (
          <Card>
            <CardHeader><CardTitle>Security Settings</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Change Password */}
              <div className="rounded-lg border border-black/5 p-4 space-y-3 dark:border-white/10">
                <p className="text-sm font-semibold text-navy dark:text-white">Change Password</p>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Current Password</label>
                  <PasswordInput value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" placeholder="Current password" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">New Password</label>
                  <PasswordInput value={pwForm.next} onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" placeholder="New password (min 8 chars)" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Confirm New Password</label>
                  <PasswordInput value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" placeholder="Confirm new password" />
                </div>
                {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" size="sm" onClick={handlePasswordChange} disabled={pwChanging || !pwForm.current || !pwForm.next || !pwForm.confirm}>{pwChanging ? "Changing…" : "Change Password"}</Button>
                  <Link href="/forgot-password" className="flex items-center gap-1.5 text-xs font-medium text-teal hover:underline">
                    <KeyRound className="h-3.5 w-3.5" /> Forgot password?
                  </Link>
                </div>
              </div>
              <ChangeUidSection />
              <TwoFactorSection />
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Session Timeout (minutes)</label>
                <input type="number" value={Number(sec.sessionTimeout ?? 30)} onChange={(e) => handleNestedChange("security", "sessionTimeout", Number(e.target.value))} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" min={1} />
              </div>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Auto Lock</label>
                {(() => {
                  const autoLockValue = String(sec.autoLock ?? "15");
                  const isPreset = AUTO_LOCK_OPTIONS.some((o) => o.value === autoLockValue);
                  return (
                    <>
                      <select
                        value={isPreset ? autoLockValue : "custom"}
                        onChange={(e) => handleNestedChange("security", "autoLock", e.target.value === "custom" ? "10" : e.target.value)}
                        className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white"
                      >
                        {AUTO_LOCK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        <option value="custom">Custom…</option>
                      </select>
                      {!isPreset && (
                        <input
                          type="number"
                          min={1}
                          value={Number(autoLockValue) || 1}
                          onChange={(e) => handleNestedChange("security", "autoLock", String(Math.max(1, Number(e.target.value))))}
                          placeholder="Minutes"
                          className="mt-2 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
                        />
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );

      case "activity":
        return <ActivityTab />;

      case "users":
        return isAdmin ? <UserManagementTab /> : null;

      case "export":
        return (
          <ExportTab />
        );
      case "backup":
        return (
          <Card>
            <CardHeader><CardTitle>Backup Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(backup.autoBackup ?? false)} onChange={(e) => handleNestedChange("backup", "autoBackup", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Automatic Backup</span>
              </label>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Backup Frequency</label>
                <select value={String(backup.backupFrequency ?? "weekly")} onChange={(e) => handleNestedChange("backup", "backupFrequency", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <p className="text-xs text-navy/40 dark:text-white/40">
                To download a backup now, use <button type="button" onClick={() => setActiveTab("export")} className="font-medium text-teal hover:underline">Data Export &amp; Backup</button>.
              </p>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "privacy":
        return (
          <Card>
            <CardHeader><CardTitle>Privacy Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(priv.shareAnonymousData ?? true)} onChange={(e) => handleNestedChange("privacy", "shareAnonymousData", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Share anonymous usage data to improve the app</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(priv.analytics ?? true)} onChange={(e) => handleNestedChange("privacy", "analytics", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Analytics</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(priv.crashReporting ?? true)} onChange={(e) => handleNestedChange("privacy", "crashReporting", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Crash Reporting</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(priv.tracking ?? true)} onChange={(e) => handleNestedChange("privacy", "tracking", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Tracking</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={Boolean(priv.showInSuggestions ?? false)} onChange={(e) => handleNestedChange("privacy", "showInSuggestions", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                <span className="text-sm text-navy dark:text-white">Show my profile in community suggestions</span>
              </label>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "preferences":
        return (
          <Card>
            <CardHeader><CardTitle>Application Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Default Dashboard</label>
                <select value={String(pref.defaultCharts ?? "income-expense")} onChange={(e) => handleNestedChange("preferences", "defaultCharts", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                  <option value="income-expense">Income vs Expense</option>
                  <option value="category-breakdown">Category Breakdown</option>
                  <option value="net-worth">Net Worth</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Default Filters</label>
                <select value={String(pref.defaultFilters ?? "all")} onChange={(e) => handleNestedChange("preferences", "defaultFilters", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                  <option value="all">All Transactions</option>
                  <option value="income">Income Only</option>
                  <option value="expense">Expense Only</option>
                  <option value="recurring">Recurring Only</option>
                </select>
              </div>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={Boolean(pref.compactMode ?? false)} onChange={(e) => handleNestedChange("preferences", "compactMode", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                  <span className="text-sm text-navy dark:text-white">Compact mode (smaller spacing)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={Boolean(pref.showTips ?? true)} onChange={(e) => handleNestedChange("preferences", "showTips", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                  <span className="text-sm text-navy dark:text-white">Show tips and suggestions</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={Boolean(pref.confirmBeforeDelete ?? true)} onChange={(e) => handleNestedChange("preferences", "confirmBeforeDelete", e.target.checked)} className="h-4 w-4 rounded border-black/20 text-teal dark:border-white/20" />
                  <span className="text-sm text-navy dark:text-white">Confirm before deleting items</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Default Transaction Type</label>
                <select value={String(pref.defaultTransactionType ?? "EXPENSE")} onChange={(e) => handleNestedChange("preferences", "defaultTransactionType", e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
              <div className="pt-2">
                <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Settings"}</Button>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Topbar title="Settings" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-4xl">
          {isLoading ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}</div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row">
              <nav className="shrink-0 overflow-x-auto lg:w-48" aria-label="Settings tabs">
                <div className="flex gap-1 lg:flex-col">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                        activeTab === tab.id
                          ? "bg-teal/10 text-teal"
                          : "text-navy/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/5"
                      )}
                    >
                      <tab.icon className="h-4 w-4" /> {tab.label}
                    </button>
                  ))}
                </div>
              </nav>
              <div className="flex-1">{renderTab()}</div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <><Topbar title="Settings" /><main className="flex-1 overflow-y-auto p-4 lg:p-6"><div className="mx-auto max-w-4xl"><div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}</div></div></main></>
    }>
      <SettingsContent />
    </Suspense>
  );
}
