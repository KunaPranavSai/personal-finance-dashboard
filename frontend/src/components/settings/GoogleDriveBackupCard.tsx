"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useDriveStatus, isDriveReady, DRIVE_STATUS_QUERY_KEY } from "@/lib/driveStatus";
import { formatDateIN } from "@/lib/format";
import { HardDrive, Unlink, CheckCircle2, ShieldCheck, History, RotateCcw } from "lucide-react";

const COLLECTION_LABELS: Record<string, string> = {
  transactions: "Transactions",
  budgets: "Budgets",
  investments: "Investments",
  bills: "Bills & EMIs",
  goals: "Goals",
  accounts: "Wallets",
  categories: "Categories",
  paymentMethods: "Money Sources",
  settings: "Settings & Profile",
};
const COLLECTIONS = Object.keys(COLLECTION_LABELS);

interface VerifyResult {
  ok: boolean;
  issues: string[];
  collections: Record<string, { count: number; dataVersion: number; lastUpdated: string }>;
}
interface Revision {
  id: string;
  modifiedTime: string;
}
interface RevisionPreview {
  recordCount: number;
  lastUpdated: string;
}

export function GoogleDriveBackupCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: status, isLoading } = useDriveStatus();
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [restoreCollection, setRestoreCollection] = useState<string | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const [revisionPreview, setRevisionPreview] = useState<RevisionPreview | null>(null);

  useEffect(() => {
    if (searchParams.get("driveConnected") === "1") {
      toast("Google Drive connected", "success");
      queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY });
      router.replace("/settings?tab=backup");
    } else if (searchParams.get("driveError")) {
      toast("Failed to connect Google Drive. Please try again.", "error");
      router.replace("/settings?tab=backup");
    }
  }, [searchParams, toast, queryClient, router]);

  const { data: revisions } = useQuery({
    queryKey: ["drive-revisions", restoreCollection],
    queryFn: () => api.get<{ items: Revision[] }>(`/api/drive/restore/${restoreCollection}/revisions`),
    enabled: Boolean(restoreCollection),
  });

  const connectMutation = useMutation({
    mutationFn: () => api.get<{ authUrl: string }>("/api/drive/connect"),
    onSuccess: (data) => { window.location.href = data.authUrl; },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not start Google Drive connection", "error"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete("/api/drive/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY });
      toast("Google Drive disconnected. Reconnect to access your Penny Pilot data.", "success");
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Failed to disconnect", "error"),
  });

  const verifyMutation = useMutation({
    mutationFn: () => api.post<VerifyResult>("/api/drive/verify"),
    onSuccess: (data) => {
      setVerifyResult(data);
      toast(data.ok ? "All your data checks out" : "Some data files failed an integrity check", data.ok ? "success" : "error");
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Verification failed", "error"),
  });

  const previewRevisionMutation = useMutation({
    mutationFn: (revisionId: string) => api.get<RevisionPreview>(`/api/drive/restore/${restoreCollection}/preview?revisionId=${encodeURIComponent(revisionId)}`),
    onSuccess: (data, revisionId) => { setRevisionPreview(data); setSelectedRevision(revisionId); },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not read that version", "error"),
  });

  const restoreMutation = useMutation({
    mutationFn: () => api.post(`/api/drive/restore/${restoreCollection}`, { revisionId: selectedRevision, confirm: true }),
    onSuccess: () => {
      toast(`${COLLECTION_LABELS[restoreCollection ?? ""] ?? "Data"} restored`, "success");
      setRestoreCollection(null); setSelectedRevision(null); setRevisionPreview(null);
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Restore failed", "error"),
  });

  if (isLoading) {
    return <Card><CardContent className="pt-5"><div className="h-16 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Google Drive</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {!status?.configured ? (
          <p className="text-sm text-navy/50 dark:text-white/50">Google Drive isn&apos;t set up on this server yet. Check back soon.</p>
        ) : isDriveReady(status) ? (
          <>
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium text-navy dark:text-white">Connected as {status.accountEmail}</p>
                <p className="text-xs text-navy/50 dark:text-white/50">Your financial data is stored in your Google Drive, in a &quot;Penny Pilot&quot; folder.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
                <ShieldCheck className="h-4 w-4" /> {verifyMutation.isPending ? "Checking…" : "Verify Data"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRestoreCollection(restoreCollection ? null : "transactions")}>
                <History className="h-4 w-4" /> {restoreCollection ? "Hide Restore" : "Restore Data"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                <Unlink className="h-4 w-4" /> Disconnect
              </Button>
            </div>

            {verifyResult && (
              <div className="rounded-lg border border-black/10 p-3 text-xs dark:border-white/10">
                <p className="mb-2 font-medium text-navy dark:text-white">Storage status</p>
                <div className="grid grid-cols-2 gap-1 text-navy/60 dark:text-white/60 sm:grid-cols-3">
                  {Object.entries(verifyResult.collections).map(([key, v]) => (
                    <span key={key}>{COLLECTION_LABELS[key] ?? key}: {v.count}</span>
                  ))}
                </div>
                {verifyResult.issues.length > 0 && (
                  <p className="mt-2 text-red-600 dark:text-red-400">{verifyResult.issues.join("; ")}</p>
                )}
              </div>
            )}

            {restoreCollection && (
              <div className="rounded-lg border border-black/10 p-3 space-y-3 dark:border-white/10">
                <p className="text-xs font-medium text-navy dark:text-white">
                  Restore reverts one data file to an earlier saved version from your Google Drive&apos;s own history — nothing is ever deleted, so you can always restore again.
                </p>
                <select
                  value={restoreCollection}
                  onChange={(e) => { setRestoreCollection(e.target.value); setSelectedRevision(null); setRevisionPreview(null); }}
                  className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white"
                >
                  {COLLECTIONS.map((c) => <option key={c} value={c}>{COLLECTION_LABELS[c]}</option>)}
                </select>

                {!revisions || revisions.items.length === 0 ? (
                  <p className="text-xs text-navy/40 dark:text-white/40">No earlier versions found for this data yet.</p>
                ) : (
                  <ul className="max-h-40 divide-y divide-black/5 overflow-y-auto rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
                    {revisions.items.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => previewRevisionMutation.mutate(r.id)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5 ${selectedRevision === r.id ? "bg-teal/10" : ""}`}
                        >
                          <span className="text-navy/70 dark:text-white/70">{formatDateIN(r.modifiedTime)}</span>
                          {selectedRevision === r.id && <RotateCcw className="h-3.5 w-3.5 text-teal" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {revisionPreview && selectedRevision && (
                  <div className="rounded-lg bg-black/5 p-2 text-xs dark:bg-white/5">
                    <p className="text-navy/70 dark:text-white/70">This version has {revisionPreview.recordCount} record(s), last updated {formatDateIN(revisionPreview.lastUpdated)}.</p>
                    <p className="mt-1 text-navy/40 dark:text-white/40">Restoring replaces your current {COLLECTION_LABELS[restoreCollection]?.toLowerCase()} with this version.</p>
                    <Button size="sm" className="mt-2" variant="danger" onClick={() => restoreMutation.mutate()} disabled={restoreMutation.isPending}>
                      {restoreMutation.isPending ? "Restoring…" : `Restore ${COLLECTION_LABELS[restoreCollection]}`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-navy/60 dark:text-white/60">
              Google Drive is disconnected. Reconnect your Google Drive to access your Penny Pilot data.
            </p>
            <Button size="sm" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              <HardDrive className="h-4 w-4" /> Reconnect Google Drive
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
