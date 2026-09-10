"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/lib/AuthContext";
import { useDriveStatus, isDriveReady, DRIVE_STATUS_QUERY_KEY } from "@/lib/driveStatus";
import { api, ApiClientError } from "@/lib/api";
import { HardDrive, CheckCircle2, AlertCircle, ArrowRight, FolderGit2 } from "lucide-react";

const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/10";

type ViewState = "connect" | "connecting" | "success" | "accountChoice" | "error";

export default function ConnectDrivePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { data: status, isLoading: statusLoading } = useDriveStatus();

  const [view, setView] = useState<ViewState>("connect");
  const [error, setError] = useState("");
  const [migrated, setMigrated] = useState(false);
  const [choiceToken, setChoiceToken] = useState<string | null>(null);
  const [resolvingChoice, setResolvingChoice] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Parse the OAuth-redirect query params exactly once on load.
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

  // Already fully connected (e.g. navigated back here manually) — just go to the dashboard.
  useEffect(() => {
    if (!statusLoading && isDriveReady(status) && view === "connect") {
      router.replace("/dashboard");
    }
  }, [statusLoading, status, view, router]);

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

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-400/30 border-t-purple-400" />
      </div>
    );
  }

  if (view === "success") {
    return (
      <AuthPageShell icon={CheckCircle2} title="Google Drive Connected ✓" subtitle="Your Penny Pilot workspace is ready" footer={<Footer variant="dark" />}>
        <div className="space-y-5 text-center">
          <p className="text-sm text-[#94A3B8]">
            {migrated
              ? "Your existing Penny Pilot data has been moved into your Google Drive."
              : "Your financial workspace is ready. Start by adding your first transaction."}
          </p>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" onClick={() => router.replace("/dashboard")} className={primaryButton}>
            Continue to Dashboard <ArrowRight className="h-4 w-4" />
          </motion.button>
        </div>
      </AuthPageShell>
    );
  }

  if (view === "accountChoice") {
    return (
      <AuthPageShell icon={FolderGit2} title="Different Google Account" subtitle="We found existing Penny Pilot data in this Google Drive account" footer={<Footer variant="dark" />}>
        <div className="space-y-5">
          <p className="text-sm text-[#94A3B8]">
            This Google account already has a Penny Pilot workspace in its Drive — possibly from a previous connection.
            Choose what to do:
          </p>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" disabled={resolvingChoice} onClick={() => handleResolveChoice("use_existing")} className={primaryButton}>
            {resolvingChoice ? "Connecting…" : "Use This Existing Data"}
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" disabled={resolvingChoice} onClick={() => handleResolveChoice("start_fresh")} className={secondaryButton}>
            Start a New Empty Workspace
          </motion.button>
        </div>
      </AuthPageShell>
    );
  }

  // A pre-existing account created back when Postgres held financial data gets distinct
  // "migrate" messaging instead of the generic new-user copy — the underlying connect flow is
  // identical either way; only what the user is told up front differs.
  const isLegacyAccount = Boolean(status?.hasLegacyData);
  const title = isLegacyAccount ? "Move your Penny Pilot data to Google Drive" : "Penny Pilot";
  const subtitle = isLegacyAccount ? "One-time migration, nothing is deleted" : "Your money. Your data.";
  const description = isLegacyAccount
    ? "Penny Pilot now stores all financial data in your own Google Drive. We found existing data on your account from before this change — connecting Google Drive will copy it into your new Drive workspace. Your original data is never deleted."
    : "Penny Pilot stores your financial data directly in your Google Drive. Connect your Google account to securely create your personal financial workspace.";
  const connectLabel = isLegacyAccount ? "Connect Google Drive & Migrate Data" : "Connect Google Drive";
  const connectingLabel = view === "connecting" ? "Redirecting to Google…" : isLegacyAccount ? "Migrating your data…" : "Setting up your workspace…";

  return (
    <AuthPageShell icon={HardDrive} title={title} subtitle={subtitle} footer={<Footer variant="dark" />}>
      <div className="space-y-5 text-center">
        <p className="text-sm text-[#94A3B8]">{description}</p>
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-left text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {error && (
          <p className="text-xs text-white/40">
            Nothing was lost — your data is safe. You can retry the connection below.
          </p>
        )}
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" disabled={view === "connecting"} onClick={handleConnect} className={primaryButton}>
          {view === "connecting" ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <HardDrive className="h-4 w-4" />
          )}
          {view === "connecting" ? connectingLabel : error ? "Retry Connection" : connectLabel}
        </motion.button>
        <p className="text-xs text-white/30">Your data remains under your Google account.</p>
      </div>
    </AuthPageShell>
  );
}
