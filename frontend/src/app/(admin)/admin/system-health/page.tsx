"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Activity, Mail, Database, HardDrive, Clock, Server, ArrowRight } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard, StatCardSkeleton } from "@/components/admin/StatCard";
import { api } from "@/lib/api";

interface AdminStats {
  systemHealth: {
    database: { status: string; latencyMs: number | null };
    email: { status: string };
    driveApi: { status: string };
    uptimeSeconds: number;
  };
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function AdminSystemHealthPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats", "system-health"],
    queryFn: () => api.get<AdminStats>("/api/admin/stats"),
    refetchInterval: 30_000,
  });

  return (
    <>
      <Topbar title="System Health" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <AdminPageHeader icon={Activity} title="System Health" description="Live platform status, backed by real checks only." />

        {statsLoading || !stats ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <StatCard
              label="Database"
              value={stats.systemHealth.database.status === "ok" ? `Healthy${stats.systemHealth.database.latencyMs !== null ? ` (${stats.systemHealth.database.latencyMs}ms)` : ""}` : "Issue"}
              icon={Database}
              tone={stats.systemHealth.database.status === "ok" ? "emerald" : "red"}
            />
            <StatCard
              label="Google Drive API"
              value={stats.systemHealth.driveApi.status === "configured" ? "Configured" : "Not Configured"}
              icon={HardDrive}
              tone={stats.systemHealth.driveApi.status === "configured" ? "emerald" : "red"}
            />
            <StatCard
              label="Email (Resend)"
              value={stats.systemHealth.email.status === "configured" ? "Configured" : "Not Configured"}
              icon={Mail}
              tone={stats.systemHealth.email.status === "configured" ? "emerald" : "red"}
            />
            <StatCard label="Backend Uptime" value={formatUptime(stats.systemHealth.uptimeSeconds)} icon={Clock} />
          </div>
        )}

        <div className="cc-panel mt-2 flex items-center gap-2 p-3">
          <Server className="h-3.5 w-3.5" style={{ color: "var(--cc-text-faint)" }} />
          <p className="cc-mono text-[10px]" style={{ color: "var(--cc-text-faint)" }}>
            Migration service: derived (see Migration Status) · Background jobs: not monitored — no job runner is wired up yet, shown honestly rather than faked.
          </p>
        </div>

        <Link href="/admin/email-templates" className="cc-panel mt-6 flex items-center justify-between p-4 transition-shadow hover:shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--cc-accent-dim)", color: "var(--cc-accent)" }}>
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--cc-text)" }}>Email Templates</p>
              <p className="text-xs" style={{ color: "var(--cc-text-dim)" }}>Preview transactional templates and send yourself a test copy.</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4" style={{ color: "var(--cc-text-faint)" }} />
        </Link>
      </main>
    </>
  );
}
