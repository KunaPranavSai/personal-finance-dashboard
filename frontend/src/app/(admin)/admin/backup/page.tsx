"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Database, Download, Info, CheckCircle } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { api, API_BASE_URL } from "@/lib/api";

interface AdminActivityItem {
  id: string;
  event: string;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export default function AdminBackupPage() {
  const [downloading, setDownloading] = useState(false);
  const [justDownloaded, setJustDownloaded] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-backup-history"],
    queryFn: () => api.get<{ items: AdminActivityItem[] }>("/api/admin/activity?event=platform_backup_downloaded&pageSize=20"),
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/backup`, { credentials: "include" });
      if (!res.ok) throw new Error("Backup failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?(.+?)"?$/);
      const filename = match ? match[1] : `pennypilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setJustDownloaded(true);
      setTimeout(() => setJustDownloaded(false), 3000);
      refetch();
    } finally {
      setDownloading(false);
    }
  };

  const items = data?.items ?? [];

  return (
    <>
      <Topbar title="Backup & Restore" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={Database} title="Backup & Restore" description="Download a full platform snapshot for safekeeping." />

        <Card className="mb-6">
          <CardContent className="pt-5">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-navy dark:text-white">Download Full Backup</p>
                <p className="mt-1 text-sm text-navy/60 dark:text-white/60">
                  Every account&apos;s settings, profile, and record counts — as JSON.
                </p>
              </div>
              <Button onClick={handleDownload} disabled={downloading}>
                {justDownloaded ? <CheckCircle className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {downloading ? "Preparing…" : justDownloaded ? "Downloaded" : "Download Backup"}
              </Button>
            </div>
            {justDownloaded && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-teal">
                Backup downloaded successfully.
              </motion.p>
            )}
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Restore-from-file is intentionally not available — restoring arbitrary data into a live multi-tenant
              database is a high-risk operation that deserves its own dedicated safety review, not a bolt-on control.
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-black/5 p-3 text-xs text-navy/50 dark:bg-white/5 dark:text-white/50">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Backups never include individual transactions, budget line items, investments, bills, or goals — only
              account metadata and aggregate record counts, consistent with the platform&apos;s privacy boundary.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Backup History</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
            ) : items.length === 0 ? (
              <EmptyState icon={Database} title="No backups yet" description="Downloaded backups will be listed here." />
            ) : (
              <div className="space-y-2">
                {items.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 text-sm dark:border-white/10">
                    <span className="text-navy/70 dark:text-white/70">{a.user ? `${a.user.name} (${a.user.email})` : "—"}</span>
                    <span className="text-xs text-navy/40 dark:text-white/40">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
