import { prisma } from "../../lib/prisma";

/**
 * Shared, real-signal system health snapshot — used by both GET /api/admin/stats (dashboard
 * summary) and GET /api/admin/system-health (detailed console), so the two views can never
 * disagree. Every field is either a genuine measurement or explicitly "not_monitored" — never a
 * fabricated green light (per the redesign brief's "no fake metrics" rule).
 */
export interface SystemHealthSnapshot {
  database: { status: "ok" | "error"; latencyMs: number | null };
  email: { status: "configured" | "not_configured" };
  driveApi: { status: "configured" | "not_configured" };
  uptimeSeconds: number;
}

export async function getSystemHealth(): Promise<SystemHealthSnapshot> {
  let database: SystemHealthSnapshot["database"] = { status: "error", latencyMs: null };
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    database = { status: "ok", latencyMs: Date.now() - start };
  } catch {
    database = { status: "error", latencyMs: null };
  }

  return {
    database,
    // We don't make a live network call to Resend/Google on every dashboard load — that would be
    // slow and could itself trip rate limits. "configured" reports the credential is present;
    // the System Health page's Email Preview/Test cards remain the real live check.
    email: { status: process.env.RESEND_API_KEY ? "configured" : "not_configured" },
    driveApi: { status: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "configured" : "not_configured" },
    uptimeSeconds: Math.round(process.uptime()),
  };
}
