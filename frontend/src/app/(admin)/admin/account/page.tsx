"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PinSettings } from "@/components/auth/pin";
import { Alert, Badge, Button, ConfirmDialog, PageHeader, Panel, PasswordField, TextField } from "@/components/admin/ui";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";

/** The signed-in admin's own profile, password, two-factor and PIN. Uses the same endpoints as the user settings page. */
export default function AdminAccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tfa = useQuery({ queryKey: ["admin", "own-2fa"], queryFn: () => api.get<{ enabled: boolean }>("/api/auth/2fa/status") });
  const profile = useQuery({ queryKey: ["admin", "own-profile"], queryFn: () => api.get<{ name?: string; phone?: string; avatar?: string | null }>("/api/profile") });

  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cur, setCur] = useState(""); const [next, setNext] = useState(""); const [pwBusy, setPwBusy] = useState(false); const [pwErr, setPwErr] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [code, setCode] = useState(""); const [verifying, setVerifying] = useState(false); const [codeErr, setCodeErr] = useState<string | null>(null);
  const [backup, setBackup] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false); const [dPw, setDPw] = useState(""); const [dCode, setDCode] = useState("");

  const shownName = name ?? profile.data?.name ?? "";
  const shownPhone = phone ?? profile.data?.phone ?? "";
  const err = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

  return (
    <>
      <PageHeader title="My Account" description="Your own profile and sign-in security." />
      <div className="grid gap-4" style={{ maxWidth: 760 }}>
        <Panel title="Profile">
          <div className="flex flex-wrap items-start gap-4">
            {profile.data?.avatar && <Image src={profile.data.avatar} alt="" width={56} height={56} className="rounded-full object-cover" style={{ width: 56, height: 56 }} />}
            <div className="grid flex-1 gap-3 sm:grid-cols-2" style={{ minWidth: 240 }}>
              <TextField label="Name" value={shownName} onChange={(e) => setName(e.target.value)} />
              <TextField label="Phone" value={shownPhone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <dl className="ad-kv mt-4"><dt>Email</dt><dd>{user?.email}</dd><dt>User ID</dt><dd>{user?.uid}</dd><dt>Role</dt><dd>{user?.role?.replace("_", " ")}</dd></dl>
          <div className="mt-4"><Button variant="primary" loading={saving} disabled={!shownName.trim() || (name === null && phone === null)} onClick={async () => {
            setSaving(true);
            try { await api.patch("/api/profile", { name: shownName, phone: shownPhone }); toast("Profile updated", "success"); setName(null); setPhone(null); void queryClient.invalidateQueries({ queryKey: ["admin", "own-profile"] }); }
            catch (e) { toast(err(e, "Couldn't update your profile"), "error"); } finally { setSaving(false); }
          }}>Save profile</Button></div>
        </Panel>

        <Panel title="Change password">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault(); setPwBusy(true); setPwErr(null);
            try { await api.patch("/api/auth/change-password", { currentPassword: cur, newPassword: next }); toast("Password changed", "success"); setCur(""); setNext(""); }
            catch (x) { setPwErr(err(x, "Couldn't change the password")); } finally { setPwBusy(false); }
          }}>
            <PasswordField label="Current password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
            <PasswordField label="New password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={pwErr} />
            <div><Button type="submit" variant="primary" loading={pwBusy} disabled={!cur || !next}>Change password</Button></div>
          </form>
        </Panel>

        <Panel title="Two-factor authentication" actions={tfa.data ? <Badge tone={tfa.data.enabled ? "green" : ""}>{tfa.data.enabled ? "On" : "Off"}</Badge> : undefined}>
          {backup && <div className="mb-3"><Alert tone="warn" title="Save your backup codes. They are shown only once."><code className="break-all">{backup.join("  ")}</code></Alert></div>}
          {!tfa.data?.enabled && !setup && <Button onClick={async () => { try { setSetup(await api.post("/api/auth/2fa/setup")); } catch (e) { toast(err(e, "Couldn't start setup"), "error"); } }}>Turn on two-factor</Button>}
          {setup && (
            <div className="grid gap-3">
              <Image src={setup.qrCode} alt="QR code for your authenticator app" width={168} height={168} className="rounded-lg bg-white p-2" />
              <p className="ad-muted m-0 break-all">Or enter this key: <code>{setup.secret}</code></p>
              <div className="flex flex-wrap items-end gap-2">
                <div style={{ width: 180 }}><TextField label="6-digit code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} error={codeErr} /></div>
                <Button variant="primary" loading={verifying} disabled={code.length !== 6} onClick={async () => {
                  setVerifying(true); setCodeErr(null);
                  try { const r = await api.post<{ backupCodes: string[] }>("/api/auth/2fa/verify", { code }); setBackup(r.backupCodes); setSetup(null); setCode(""); void queryClient.invalidateQueries({ queryKey: ["admin", "own-2fa"] }); toast("Two-factor turned on", "success"); }
                  catch (e) { setCodeErr(err(e, "That code didn't work")); } finally { setVerifying(false); }
                }}>Verify and turn on</Button>
              </div>
            </div>
          )}
          {tfa.data?.enabled && <Button variant="danger" onClick={() => setDisabling(true)}>Turn off two-factor</Button>}
        </Panel>

        <Panel title="Sign-in PIN"><PinSettings variant="desktop" userId={user?.uid ?? ""} /></Panel>
        <Panel title="Sessions"><p className="ad-muted mt-0">See where your account is signed in.</p><Link href="/admin/sessions" className="ad-btn">Open My Sessions</Link></Panel>
      </div>

      <ConfirmDialog open={disabling} onClose={() => setDisabling(false)} danger title="Turn off two-factor" confirmLabel="Turn off two-factor"
        description="Your account will be protected by your password alone. Enter your password and a current code to confirm."
        onConfirm={async () => { await api.post("/api/auth/2fa/disable", { password: dPw, code: dCode }); toast("Two-factor turned off", "success"); setDPw(""); setDCode(""); void queryClient.invalidateQueries({ queryKey: ["admin", "own-2fa"] }); }}>
        <div className="grid gap-3"><PasswordField label="Password" autoComplete="current-password" value={dPw} onChange={(e) => setDPw(e.target.value)} /><TextField label="6-digit code" inputMode="numeric" maxLength={6} value={dCode} onChange={(e) => setDCode(e.target.value.replace(/\D/g, ""))} /></div>
      </ConfirmDialog>
    </>
  );
}
