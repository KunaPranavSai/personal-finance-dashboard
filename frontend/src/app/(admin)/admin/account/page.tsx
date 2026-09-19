"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { UserCog, ShieldCheck, ShieldOff, KeyRound, Save } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import { api, ApiClientError } from "@/lib/api";

const inputCls = "cc-mono w-full rounded border bg-transparent px-3 py-2 text-sm";
const inputStyle = { borderColor: "var(--cc-border)", color: "var(--cc-text)" };
const labelCls = "mb-1 block text-[10px] font-medium uppercase tracking-wider";

/**
 * Super Admin's own account settings, kept separate from platform-wide Application Settings
 * (admin/settings). Real, working profile/password/2FA controls that call the SAME backend
 * endpoints the regular user /settings page uses (PATCH /api/profile, PATCH
 * /api/auth/change-password, /api/auth/2fa/*) — no new backend surface, and no admin/Super Admin
 * is ever redirected into the normal-user app to manage their own account.
 */
export default function AdminAccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tfa } = useQuery({
    queryKey: ["admin-own-2fa-status"],
    queryFn: () => api.get<{ enabled: boolean }>("/api/auth/2fa/status"),
  });
  const { data: profile } = useQuery({
    queryKey: ["admin-own-profile"],
    queryFn: () => api.get<{ name?: string; phone?: string; avatar?: string | null }>("/api/profile"),
  });

  // Profile form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileTouched, setProfileTouched] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  if (!profileTouched && profile && (name === "" || phone === "")) {
    // Seed once from the fetched profile without fighting the user's typing on refetches.
    if (name === "" && profile.name) setName(profile.name);
    if (phone === "" && profile.phone) setPhone(profile.phone);
  }

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.patch("/api/profile", { name, phone });
      toast("Profile updated", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-own-profile"] });
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const changePassword = async () => {
    setChangingPassword(true);
    try {
      await api.patch("/api/auth/change-password", { currentPassword, newPassword });
      toast("Password changed", "success");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to change password", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  // 2FA enable flow
  const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const startSetup = async () => {
    try {
      const data = await api.post<{ secret: string; qrCode: string }>("/api/auth/2fa/setup");
      setSetup(data);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to start 2FA setup", "error");
    }
  };

  const verifySetup = async () => {
    setVerifying(true);
    try {
      const data = await api.post<{ ok: boolean; backupCodes: string[] }>("/api/auth/2fa/verify", { code });
      setBackupCodes(data.backupCodes);
      setSetup(null);
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["admin-own-2fa-status"] });
      toast("Two-factor authentication enabled", "success");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Invalid code", "error");
    } finally {
      setVerifying(false);
    }
  };

  // 2FA disable flow
  const [disabling, setDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableBusy, setDisableBusy] = useState(false);

  const disable2FA = async () => {
    setDisableBusy(true);
    try {
      await api.post("/api/auth/2fa/disable", { password: disablePassword, code: disableCode });
      toast("Two-factor authentication disabled", "success");
      setDisabling(false);
      setDisablePassword("");
      setDisableCode("");
      queryClient.invalidateQueries({ queryKey: ["admin-own-2fa-status"] });
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Failed to disable 2FA", "error");
    } finally {
      setDisableBusy(false);
    }
  };

  return (
    <>
      <Topbar title="Account Settings" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader
          icon={UserCog}
          title="Account Settings"
          description="Your own Super Admin identity and security — separate from platform-wide Application Settings."
        />

        <div className="cc-panel p-4">
          <p className="cc-mono mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Profile</p>
          <div className="flex items-center gap-4">
            {profile?.avatar && <Image src={profile.avatar} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />}
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} style={{ color: "var(--cc-text-faint)" }}>Name</label>
                <input value={name} onChange={(e) => { setName(e.target.value); setProfileTouched(true); }} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--cc-text-faint)" }}>Phone</label>
                <input value={phone} onChange={(e) => { setPhone(e.target.value); setProfileTouched(true); }} className={inputCls} style={inputStyle} />
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="cc-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Email</p>
              <p className="text-sm" style={{ color: "var(--cc-text)" }}>{user?.email}</p>
            </div>
            <div>
              <p className="cc-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>UID</p>
              <p className="text-sm" style={{ color: "var(--cc-text)" }}>{user?.uid}</p>
            </div>
            <div>
              <p className="cc-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>Role</p>
              <p className="text-sm" style={{ color: "var(--cc-text)" }}>{user?.role?.replace("_", " ")}</p>
            </div>
          </div>
          <Button size="sm" className="mt-4 min-h-[44px]" onClick={saveProfile} disabled={savingProfile || !name.trim()}>
            <Save className="h-4 w-4" /> {savingProfile ? "Saving…" : "Save Profile"}
          </Button>
        </div>

        <div className="cc-panel mt-4 p-4">
          <p className="cc-mono mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Change Password</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} style={{ color: "var(--cc-text-faint)" }}>Current Password</label>
              <PasswordInput autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--cc-text-faint)" }}>New Password</label>
              <PasswordInput autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
          </div>
          <Button size="sm" className="mt-4 min-h-[44px]" onClick={changePassword} disabled={changingPassword || !currentPassword || !newPassword}>
            <KeyRound className="h-4 w-4" /> {changingPassword ? "Changing…" : "Change Password"}
          </Button>
        </div>

        <div className="cc-panel mt-4 p-4">
          <p className="cc-mono mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Two-Factor Authentication</p>
          <div className="mb-3 flex items-center gap-2">
            {tfa?.enabled ? (
              <ShieldCheck className="h-4 w-4" style={{ color: "var(--cc-green)" }} />
            ) : (
              <ShieldOff className="h-4 w-4" style={{ color: "var(--cc-text-faint)" }} />
            )}
            <span className="text-sm" style={{ color: "var(--cc-text)" }}>
              2FA is {tfa?.enabled ? "enabled" : "disabled"}
            </span>
          </div>

          {backupCodes && (
            <div className="mb-3 rounded p-3 text-xs" style={{ background: "var(--cc-panel-alt)", color: "var(--cc-text-dim)" }}>
              <p className="cc-mono mb-1 font-semibold" style={{ color: "var(--cc-amber)" }}>Save your backup codes — shown once:</p>
              <p className="cc-mono break-all">{backupCodes.join("  ")}</p>
            </div>
          )}

          {!tfa?.enabled && !setup && (
            <Button size="sm" className="min-h-[44px]" onClick={startSetup}>Enable 2FA</Button>
          )}

          {setup && (
            <div className="space-y-3">
              <Image src={setup.qrCode} alt="2FA QR code" width={160} height={160} className="rounded bg-white p-2" />
              <p className="cc-mono text-xs" style={{ color: "var(--cc-text-faint)" }}>Secret: {setup.secret}</p>
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className={inputCls} style={{ ...inputStyle, maxWidth: 160 }} />
                <Button size="sm" className="min-h-[44px]" onClick={verifySetup} disabled={verifying || code.length !== 6}>{verifying ? "Verifying…" : "Verify & Enable"}</Button>
              </div>
            </div>
          )}

          {tfa?.enabled && !disabling && (
            <Button size="sm" variant="secondary" className="min-h-[44px]" onClick={() => setDisabling(true)}>Disable 2FA</Button>
          )}
          {tfa?.enabled && disabling && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <PasswordInput autoComplete="current-password" placeholder="Password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} className={inputCls} style={inputStyle} />
                <input placeholder="6-digit code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="min-h-[44px]" onClick={() => setDisabling(false)}>Cancel</Button>
                <Button size="sm" variant="danger" className="min-h-[44px]" onClick={disable2FA} disabled={disableBusy || !disablePassword || disableCode.length !== 6}>
                  {disableBusy ? "Disabling…" : "Confirm Disable"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
