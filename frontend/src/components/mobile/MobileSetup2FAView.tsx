"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { CheckCircle2, Shield } from "lucide-react";

/**
 * Mobile "Set up 2FA" onboarding screen — a faithful port of the desktop
 * /setup-2fa wizard (same three states: qr → verify → backup, same
 * useAuth().setupTwoFactor/confirmTwoFactor calls, same redirect-to-dashboard
 * behavior and ?welcome=1 passthrough). No new security logic — only the
 * presentation layer changed.
 */
function MobileSetupTwoFactorContent() {
  const { user, isAuthenticated, isLoading, twoFactorEnabled, setupTwoFactor, confirmTwoFactor } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";

  const [step, setStep] = useState<"loading" | "qr" | "backup">("loading");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const goToDashboard = useCallback(() => {
    const target = user?.role === "USER" ? "/dashboard" : "/admin";
    router.replace(welcome ? `${target}?welcome=1` : target);
  }, [user, welcome, router]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
    else if (!isLoading && isAuthenticated && twoFactorEnabled && step !== "backup") goToDashboard();
  }, [isLoading, isAuthenticated, twoFactorEnabled, step, goToDashboard]);

  const startSetup = useCallback(async () => {
    setError("");
    try {
      const data = await setupTwoFactor();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("qr");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start 2FA setup");
    }
  }, [setupTwoFactor]);

  useEffect(() => {
    if (isAuthenticated && !twoFactorEnabled && step === "loading") startSetup();
  }, [isAuthenticated, twoFactorEnabled, step, startSetup]);

  const handleConfirm = async () => {
    setError("");
    setBusy(true);
    try {
      const data = await confirmTwoFactor(code.trim());
      setBackupCodes(data.backupCodes);
      setStep("backup");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !isAuthenticated || (twoFactorEnabled && step !== "backup") || step === "loading") {
    return (
      <div className="pp-mobile" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ height: 36, width: 36, borderRadius: "50%", border: "4px solid var(--ppm-border)", borderTopColor: "var(--ppm-accent)", animation: "spin 0.8s linear infinite" }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  return (
    <div className="pp-mobile" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "16px 16px calc(24px + env(safe-area-inset-bottom, 0px))", maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div aria-hidden="true"><Shield size={35} /></div>
          <h1 style={{ fontFamily: "'Manrope', system-ui, sans-serif", fontSize: "1.3rem", fontWeight: 800, margin: "8px 0 0" }}>Secure your account</h1>
          <p style={{ fontSize: 13, color: "var(--ppm-text-dim)", marginTop: 6 }}>
            {step === "qr" && "Add an extra layer of protection to your account (optional, recommended)."}
            {step === "backup" && "Save your backup codes before continuing."}
          </p>
        </div>

        {step === "qr" && (
          <div className="ppm-card">
            <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", marginBottom: 12 }}>
              Scan this QR code with Google Authenticator, Microsoft Authenticator, Authy, or 2FAS, or enter the key manually.
            </p>
            {qrCode && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCode} alt="2FA QR code" style={{ display: "block", margin: "0 auto 12px", width: 160, height: 160, borderRadius: 12, background: "#fff", padding: 8 }} />
            )}
            <div className="ppm-field">
              <label htmlFor="ppm-2fa-secret">Secret Key</label>
              <input id="ppm-2fa-secret" readOnly value={secret} style={{ fontFamily: "monospace", fontSize: 12 }} onFocus={(e) => e.target.select()} />
            </div>
            <div className="ppm-field">
              <label htmlFor="ppm-2fa-code">Verification Code</label>
              <input id="ppm-2fa-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" style={{ textAlign: "center", letterSpacing: 4, fontSize: 18 }} />
            </div>
            {error && <div className="err" style={{ marginBottom: 10 }}>{error}</div>}
            <button type="button" className="ppm-sheet-submit" disabled={busy || !code} onClick={handleConfirm}>{busy ? "Verifying…" : "Verify & Enable"}</button>
            <button type="button" className="ppm-sheet-cancel" onClick={goToDashboard}>Skip for now</button>
          </div>
        )}

        {step === "backup" && (
          <div className="ppm-card">
            <div style={{ textAlign: "center", marginBottom: 8 }} aria-hidden="true"><CheckCircle2 size={28} style={{margin:"0 auto"}} /></div>
            <p style={{ fontSize: 13, color: "var(--ppm-text-dim)", textAlign: "center", marginBottom: 14 }}>
              Two-factor authentication is enabled. Save these one-time backup codes somewhere safe — each can be used once if you lose access to your authenticator app. They won&apos;t be shown again.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--ppm-surface-2)", borderRadius: 11, padding: 12, marginBottom: 12, fontFamily: "monospace", fontSize: 13 }}>
              {backupCodes.map((c) => <span key={c}>{c}</span>)}
            </div>
            <button type="button" className="ppm-sheet-cancel" style={{ marginTop: 0, marginBottom: 8 }} onClick={copyBackupCodes}>{copied ? "Copied" : "Copy Codes"}</button>
            <button type="button" className="ppm-sheet-submit" onClick={goToDashboard}>Continue to {user?.role === "USER" ? "Dashboard" : "Admin Dashboard"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileSetup2FAView() {
  return (
    <Suspense>
      <MobileSetupTwoFactorContent />
    </Suspense>
  );
}
