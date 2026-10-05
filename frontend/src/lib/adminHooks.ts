"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type MigrationState = "NEW_USER" | "DRIVE_SETUP_REQUIRED" | "MIGRATION_REQUIRED" | "MIGRATION_IN_PROGRESS" | "MIGRATION_COMPLETED" | "MIGRATION_FAILED";

export interface AdminStats {
  timezone: string;
  users: { total: number; explorers: number; active: number; suspended: number; admins: number; superAdmins: number };
  signups: { today: number; week: number; month: number };
  signupTrend: { day: string; count: number }[];
  userActivityTrend: { day: string; count: number }[];
  errorActivityCount: number;
  emailFailureCount: number;
  recentFailedAuth: { id: string; detail: string | null; createdAt: string; user: { name: string; email: string } | null }[];
  recentActivity: { id: string; event: string; detail: string | null; createdAt: string; user: { name: string; email: string } | null }[];
  migrationSummary: Record<MigrationState, number>;
  driveConnectedCount: number;
  systemHealth: {
    database: { status: string; latencyMs: number | null };
    email: { status: string };
    driveApi: { status: string };
    uptimeSeconds: number;
  };
}

/** The one place the dashboard numbers are fetched. Every admin screen shares this query key so they never disagree. */
export function useAdminStats(refetchMs = 60_000) {
  return useQuery({ queryKey: ["admin", "stats"], queryFn: () => api.get<AdminStats>("/api/admin/stats"), refetchInterval: refetchMs });
}

/** Fills the days with no events so charts show a continuous 30-day axis (days are IST calendar dates). */
export function fillDays(rows: { day: string; count: number }[], days = 30): { day: string; count: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const out: { day: string; count: number }[] = [];
  const istNow = new Date(Date.now() + 5.5 * 3600_000);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}
