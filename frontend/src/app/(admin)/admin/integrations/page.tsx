"use client";

import { useQuery } from "@tanstack/react-query";
import { Plug, HardDrive, Mail } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard, StatCardSkeleton } from "@/components/admin/StatCard";
import { api } from "@/lib/api";

interface AdminStats {
  driveConnectedCount: number;
  systemHealth: { email: { status: string }; driveApi: { status: string } };
}

/**
 * Read-only integrations status — pulls from the same GET /api/admin/stats (systemHealth +
 * driveConnectedCount) that the Dashboard and System Health pages already use. No new backend
 * surface, no per-account Drive tokens exposed (that boundary is enforced server-side —
 * BackupConnection.accessToken/refreshToken are never selected by any admin endpoint).
 */
export default function AdminIntegrationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats", "integrations"],
    queryFn: () => api.get<AdminStats>("/api/admin/stats"),
  });

  return (
    <>
      <Topbar title="Integrations" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={Plug} title="Integrations" description="Platform-level connections and third-party service configuration status." />

        {isLoading || !data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label="Google Drive API"
              value={data.systemHealth.driveApi.status === "configured" ? "Configured" : "Not Configured"}
              icon={HardDrive}
              tone={data.systemHealth.driveApi.status === "configured" ? "emerald" : "red"}
            />
            <StatCard
              label="Email (Resend)"
              value={data.systemHealth.email.status === "configured" ? "Configured" : "Not Configured"}
              icon={Mail}
              tone={data.systemHealth.email.status === "configured" ? "emerald" : "red"}
            />
          </div>
        )}

        <div className="cc-panel mt-4 p-4">
          <p className="cc-mono mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-faint)" }}>Google Drive Connections</p>
          <p className="text-2xl font-bold cc-mono" style={{ color: "var(--cc-text)" }}>{isLoading ? "—" : data?.driveConnectedCount}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--cc-text-faint)" }}>
            Accounts with a completed, verified Google Drive connection. Per-user connection details live on each account&apos;s User 360 → Storage tab. Drive access tokens are never exposed to this console.
          </p>
        </div>
      </main>
    </>
  );
}
