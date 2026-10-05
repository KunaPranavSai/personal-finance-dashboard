"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Alert, Button, ConfirmDialog, Modal, SelectField, TextField } from "@/components/admin/ui";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export interface AdminUserLite {
  id: string; uid: string; name: string; email: string; phone?: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "USER"; status: string;
}
export type UserDialog = "edit" | "reset-password" | "reset-uid" | "delete" | "force-logout" | "suspend" | "activate";
const who = (u: AdminUserLite) => `${u.name} (${u.email})`;
const roleLabel = (r: string) => r.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Every account-level dialog on the Users list and the User 360 header. Each one calls an existing endpoint. */
export function UserDialogs({ user, dialog, onClose, onDone }: { user: AdminUserLite | null; dialog: UserDialog | null; onClose: () => void; onDone: () => void }) {
  if (!user || !dialog) return null;
  const done = () => { onDone(); };
  switch (dialog) {
    case "edit": return <EditDialog user={user} onClose={onClose} onDone={done} />;
    case "reset-password": return <ResetPasswordDialog user={user} onClose={onClose} onDone={done} />;
    case "reset-uid": return <ResetUidDialog user={user} onClose={onClose} onDone={done} />;
    case "delete":
      return (
        <ConfirmDialog open onClose={onClose} danger title={`Delete ${user.name}`} target={who(user)} confirmLabel="Delete account permanently" typeToConfirm={user.email}
          description="Permanently removes this account and its stored records. This cannot be undone." onConfirm={async () => { await api.delete(`/api/auth/users/${user.id}`); done(); }} />
      );
    case "force-logout":
      return (
        <ConfirmDialog open onClose={onClose} title={`Sign out ${user.name} everywhere`} target={who(user)} confirmLabel="Sign out all devices"
          description="Ends every active session on every device right away. They can sign in again afterwards." onConfirm={async () => { await api.post(`/api/admin/users/${user.id}/force-logout`); done(); }} />
      );
    case "suspend":
      return (
        <ConfirmDialog open onClose={onClose} danger title={`Suspend ${user.name}`} target={who(user)} confirmLabel="Suspend account"
          description="Blocks sign-in and every authenticated request right away and signs out active sessions. You can restore the account later."
          onConfirm={async () => { await api.patch(`/api/auth/users/${user.id}`, { status: "SUSPENDED" }); done(); }} />
      );
    case "activate":
      return (
        <ConfirmDialog open onClose={onClose} title={`Restore ${user.name}`} target={who(user)} confirmLabel="Restore account"
          description="Sets the account back to Active so it can sign in again."
          onConfirm={async () => { await api.patch(`/api/auth/users/${user.id}`, { status: "ACTIVE" }); done(); }} />
      );
  }
}

function EditDialog({ user, onClose, onDone }: { user: AdminUserLite; onClose: () => void; onDone: () => void }) {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone ?? "", role: user.role, status: user.status });
  const [step, setStep] = useState<"form" | "confirm">("form");
  const isSelf = me?.uid === user.uid;
  const iAmSuper = me?.role === "SUPER_ADMIN";
  const roleLocked = isSelf || (user.role === "SUPER_ADMIN" && !iAmSuper);
  const roleChanged = form.role !== user.role;
  const suspending = form.status === "SUSPENDED" && user.status !== "SUSPENDED";
  const emailChanged = form.email.trim().toLowerCase() !== user.email;
  const risky = roleChanged || suspending;

  const save = async () => {
    const res = await api.patch<{ message: string }>(`/api/auth/users/${user.id}`, form);
    toast(res.message, "success");
    onDone();
  };

  if (step === "confirm") {
    return (
      <ConfirmDialog open onClose={() => setStep("form")} danger={suspending || form.role === "SUPER_ADMIN" || user.role === "SUPER_ADMIN"}
        title={roleChanged ? `Change role for ${user.name}` : `Suspend ${user.name}`} target={who(user)}
        confirmLabel={roleChanged ? `Change role to ${roleLabel(form.role)}` : "Suspend account"}
        description={roleChanged ? `Changes this account from ${roleLabel(user.role)} to ${roleLabel(form.role)}. What they can access changes immediately.` : "Blocks sign-in and signs out active sessions right away."}
        onConfirm={async () => { await save(); onClose(); }} />
    );
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${user.name}`} footer={<><Button onClick={onClose}>Cancel</Button><SaveButton disabled={!form.name.trim() || !form.email.trim()} onSave={async () => { if (risky) { setStep("confirm"); return; } await save(); onClose(); }} /></>}>
      <div className="grid gap-3">
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus />
        <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          hint={emailChanged ? "Changing the email marks it as unverified; the user must verify the new address before making changes." : undefined} />
        <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <SelectField label="Role" value={form.role} disabled={roleLocked} onChange={(e) => setForm({ ...form, role: e.target.value as AdminUserLite["role"] })}
          hint={isSelf ? "You can't change your own role." : user.role === "SUPER_ADMIN" && !iAmSuper ? "Only a Super Admin can modify a Super Admin." : undefined}>
          <option value="USER">User</option><option value="ADMIN">Admin</option>{(iAmSuper || user.role === "SUPER_ADMIN") && <option value="SUPER_ADMIN">Super Admin</option>}
        </SelectField>
        <SelectField label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
        </SelectField>
      </div>
    </Modal>
  );
}

function SaveButton({ onSave, disabled, label = "Save changes" }: { onSave: () => Promise<void>; disabled?: boolean; label?: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="primary" loading={busy} disabled={disabled} onClick={async () => {
      setBusy(true);
      try { await onSave(); } catch (e) { toast(e instanceof Error ? e.message : "That didn't work", "error"); } finally { setBusy(false); }
    }}>{label}</Button>
  );
}

function ResetPasswordDialog({ user, onClose, onDone }: { user: AdminUserLite; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [result, setResult] = useState<{ emailSent: boolean; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    try { setPassword((await api.get<{ password: string }>("/api/auth/users/generate-temp-password")).password); } catch { toast("Couldn't generate a password", "error"); }
  };

  if (result) {
    return (
      <Modal open onClose={() => { onDone(); onClose(); }} title="Password reset" footer={<Button variant="primary" onClick={() => { onDone(); onClose(); }}>Done</Button>}>
        <Alert tone="success">{result.emailSent ? `${user.email} was emailed that their password was reset. The email does not contain the password.` : "No email was sent."}</Alert>
        <p className="ad-muted mb-1 mt-3">Give them this password securely. It is shown only once.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded-lg px-3 py-2" style={{ background: "var(--ad-surface-2)" }}>{result.password}</code>
          <Button size="sm" icon onClick={() => void navigator.clipboard?.writeText(result.password).then(() => toast("Copied", "success"))} aria-label="Copy password"><Copy size={16} aria-hidden="true" /></Button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal open onClose={onClose} title={`Reset password for ${user.name}`} description="Replaces their password now. They must change it after signing in. Existing sessions end."
      footer={<><Button onClick={onClose}>Cancel</Button><SaveButton label="Reset password" onSave={async () => {
        setError(null);
        try { setResult(await api.post(`/api/auth/users/${user.id}/reset-password`, { password: password || undefined, sendEmail })); }
        catch (e) { setError(e instanceof Error ? e.message : "Couldn't reset the password"); }
      }} /></>}>
      <div className="grid gap-3">
        <div className="flex items-end gap-2">
          <div className="flex-1"><TextField label="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Leave blank to generate one." data-autofocus /></div>
          <Button onClick={generate}>Generate</Button>
        </div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
          <span>Email {user.email} that their password was reset</span>
        </label>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Modal>
  );
}

function ResetUidDialog({ user, onClose, onDone }: { user: AdminUserLite; onClose: () => void; onDone: () => void }) {
  const [uid, setUid] = useState(user.uid);
  const [sendEmail, setSendEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [uid]);
  return (
    <Modal open onClose={onClose} title={`Change User ID for ${user.name}`} description="Changes the ID they sign in with. Their password is unchanged and they are signed out."
      footer={<><Button onClick={onClose}>Cancel</Button><SaveButton label="Change User ID" disabled={!uid.trim() || uid.trim() === user.uid} onSave={async () => {
        try { await api.post(`/api/auth/users/${user.id}/reset-uid`, { uid, sendEmail }); onDone(); onClose(); }
        catch (e) { setError(e instanceof Error ? e.message : "Couldn't change the User ID"); }
      }} /></>}>
      <div className="grid gap-3">
        <TextField label="New User ID" value={uid} onChange={(e) => setUid(e.target.value)} error={error} hint="4–50 characters: letters, numbers, _ . @ -" data-autofocus />
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
          <span>Email {user.email} about the change</span>
        </label>
      </div>
    </Modal>
  );
}
