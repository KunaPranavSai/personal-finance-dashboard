"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search, ShieldAlert, ShieldCheck, Bell, Menu } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useUiStore } from "@/store/uiStore";
import { api } from "@/lib/api";

interface AdminStats {
  systemHealth?: { database?: { status?: string }; uptimeSeconds?: number };
}
interface SecuritySummary {
  counts: Record<string, number>;
}

export function CommandHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setSidebarOpen } = useUiStore();
  const [search, setSearch] = useState("");
  const [spinning, setSpinning] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats", "command-header"],
    queryFn: () => api.get<AdminStats>("/api/admin/stats"),
    refetchInterval: 60_000,
  });
  const { data: security } = useQuery({
    queryKey: ["admin-security-summary", "command-header"],
    queryFn: () => api.get<SecuritySummary>("/api/admin/security/summary"),
    refetchInterval: 60_000,
  });

  const dbOk = stats?.systemHealth?.database?.status === "ok";
  const failedLogins = security?.counts?.login_failed ?? 0;
  const securityLevel = failedLogins > 20 ? "red" : failedLogins > 5 ? "amber" : "green";
  const env = process.env.NODE_ENV === "production" ? "PRODUCTION" : "DEVELOPMENT";

  // "Refresh" only re-fetches this admin console's own data (React Query cache) — it never
  // touches Google Drive or a user's storage in any way, so it must not be confused with a
  // Drive "sync" action.
  const refresh = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setSpinning(false);
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    router.push(`/admin/users?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <header
      className="cc-scrollbar sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-2.5"
      style={{
        borderColor: "var(--cc-border)",
        background: "var(--cc-bg-alt)",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        paddingTop: "max(0.625rem, env(safe-area-inset-top))",
      }}
    >
      <button
        onClick={() => setSidebarOpen(true)}
        className="rounded p-1.5 lg:hidden"
        style={{ color: "var(--cc-text-dim)" }}
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="hidden items-center gap-2 md:flex">
        <span className="cc-status-dot" style={{ background: dbOk ? "var(--cc-green)" : "var(--cc-red)" }} />
        <span className="cc-mono text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cc-text-dim)" }}>
          System {dbOk ? "Online" : "Degraded"}
        </span>
      </div>

      <span className="cc-mono hidden rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest md:inline-block" style={{ borderColor: "var(--cc-border)", color: "var(--cc-text-faint)" }}>
        {env}
      </span>

      <form onSubmit={submitSearch} className="ml-2 flex-1">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--cc-text-faint)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users, UID, email…"
            className="cc-mono w-full rounded border bg-transparent py-1.5 pl-8 pr-2 text-xs"
            style={{ borderColor: "var(--cc-border)", color: "var(--cc-text)" }}
          />
        </div>
      </form>

      <button onClick={refresh} disabled={spinning} className="rounded p-1.5 disabled:opacity-50" style={{ color: "var(--cc-text-dim)" }} aria-label="Refresh data" title="Refresh data">
        <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
      </button>

      <button
        onClick={() => router.push("/admin/activity")}
        className="rounded p-1.5"
        style={{ color: "var(--cc-text-dim)" }}
        aria-label="Recent activity"
        title="Recent activity"
      >
        <Bell className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1.5" title={`${failedLogins} failed logins (30d)`}>
        {securityLevel === "green" ? (
          <ShieldCheck className="h-4 w-4" style={{ color: "var(--cc-green)" }} />
        ) : (
          <ShieldAlert className="h-4 w-4" style={{ color: securityLevel === "red" ? "var(--cc-red)" : "var(--cc-amber)" }} />
        )}
      </div>

      <div className="hidden items-center gap-2 border-l pl-3 md:flex" style={{ borderColor: "var(--cc-border)" }}>
        <div className="text-right">
          <p className="cc-mono text-xs font-semibold" style={{ color: "var(--cc-text)" }}>{user?.name ?? "Admin"}</p>
          <p className="cc-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--cc-text-faint)" }}>{user?.role?.replace("_", " ")}</p>
        </div>
      </div>
    </header>
  );
}
