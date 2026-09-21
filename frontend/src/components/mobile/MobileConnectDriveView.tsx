"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useDriveStatus, isDriveReady, DRIVE_STATUS_QUERY_KEY } from "@/lib/driveStatus";
import { api, ApiClientError } from "@/lib/api";
import { setStorageMode } from "@/lib/storage";
import { isLocalStorageAvailable } from "@/lib/storage/localDb";
import { Database, AlertTriangle, CheckCircle2, FolderOpen, Laptop } from "lucide-react";

/**
 * Mobile "Connect Drive" screen — a faithful port of the desktop
 * /connect-drive state machine (same ViewState union, same handlers, same
 * API calls: GET /api/drive/connect, POST /api/drive/resolve-account-change,
 * setStorageMode/isLocalStorageAvailable/seedLocalDefaultsIfEmpty for
 * Local-Only). Only the presentation layer changed — every state
 * (storageChoice, localWarning, connect, connecting, success, localReady,
 * accountChoice, error) and every OAuth-redirect query param the desktop
 * page parses (driveConnected, accountChanged, driveError) is reproduced
 * here, so this screen never claims a state the backend hasn't actually
 * confirmed.
 */
type ViewState = "storageChoice" | "localWarning" | "connect" | "connecting" | "success" | "localReady" | "accountChoice" | "error";

export function MobileConnectDriveView() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { data: status, isLoading: statusLoading } = useDriveStatus();

  const [view, setView] = useState<ViewState>("storageChoice");
  const [error, setError] = useState("");
  const [migrated, setMigrated] = useState(false);
  const [choiceToken, setChoiceToken] = useState<string | null>(null);
  const [resolvingChoice, setResolvingChoice] = useState(false);
  const [localAck, setLocalAck] = useState(false);
  const [activatingLocal, setActivatingLocal] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("driveConnected") === "1") {
      setMigrated(params.get("migrated") === "1");
      setView("success");
      queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY });
      window.history.replaceState({}, "", "/connect-drive");
    } else if (params.get("accountChanged") === "1" && params.get("choiceToken")) {
      setChoiceToken(params.get("choiceToken"));
      setView("accountChoice");
      window.history.replaceState({}, "", "/connect-drive");
    } else if (params.get("driveError")) {
      const codeToMessage: Record<string, string> = {
        missing_code: "Google didn't return an authorization code. Please try again.",
        expired_state: "That connection attempt expired. Please try again.",
        connect_failed: "Could not connect to Google Drive. Please try again.",
      };
      setError(codeToMessage[params.get("driveError") ?? ""] ?? "Could not connect to Google Drive. Please try again.");
      setView("error");
      window.history.replaceState({}, "", "/connect-drive");
    }
  }, [queryClient]);

  useEffect(() => {
    if (!statusLoading && isDriveReady(status) && (view === "connect" || view === "storageChoice")) {
      router.replace("/dashboard");
    }
  }, [statusLoading, status, view, router]);

  useEffect(() => {
    if (!statusLoading && status?.hasLegacyData && view === "storageChoice") setView("connect");
  }, [statusLoading, status, view]);

  const handleActivateLocal = useCallback(async () => {
    setError("");
    setActivatingLocal(true);
    try {
      const available = await isLocalStorageAvailable();
      if (!available) {
        setError("This browser doesn't support or allow local storage, so This Device Only mode isn't available here.");
        setActivatingLocal(false);
        return;
      }
      setStorageMode("local");
      setView("localReady");
    } finally {
      setActivatingLocal(false);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    setError("");
    setView("connecting");
    try {
      const data = await api.get<{ authUrl: string }>("/api/drive/connect");
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not start Google Drive connection.");
      setView("error");
    }
  }, []);

  const handleResolveChoice = useCallback(async (choice: "use_existing" | "start_fresh") => {
    if (!choiceToken) return;
    setResolvingChoice(true);
    setError("");
    try {
      const data = await api.post<{ ok: boolean; migrated: boolean }>("/api/drive/resolve-account-change", { choiceToken, choice });
      setMigrated(data.migrated);
      setView("success");
      queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not complete the connection. Please reconnect Google Drive.");
      setView("error");
    } finally {
      setResolvingChoice(false);
    }
  }, [choiceToken, queryClient]);

  const Shell = ({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) => (
    <div className="pp-mobile" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "16px 16px calc(24px + env(safe-area-inset-bottom, 0px))", maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "2.2rem", marginBottom: 12 }} aria-hidden="true">{icon}</div>
          <h1 style={{ fontFamily: "'Manrope', system-ui, sans-serif", fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>{title}</h1>
          <p style={{ fontSize: 13, color: "var(--ppm-text-dim)", marginTop: 6 }}>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );

  const ErrorBanner = () => error ? <div className="err" style={{ background: "rgba(255,65,3,.1)", padding: 12, borderRadius: 11, marginBottom: 14 }}>{error}</div> : null;

  if (authLoading || !isAuthenticated) {
    return (
      <div className="pp-mobile" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ height: 36, width: 36, borderRadius: "50%", border: "4px solid var(--ppm-border)", borderTopColor: "var(--ppm-accent)", animation: "spin 0.8s linear infinite" }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  if (view === "storageChoice") {
    return (
      <Shell icon={<Database size={35} />} title="Choose how you want to store your data" subtitle="You can change this later in Settings">
        <div className="ppm-card" style={{ marginBottom: 12 }}>
          <div className="ppm-name" style={{ marginBottom: 4 }}>Google Drive — Recommended</div>
          <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", marginBottom: 12 }}>Store Penny Pilot data in your own Google Drive, backed up and accessible from any device.</p>
          <button type="button" className="ppm-sheet-submit" onClick={() => setView("connect")}>Connect Google Drive</button>
        </div>
        <div className="ppm-card">
          <div className="ppm-name" style={{ marginBottom: 4, display:"flex", alignItems:"center", gap:6 }}><Laptop size={16} /> This Device Only</div>
          <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", marginBottom: 12 }}>Keep Penny Pilot data locally in this browser/device without connecting Google Drive.</p>
          <button type="button" className="ppm-sheet-cancel" style={{ marginTop: 0 }} onClick={() => setView("localWarning")}>Continue on this Device</button>
        </div>
      </Shell>
    );
  }

  if (view === "localWarning") {
    return (
      <Shell icon={<AlertTriangle size={35} />} title="Important: local-only storage" subtitle="Please read before continuing">
        <div className="ppm-card" style={{ background: "rgba(255,190,11,.1)", marginBottom: 14 }}>
          <p style={{ fontSize: 13, margin: 0 }}>Your financial data will be stored only on this browser/device. Penny Pilot will not maintain a cloud backup of this data.</p>
          <p style={{ fontSize: 13, marginTop: 8, marginBottom: 0 }}>If browser/site data is cleared, the device is lost, the browser profile is reset, or you switch devices/browsers, your data may be permanently lost unless you have exported a backup.</p>
        </div>
        <ErrorBanner />
        <label className="ppm-list-item" style={{ cursor: "pointer", alignItems: "flex-start" }}>
          <input type="checkbox" checked={localAck} onChange={(e) => setLocalAck(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>I understand that local-only data may be permanently lost if I do not maintain my own backup.</span>
        </label>
        <button type="button" className="ppm-sheet-submit" style={{ marginTop: 14 }} disabled={!localAck || activatingLocal} onClick={handleActivateLocal}>
          {activatingLocal ? "Setting up…" : "Continue on this Device"}
        </button>
        <button type="button" className="ppm-sheet-cancel" onClick={() => setView("storageChoice")}>Back</button>
      </Shell>
    );
  }

  if (view === "localReady") {
    return (
      <Shell icon={<CheckCircle2 size={35} />} title="Local Storage Ready" subtitle="Your data will stay on this device">
        <p style={{ fontSize: 13, color: "var(--ppm-text-dim)", textAlign: "center", marginBottom: 18 }}>
          Penny Pilot will now store your financial data locally in this browser. You can export a backup or switch to Google Drive anytime from More → Settings → Storage.
        </p>
        <button type="button" className="ppm-sheet-submit" onClick={() => router.replace("/dashboard")}>Continue to Dashboard →</button>
      </Shell>
    );
  }

  if (view === "success") {
    return (
      <Shell icon={<CheckCircle2 size={35} />} title="Google Drive Connected" subtitle="Your Penny Pilot workspace is ready">
        <p style={{ fontSize: 13, color: "var(--ppm-text-dim)", textAlign: "center", marginBottom: 18 }}>
          {migrated ? "Your existing Penny Pilot data has been moved into your Google Drive." : "Your financial workspace is ready. Start by adding your first transaction."}
        </p>
        <button type="button" className="ppm-sheet-submit" onClick={() => router.replace("/dashboard")}>Continue to Dashboard →</button>
      </Shell>
    );
  }

  if (view === "accountChoice") {
    return (
      <Shell icon={<FolderOpen size={35} />} title="Different Google Account" subtitle="We found existing Penny Pilot data in this Google Drive account">
        <p style={{ fontSize: 13, color: "var(--ppm-text-dim)", marginBottom: 14 }}>
          This Google account already has a Penny Pilot workspace in its Drive — possibly from a previous connection. Choose what to do:
        </p>
        <ErrorBanner />
        <button type="button" className="ppm-sheet-submit" disabled={resolvingChoice} onClick={() => handleResolveChoice("use_existing")}>
          {resolvingChoice ? "Connecting…" : "Use This Existing Data"}
        </button>
        <button type="button" className="ppm-sheet-cancel" disabled={resolvingChoice} onClick={() => handleResolveChoice("start_fresh")}>Start a New Empty Workspace</button>
      </Shell>
    );
  }

  const isLegacyAccount = Boolean(status?.hasLegacyData);
  const title = isLegacyAccount ? "Move your Penny Pilot data to Google Drive" : "Penny Pilot";
  const subtitle = isLegacyAccount ? "One-time migration, nothing is deleted" : "Your money. Your data.";
  const description = isLegacyAccount
    ? "Penny Pilot now stores all financial data in your own Google Drive. We found existing data on your account from before this change — connecting Google Drive will copy it into your new Drive workspace. Your original data is never deleted."
    : "Penny Pilot stores your financial data directly in your Google Drive. Connect your Google account to securely create your personal financial workspace.";
  const connectLabel = isLegacyAccount ? "Connect Google Drive & Migrate Data" : "Connect Google Drive";
  const connectingLabel = view === "connecting" ? "Redirecting to Google…" : isLegacyAccount ? "Migrating your data…" : "Setting up your workspace…";

  return (
    <Shell icon={<Database size={35} />} title={title} subtitle={subtitle}>
      <p style={{ fontSize: 13, color: "var(--ppm-text-dim)", textAlign: "center", marginBottom: 14 }}>{description}</p>
      <ErrorBanner />
      {error && <p style={{ fontSize: 12, color: "var(--ppm-text-dim)", textAlign: "center", marginBottom: 12 }}>Nothing was lost — your data is safe. You can retry the connection below.</p>}
      <button type="button" className="ppm-sheet-submit" disabled={view === "connecting"} onClick={handleConnect}>
        {view === "connecting" ? connectingLabel : error ? "Retry Connection" : connectLabel}
      </button>
      <p style={{ fontSize: 11, color: "var(--ppm-text-dim)", textAlign: "center", marginTop: 10 }}>Your data remains under your Google account.</p>
      {!isLegacyAccount && view !== "connecting" && (
        <button type="button" className="ppm-sheet-cancel" onClick={() => setView("storageChoice")}>Back</button>
      )}
    </Shell>
  );
}
