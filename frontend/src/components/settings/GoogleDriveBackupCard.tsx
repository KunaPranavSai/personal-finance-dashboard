"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatDateIN } from "@/lib/format";
import { Cloud, CloudUpload, CloudDownload, Unlink, CheckCircle2 } from "lucide-react";

interface BackupStatus {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  lastBackupAt: string | null;
}

interface RestorePreview {
  createdAt: string;
  counts: Record<string, number>;
}

export function GoogleDriveBackupCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["backup-status"],
    queryFn: () => api.get<BackupStatus>("/api/backup/status"),
  });

  useEffect(() => {
    if (searchParams.get("backupConnected") === "1") {
      toast("Google Drive connected", "success");
      queryClient.invalidateQueries({ queryKey: ["backup-status"] });
      router.replace("/settings?tab=backup");
    } else if (searchParams.get("backupError")) {
      toast("Failed to connect Google Drive. Please try again.", "error");
      router.replace("/settings?tab=backup");
    }
  }, [searchParams, toast, queryClient, router]);

  const connectMutation = useMutation({
    mutationFn: () => api.get<{ authUrl: string }>("/api/backup/connect?provider=google_drive"),
    onSuccess: (data) => { window.location.href = data.authUrl; },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not start Google Drive connection", "error"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete("/api/backup/disconnect"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["backup-status"] }); toast("Google Drive disconnected", "success"); },
  });

  const backupNowMutation = useMutation({
    mutationFn: () => api.post("/api/backup/now", {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["backup-status"] }); toast("Backup saved to Google Drive", "success"); },
    onError: (err) => toast(err instanceof Error ? err.message : "Backup failed", "error"),
  });

  const previewRestoreMutation = useMutation({
    mutationFn: () => api.get<RestorePreview>("/api/backup/preview-restore"),
    onSuccess: (data) => setRestorePreview(data),
    onError: (err) => toast(err instanceof Error ? err.message : "No backup found to restore", "error"),
  });

  const restoreMutation = useMutation({
    mutationFn: () => api.post("/api/backup/restore", { confirm: true }),
    onSuccess: () => { setRestorePreview(null); toast("Restore complete", "success"); },
    onError: (err) => toast(err instanceof Error ? err.message : "Restore failed", "error"),
  });

  if (isLoading) {
    return <Card><CardContent className="pt-5"><div className="h-16 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Google Drive Backup</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {!status?.configured ? (
          <p className="text-sm text-navy/50 dark:text-white/50">
            Google Drive backup isn&apos;t set up on this server yet. Check back soon.
          </p>
        ) : status?.connected ? (
          <>
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium text-navy dark:text-white">Connected as {status.accountEmail}</p>
                <p className="text-xs text-navy/50 dark:text-white/50">
                  {status.lastBackupAt ? `Last backup: ${formatDateIN(status.lastBackupAt)}` : "No backup yet"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => backupNowMutation.mutate()} disabled={backupNowMutation.isPending}>
                <CloudUpload className="h-4 w-4" /> {backupNowMutation.isPending ? "Backing up…" : "Backup Now"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => previewRestoreMutation.mutate()} disabled={previewRestoreMutation.isPending}>
                <CloudDownload className="h-4 w-4" /> Restore
              </Button>
              <Button size="sm" variant="ghost" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                <Unlink className="h-4 w-4" /> Disconnect
              </Button>
            </div>

            {restorePreview && (
              <div className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
                <p className="mb-2 font-medium text-navy dark:text-white">
                  Backup from {formatDateIN(restorePreview.createdAt)} includes:
                </p>
                <div className="mb-3 grid grid-cols-2 gap-1 text-xs text-navy/60 dark:text-white/60">
                  {Object.entries(restorePreview.counts).map(([k, v]) => (
                    <span key={k}>{k}: {v}</span>
                  ))}
                </div>
                <p className="mb-2 text-xs text-navy/40 dark:text-white/40">
                  Categories and wallets missing locally will be restored. Existing data won&apos;t be duplicated or overwritten.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => restoreMutation.mutate()} disabled={restoreMutation.isPending}>
                    {restoreMutation.isPending ? "Restoring…" : "Confirm Restore"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRestorePreview(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-navy/60 dark:text-white/60">
              Connect Google Drive to automatically back up your expenses, income, budgets, investments, categories, and settings.
            </p>
            <Button size="sm" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              <Cloud className="h-4 w-4" /> Connect Google Drive
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
