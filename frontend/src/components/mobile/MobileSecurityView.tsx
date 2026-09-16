"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { MobileShell } from "@/components/mobile/MobileShell";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { getPreferBiometric, setPreferBiometric } from "@/lib/passkeyPrefs";

interface PasskeyItem {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * Mobile "Security" screen — a faithful port of the desktop Settings →
 * Security tab's 2FA toggle and PasskeySection, using the exact same
 * AuthContext methods (setupTwoFactor/confirmTwoFactor/disableTwoFactor/
 * changePassword) and the exact same /api/auth/passkey REST endpoints
 * (register/options, register/verify, rename, delete) — no new security
 * logic, only the presentation layer changed. Reachable from
 * /settings → "Security & Account".
 */
export function MobileSecurityView() {
  const { twoFactorEnabled, setupTwoFactor, confirmTwoFactor, disableTwoFactor, changePassword } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 2FA enable flow
  const [twoFaSheet, setTwoFaSheet] = useState<"none" | "enable-qr" | "disable">("none");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Passkeys
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [preferBiometric, setPreferBiometricState] = useState(false);
  const [addSheet, setAddSheet] = useState<"none" | "confirm" | "name">("none");
  const [addPassword, setAddPassword] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addName, setAddName] = useState("");
  const [pendingOptions, setPendingOptions] = useState<{ options: unknown; challengeToken: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PasskeyItem | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteCode, setDeleteCode] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Change password
  const [pwSheet, setPwSheet] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    setWebAuthnSupported(browserSupportsWebAuthn());
    setPreferBiometricState(getPreferBiometric());
  }, []);

  const { data: passkeyData } = useQuery({
    queryKey: ["passkeys"],
    queryFn: () => api.get<{ passkeys: PasskeyItem[] }>("/api/auth/passkey"),
    enabled: webAuthnSupported,
  });
  const passkeys = passkeyData?.passkeys ?? [];

  const togglePreferBiometric = useCallback((value: boolean) => {
    setPreferBiometric(value);
    setPreferBiometricState(value);
  }, []);

  const resetTwoFaSheet = () => { setTwoFaSheet("none"); setError(""); setCode(""); setDisablePassword(""); setDisableCode(""); setBackupCodes(null); };

  const startTwoFa = async () => {
    setError("");
    setBusy(true);
    try {
      const data = await setupTwoFactor();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setTwoFaSheet("enable-qr");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to start 2FA setup", "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnableTwoFa = async () => {
    setError("");
    setBusy(true);
    try {
      const data = await confirmTwoFactor(code.trim());
      setBackupCodes(data.backupCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const submitDisableTwoFa = async () => {
    setError("");
    setBusy(true);
    try {
      await disableTwoFactor(disablePassword, disableCode.trim());
      toast("Two-factor authentication disabled", "success");
      resetTwoFaSheet();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setBusy(false);
    }
  };

  const resetAddFlow = () => { setAddSheet("none"); setAddPassword(""); setAddCode(""); setAddName(""); setPendingOptions(null); setError(""); };

  const startPasskeyRegistration = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await api.post<{ options: unknown; challengeToken: string }>("/api/auth/passkey/register/options", {
        password: addPassword,
        code: twoFactorEnabled ? addCode.trim() : undefined,
      });
      setPendingOptions(res);
      setAddSheet("name");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const completePasskeyRegistration = async () => {
    if (!pendingOptions || !addName.trim()) return;
    setError("");
    setBusy(true);
    try {
      const response = await startRegistration({ optionsJSON: pendingOptions.options as never });
      await api.post("/api/auth/passkey/register/verify", { response, challengeToken: pendingOptions.challengeToken, name: addName.trim() });
      toast("Passkey added", "success");
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      resetAddFlow();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register passkey");
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      await api.patch(`/api/auth/passkey/${id}`, { name: renameValue.trim() });
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      setRenamingId(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to rename passkey", "error");
    }
  };

  const deletePasskey = async () => {
    if (!deleteTarget) return;
    setError("");
    setBusy(true);
    try {
      await api.delete(`/api/auth/passkey/${deleteTarget.id}`, { password: deletePassword, code: twoFactorEnabled ? deleteCode.trim() : undefined });
      toast("Passkey removed", "success");
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      setDeleteTarget(null);
      setDeletePassword("");
      setDeleteCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove passkey");
    } finally {
      setBusy(false);
    }
  };

  const submitChangePassword = async () => {
    setError("");
    setBusy(true);
    try {
      await changePassword(currentPw, newPw);
      toast("Password changed", "success");
      setPwSheet(false);
      setCurrentPw("");
      setNewPw("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileShell title="Security">
      <div className="ppm-page-title">
        <h2>Security</h2>
        <p>2FA, passkeys &amp; account protection</p>
      </div>

      <div className="ppm-card">
        <div className="ppm-section-label">Two-Factor Authentication</div>
        <div className="ppm-list-item" style={{ cursor: "default" }}>
          <div className="ppm-ic" aria-hidden="true">🛡️</div>
          <div className="ppm-info">
            <div className="ppm-name">Authenticator App</div>
            <div className="ppm-meta">{twoFactorEnabled ? "Enabled — a code is required at sign-in" : "Add an extra layer of security"}</div>
          </div>
          {twoFactorEnabled ? (
            <button type="button" className="ppm-link-btn" style={{ color: "var(--ppm-critical)" }} onClick={() => setTwoFaSheet("disable")}>Disable</button>
          ) : (
            <button type="button" className="ppm-link-btn" disabled={busy} onClick={startTwoFa}>{busy ? "Starting…" : "Enable"}</button>
          )}
        </div>
      </div>

      <div className="ppm-card" style={{ marginTop: 14 }}>
        <div className="ppm-section-label">Password</div>
        <div className="ppm-list-item" onClick={() => setPwSheet(true)}>
          <div className="ppm-ic" aria-hidden="true">🔑</div>
          <div className="ppm-info"><div className="ppm-name">Change Password</div></div>
          <span className="ppm-chev">›</span>
        </div>
        <Link href="/forgot-password" className="ppm-list-item">
          <div className="ppm-ic" aria-hidden="true">🆘</div>
          <div className="ppm-info"><div className="ppm-name">Account Recovery</div></div>
          <span className="ppm-chev">›</span>
        </Link>
      </div>

      {webAuthnSupported && (
        <div className="ppm-card" style={{ marginTop: 14 }}>
          <div className="ppm-section-label" style={{ marginBottom: 4 }}>
            Passkeys &amp; Biometrics
            <button type="button" className="ppm-link-btn" onClick={() => setAddSheet("confirm")}>+ Add</button>
          </div>
          <p style={{ fontSize: 11, color: "var(--ppm-text-dim)", marginBottom: 10 }}>Sign in with Windows Hello, Touch ID, Face ID, or a security key instead of your password.</p>
          {passkeys.length > 0 && (
            <label className="ppm-list-item" style={{ cursor: "pointer" }}>
              <div className="ppm-info"><div className="ppm-name" style={{ fontWeight: 500, fontSize: ".78rem" }}>Prefer biometric login on this device</div></div>
              <button type="button" className={`ppm-toggle${preferBiometric ? " on" : ""}`} role="switch" aria-checked={preferBiometric} onClick={() => togglePreferBiometric(!preferBiometric)} />
            </label>
          )}
          {passkeys.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--ppm-text-dim)" }}>No passkeys registered yet.</p>
          ) : (
            passkeys.map((pk) => (
              <div className="ppm-list-item" key={pk.id} style={{ cursor: "default" }}>
                {renamingId === pk.id ? (
                  <>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--ppm-border)", background: "var(--ppm-surface-2)", color: "var(--ppm-text)", fontSize: 16 }}
                    />
                    <button type="button" className="ppm-link-btn" onClick={() => submitRename(pk.id)}>Save</button>
                    <button type="button" className="ppm-row-action" aria-label="Cancel rename" onClick={() => setRenamingId(null)}>✕</button>
                  </>
                ) : (
                  <>
                    <div className="ppm-info">
                      <div className="ppm-name">{pk.name}</div>
                      <div className="ppm-meta">{pk.lastUsedAt ? `Last used ${new Date(pk.lastUsedAt).toLocaleDateString()}` : `Added ${new Date(pk.createdAt).toLocaleDateString()}`}</div>
                    </div>
                    <button type="button" className="ppm-row-action" aria-label={`Rename ${pk.name}`} onClick={() => { setRenamingId(pk.id); setRenameValue(pk.name); }}>✏️</button>
                    <button type="button" className="ppm-row-action" aria-label={`Remove ${pk.name}`} onClick={() => { setDeleteTarget(pk); setError(""); }}>🗑</button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 2FA enable sheet */}
      <MobileSheet open={twoFaSheet === "enable-qr"} onClose={resetTwoFaSheet} title={backupCodes ? "Save Backup Codes" : "Enable Two-Factor Authentication"}>
        {!backupCodes ? (
          <>
            <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", marginBottom: 12 }}>Scan with Google Authenticator, Microsoft Authenticator, Authy, or 2FAS, or enter the key manually.</p>
            {qrCode && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCode} alt="2FA QR code" style={{ display: "block", margin: "0 auto 12px", width: 150, height: 150, borderRadius: 12, background: "#fff", padding: 8 }} />
            )}
            <div className="ppm-field">
              <label htmlFor="ppm-sec-secret">Secret Key</label>
              <input id="ppm-sec-secret" readOnly value={secret} style={{ fontFamily: "monospace", fontSize: 12 }} onFocus={(e) => e.target.select()} />
            </div>
            <div className="ppm-field">
              <label htmlFor="ppm-sec-code">Verification Code</label>
              <input id="ppm-sec-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" style={{ textAlign: "center", letterSpacing: 4, fontSize: 18 }} />
            </div>
            {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
            <div className="ppm-sheet-actions">
              <button type="button" className="ppm-sheet-submit" disabled={busy || !code} onClick={confirmEnableTwoFa}>{busy ? "Verifying…" : "Verify & Enable"}</button>
              <button type="button" className="ppm-sheet-cancel" onClick={resetTwoFaSheet} disabled={busy}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", marginBottom: 12 }}>Save these one-time backup codes somewhere safe — each can be used once if you lose access to your authenticator app. They won&apos;t be shown again.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--ppm-surface-2)", borderRadius: 11, padding: 12, marginBottom: 14, fontFamily: "monospace", fontSize: 13 }}>
              {backupCodes.map((c) => <span key={c}>{c}</span>)}
            </div>
            <button type="button" className="ppm-sheet-submit" onClick={() => { toast("Two-factor authentication enabled", "success"); resetTwoFaSheet(); }}>Done</button>
          </>
        )}
      </MobileSheet>

      {/* 2FA disable sheet */}
      <MobileSheet open={twoFaSheet === "disable"} onClose={resetTwoFaSheet} title="Disable Two-Factor Authentication">
        <div className="ppm-field">
          <label htmlFor="ppm-sec-disable-pw">Password</label>
          <input id="ppm-sec-disable-pw" type="password" autoComplete="current-password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-sec-disable-code">Verification Code</label>
          <input id="ppm-sec-disable-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="123456" />
        </div>
        {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-danger-btn" style={{ width: "100%" }} disabled={busy || !disablePassword || !disableCode} onClick={submitDisableTwoFa}>{busy ? "Disabling…" : "Disable 2FA"}</button>
          <button type="button" className="ppm-sheet-cancel" onClick={resetTwoFaSheet} disabled={busy}>Cancel</button>
        </div>
      </MobileSheet>

      {/* Add passkey sheet */}
      <MobileSheet open={addSheet !== "none"} onClose={resetAddFlow} title={addSheet === "name" ? "Name This Passkey" : "Confirm Your Identity"}>
        {addSheet === "confirm" ? (
          <>
            <div className="ppm-field">
              <label htmlFor="ppm-sec-add-pw">Password</label>
              <input id="ppm-sec-add-pw" type="password" autoComplete="current-password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} />
            </div>
            {twoFactorEnabled && (
              <div className="ppm-field">
                <label htmlFor="ppm-sec-add-code">Verification Code</label>
                <input id="ppm-sec-add-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={addCode} onChange={(e) => setAddCode(e.target.value)} placeholder="123456" />
              </div>
            )}
            {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
            <div className="ppm-sheet-actions">
              <button type="button" className="ppm-sheet-submit" disabled={busy || !addPassword || (twoFactorEnabled && !addCode)} onClick={startPasskeyRegistration}>{busy ? "Verifying…" : "Continue"}</button>
              <button type="button" className="ppm-sheet-cancel" onClick={resetAddFlow} disabled={busy}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div className="ppm-field">
              <label htmlFor="ppm-sec-add-name">Passkey Name</label>
              <input id="ppm-sec-add-name" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Windows Hello, iPhone" autoFocus />
            </div>
            {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
            <div className="ppm-sheet-actions">
              <button type="button" className="ppm-sheet-submit" disabled={busy || !addName.trim()} onClick={completePasskeyRegistration}>{busy ? "Registering…" : "Register Device"}</button>
              <button type="button" className="ppm-sheet-cancel" onClick={resetAddFlow} disabled={busy}>Cancel</button>
            </div>
          </>
        )}
      </MobileSheet>

      {/* Delete passkey confirm */}
      <MobileSheet open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Remove Passkey">
        <p style={{ fontSize: 13, color: "var(--ppm-text-dim)", marginBottom: 12 }}>Confirm your password to remove &quot;{deleteTarget?.name}&quot;.</p>
        <div className="ppm-field">
          <label htmlFor="ppm-sec-del-pw">Password</label>
          <input id="ppm-sec-del-pw" type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
        </div>
        {twoFactorEnabled && (
          <div className="ppm-field">
            <label htmlFor="ppm-sec-del-code">Verification Code</label>
            <input id="ppm-sec-del-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={deleteCode} onChange={(e) => setDeleteCode(e.target.value)} placeholder="123456" />
          </div>
        )}
        {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-danger-btn" style={{ width: "100%" }} disabled={busy || !deletePassword || (twoFactorEnabled && !deleteCode)} onClick={deletePasskey}>{busy ? "Removing…" : "Remove Passkey"}</button>
          <button type="button" className="ppm-sheet-cancel" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</button>
        </div>
      </MobileSheet>

      {/* Change password sheet */}
      <MobileSheet open={pwSheet} onClose={() => setPwSheet(false)} title="Change Password">
        <div className="ppm-field">
          <label htmlFor="ppm-sec-cur-pw">Current Password</label>
          <input id="ppm-sec-cur-pw" type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
        </div>
        <div className="ppm-field">
          <label htmlFor="ppm-sec-new-pw">New Password</label>
          <input id="ppm-sec-new-pw" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </div>
        {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
        <div className="ppm-sheet-actions">
          <button type="button" className="ppm-sheet-submit" disabled={busy || !currentPw || !newPw} onClick={submitChangePassword}>{busy ? "Saving…" : "Change Password"}</button>
          <button type="button" className="ppm-sheet-cancel" onClick={() => setPwSheet(false)} disabled={busy}>Cancel</button>
        </div>
      </MobileSheet>
    </MobileShell>
  );
}
