"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";

export interface ManagedUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  createdAt: string;
  approvedAt?: string | null;
  lastLoginAt?: string | null;
  twoFactorEnabled?: boolean;
}

export interface UsageCounts {
  transactions: number; budgets: number; investments: number; bills: number; goals: number;
  categories: number; accounts: number; paymentMethods: number; notifications: number; activityLogs: number;
}

export const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ACTIVE: "bg-teal/10 text-teal",
  REJECTED: "bg-red-500/10 text-red-500",
  SUSPENDED: "bg-navy/10 text-navy/60 dark:bg-white/10 dark:text-white/60",
};

const USAGE_LABELS: Record<keyof UsageCounts, string> = {
  transactions: "Transactions", budgets: "Budgets", investments: "Investments", bills: "Bills", goals: "Goals",
  categories: "Categories", accounts: "Accounts", paymentMethods: "Payment Methods", notifications: "Notifications", activityLogs: "Activity Log Entries",
};

export function ModalShell({ onClose, children, maxWidth = "max-w-sm" }: { onClose: () => void; children: React.ReactNode; maxWidth?: string }) {
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

export type ToastFn = (msg: string, type: "success" | "error") => void;
export interface UserModalProps {
  user: ManagedUser;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onClose: () => void;
  toast: ToastFn;
}

export function ApproveModal({ user, busy, setBusy, onClose, onDone, toast }: UserModalProps & { onDone: () => void }) {
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

export function RejectModal({ user, busy, setBusy, onClose, onDone, toast }: UserModalProps & { onDone: () => void }) {
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

export function EditUserModal({ user, busy, setBusy, onClose, onDone, toast }: UserModalProps & { onDone: () => void }) {
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

export function ResetPasswordModal({ user, busy, setBusy, onClose, toast }: UserModalProps) {
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

export function ResetUidModal({ user, busy, setBusy, onClose, onDone, toast }: UserModalProps & { onDone: () => void }) {
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

export function UsageModal({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
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

export function DeleteUserModal({ user, busy, setBusy, onClose, onDone, toast }: UserModalProps & { onDone: () => void }) {
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
