import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { bumpSessionVersion } from "../lib/sessionVersion";
import { logActivity } from "../lib/activityLog";
import { sendEmail } from "../lib/notify";
import { EMAIL_TEMPLATES } from "../lib/emailTemplates";
import { listMigrationStatuses, getMigrationSummary, deriveMigrationState, MigrationState } from "../services/admin/migrationStatus";
import { hasLegacyPostgresData } from "../services/drive/init";

const router = Router();

const MIGRATION_STATES: MigrationState[] = [
  "NEW_USER", "DRIVE_SETUP_REQUIRED", "MIGRATION_REQUIRED", "MIGRATION_IN_PROGRESS", "MIGRATION_COMPLETED", "MIGRATION_FAILED",
];

const ADMIN_ACTIVITY_EVENTS = [
  "user_approved", "user_rejected", "user_updated", "user_deleted",
  "password_reset_by_admin", "uid_reset_by_admin", "force_logout_by_admin",
  "signup_requested", "user_created",
];

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get(
  "/stats",
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers, activeUsers, pendingApprovals, suspendedUsers,
      signupsToday, signupsWeek, signupsMonth,
      recentActivity, migrationSummary,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.activityLog.findMany({
        where: { event: { in: ADMIN_ACTIVITY_EVENTS } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true, email: true } } },
      }),
      getMigrationSummary(),
    ]);

    const signupTrend = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as day, COUNT(*) as count
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    res.json({
      users: { total: totalUsers, active: activeUsers, pending: pendingApprovals, suspended: suspendedUsers },
      signups: { today: signupsToday, week: signupsWeek, month: signupsMonth },
      // No "records" (transactions/budgets/etc.) section — that data now lives in each user's
      // own Google Drive, which the platform has no visibility into by design.
      signupTrend: signupTrend.map((r) => ({ day: r.day, count: Number(r.count) })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id, event: a.event, detail: a.detail, createdAt: a.createdAt,
        user: a.user ? { name: a.user.name, email: a.user.email } : null,
      })),
      migrationSummary,
      systemHealth: { database: "ok", uptimeSeconds: Math.round(process.uptime()) },
    });
  })
);

// ─── GET /api/admin/activity ──────────────────────────────────────────────────
router.get(
  "/activity",
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const { userId, event, from, to } = req.query as { userId?: string; event?: string; from?: string; to?: string };

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (event) where.event = event;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if ((fromDate && !isNaN(fromDate.getTime())) || (toDate && !isNaN(toDate.getTime()))) {
      where.createdAt = {
        ...(fromDate && !isNaN(fromDate.getTime()) && { gte: fromDate }),
        ...(toDate && !isNaN(toDate.getTime()) && { lte: toDate }),
      };
    }

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, email: true, uid: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  })
);

// ─── GET /api/admin/security/summary ─────────────────────────────────────────
router.get(
  "/security/summary",
  asyncHandler(async (_req: Request, res: Response) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const securityEvents = ["login_failed", "password_changed", "password_reset", "uid_changed", "2fa_enabled", "2fa_disabled", "password_reset_requested"];

    const counts = await prisma.activityLog.groupBy({
      by: ["event"],
      where: { event: { in: securityEvents }, createdAt: { gte: since } },
      _count: true,
    });

    const trend = await prisma.$queryRaw<{ day: string; event: string; count: bigint }[]>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as day, "event", COUNT(*) as count
      FROM "ActivityLog"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND "event" IN ('login_failed', 'password_changed', 'password_reset', 'uid_changed', '2fa_enabled', '2fa_disabled')
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `;

    res.json({
      counts: Object.fromEntries(counts.map((c) => [c.event, c._count])),
      trend: trend.map((r) => ({ day: r.day, event: r.event, count: Number(r.count) })),
    });
  })
);

// ─── POST /api/admin/users/:id/force-logout ──────────────────────────────────
router.post(
  "/users/:id/force-logout",
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    bumpSessionVersion(id);
    void logActivity(req, "force_logout_by_admin", `Forced logout for ${target.email}`, req.auth!.userId);
    res.json({ ok: true, message: `${target.name} has been signed out of all sessions.` });
  })
);

// ─── Migration status (Google Drive migration for legacy accounts) ───────────
// Derived entirely from Postgres signals (account + BackupConnection rows) — never calls the
// Google Drive API on a user's behalf, so this view can never expose (or even access) a
// user's Drive contents. See services/admin/migrationStatus.ts.

// ─── GET /api/admin/migration/summary ────────────────────────────────────────
router.get(
  "/migration/summary",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await getMigrationSummary());
  })
);

// ─── GET /api/admin/migration/status ─────────────────────────────────────────
router.get(
  "/migration/status",
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const search = typeof req.query.search === "string" && req.query.search.trim() ? req.query.search.trim() : undefined;
    const stateParam = typeof req.query.state === "string" ? (req.query.state as MigrationState) : undefined;
    const state = stateParam && MIGRATION_STATES.includes(stateParam) ? stateParam : undefined;

    const { items, total } = await listMigrationStatuses(page, pageSize, search, state);
    res.json({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 } });
  })
);

// ─── POST /api/admin/users/:id/notify-migration ──────────────────────────────
// The only safe "action" an admin can take on a stuck/required migration: Google OAuth
// consent can only ever be granted by the account owner, so there is no server-side action
// that can actually retry it on their behalf. This sends a reminder email instead — real,
// idempotent (sending it again just sends another email; no state is mutated).
router.post(
  "/users/:id/notify-migration",
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const [user, connection, hasLegacyData] = await Promise.all([
      prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true } }),
      prisma.backupConnection.findUnique({
        where: { userId_provider: { userId: id, provider: "google_drive" } },
        select: { backupFolderId: true, lastConnectError: true },
      }),
      hasLegacyPostgresData(id),
    ]);
    if (!user || user.role !== "USER") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const state = deriveMigrationState({
      hasLegacyData,
      connected: Boolean(connection),
      initialized: Boolean(connection?.backupFolderId),
      hasError: Boolean(connection?.lastConnectError),
    });
    if (!["MIGRATION_REQUIRED", "MIGRATION_FAILED", "MIGRATION_IN_PROGRESS"].includes(state)) {
      res.status(400).json({ error: "This account does not currently need a migration reminder." });
      return;
    }
    const emailSent = await sendEmail(
      user.email,
      "Action needed: connect Google Drive to Penny Pilot",
      `<p>Hi ${user.name},</p><p>Penny Pilot now stores your financial data in your own Google Drive. Please sign in and connect (or reconnect) Google Drive to continue using your account: your existing data is safe and has not been deleted.</p>`
    );
    void logActivity(req, "migration_reminder_sent", `Sent a Drive-migration reminder to ${user.email}`, req.auth!.userId);
    res.json({ ok: true, emailSent });
  })
);

// ─── GET /api/admin/backup ────────────────────────────────────────────────────
// Platform-wide JSON backup of ACCOUNT records only — role, status, timestamps. Never
// financial data: that lives solely in each user's own Google Drive, which the platform has
// no access to. Admin-account settings/profile (Postgres-backed, see requireDriveConnected)
// are included since those are genuinely this platform's own data, not a user's financial data.
router.get(
  "/backup",
  asyncHandler(async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: {
        id: true, uid: true, email: true, name: true, role: true, status: true, createdAt: true, approvedAt: true,
        settings: { select: { data: true } },
        profile: { select: { data: true } },
      },
    });
    const backup = {
      exportedAt: new Date().toISOString(),
      version: "2.0.0",
      userCount: users.length,
      users: users.map((u) => ({
        uid: u.uid, email: u.email, name: u.name, role: u.role, status: u.status,
        createdAt: u.createdAt, approvedAt: u.approvedAt,
        settings: u.role !== "USER" ? (u.settings?.data ?? null) : null,
        profile: u.role !== "USER" ? (u.profile?.data ?? null) : null,
      })),
    };
    const ds = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="pennypilot-platform-backup-${ds}.json"`);
    res.send(JSON.stringify(backup, null, 2));
    void logActivity(req, "platform_backup_downloaded", `Backup of ${users.length} accounts`, req.auth!.userId);
  })
);

// ─── GET /api/admin/email-templates ──────────────────────────────────────────
router.get(
  "/email-templates",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ items: EMAIL_TEMPLATES });
  })
);

// ─── POST /api/admin/email-templates/:id/test ────────────────────────────────
router.post(
  "/email-templates/:id/test",
  asyncHandler(async (req: Request, res: Response) => {
    const template = EMAIL_TEMPLATES.find((t) => t.id === req.params.id);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!admin) {
      res.status(401).json({ error: "Account not found" });
      return;
    }
    const emailSent = await sendEmail(admin.email, `[Test] Penny Pilot — ${template.name}`, template.html);
    res.json({ emailSent });
  })
);

// ─── GET /api/admin/platform-settings ────────────────────────────────────────
router.get(
  "/platform-settings",
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    res.json(settings);
  })
);

// ─── PATCH /api/admin/platform-settings ──────────────────────────────────────
// Super Admin only — platform-wide configuration shouldn't be delegable to a
// regular Admin per the roles spec.
router.patch(
  "/platform-settings",
  asyncHandler(async (req: Request, res: Response) => {
    if (req.auth!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only a Super Admin can change platform settings" });
      return;
    }
    const { siteName, supportEmail, defaultSessionTimeoutMinutes, minPasswordLength, require2FAForAdmins } = req.body as {
      siteName?: string | null; supportEmail?: string | null; defaultSessionTimeoutMinutes?: number; minPasswordLength?: number; require2FAForAdmins?: boolean;
    };
    const data: Record<string, unknown> = {};
    if (siteName !== undefined) data.siteName = siteName?.trim() || "Penny Pilot";
    if (supportEmail !== undefined) data.supportEmail = supportEmail?.trim() || null;
    if (defaultSessionTimeoutMinutes !== undefined) data.defaultSessionTimeoutMinutes = Math.max(1, Number(defaultSessionTimeoutMinutes) || 30);
    if (minPasswordLength !== undefined) data.minPasswordLength = Math.max(6, Math.min(64, Number(minPasswordLength) || 8));
    if (require2FAForAdmins !== undefined) data.require2FAForAdmins = Boolean(require2FAForAdmins);

    const settings = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });
    void logActivity(req, "platform_settings_updated", "Platform settings changed", req.auth!.userId);
    res.json(settings);
  })
);

export default router;
