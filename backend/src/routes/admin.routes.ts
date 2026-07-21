import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { bumpSessionVersion } from "../lib/sessionVersion";
import { logActivity } from "../lib/activityLog";
import { sendEmail } from "../lib/notify";
import { EMAIL_TEMPLATES } from "../lib/emailTemplates";
import { generateSimpleCSV, generateSimpleJSON, generateSimpleExcel, generateSimplePDF, SimpleTable } from "../services/export/simpleTableExporter";

const router = Router();

const REPORT_TYPES = ["users", "signups", "security", "pending"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

async function buildReport(type: ReportType, from?: Date, to?: Date): Promise<SimpleTable> {
  if (type === "users" || type === "signups") {
    const dateFilter = from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {};
    const users = await prisma.user.findMany({
      where: dateFilter,
      orderBy: { createdAt: "desc" },
      select: { name: true, email: true, uid: true, role: true, status: true, createdAt: true, lastLoginAt: true, twoFactorEnabled: true },
    });
    return {
      title: type === "users" ? "All Users" : "Signups",
      headers: ["Name", "Email", "UID", "Role", "Status", "Registered", "Last Login", "2FA"],
      rows: users.map((u) => [
        u.name, u.email, u.uid, u.role, u.status,
        u.createdAt.toLocaleDateString("en-IN"),
        u.lastLoginAt ? u.lastLoginAt.toLocaleDateString("en-IN") : "Never",
        u.twoFactorEnabled ? "Enabled" : "Disabled",
      ]),
    };
  }
  if (type === "pending") {
    const users = await prisma.user.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { name: true, email: true, phone: true, createdAt: true },
    });
    return {
      title: "Pending Approvals",
      headers: ["Name", "Email", "Phone", "Registered"],
      rows: users.map((u) => [u.name, u.email, u.phone ?? "—", u.createdAt.toLocaleDateString("en-IN")]),
    };
  }
  // security
  const securityEvents = ["login_failed", "password_changed", "password_reset", "uid_changed", "2fa_enabled", "2fa_disabled", "password_reset_requested"];
  const dateFilter = from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {};
  const logs = await prisma.activityLog.findMany({
    where: { event: { in: securityEvents }, ...dateFilter },
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { user: { select: { name: true, email: true } } },
  });
  return {
    title: "Security Events",
    headers: ["Event", "User", "Detail", "Time"],
    rows: logs.map((l) => [l.event, l.user ? `${l.user.name} (${l.user.email})` : "—", l.detail ?? "", l.createdAt.toLocaleString("en-IN")]),
  };
}

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
      totalAccounts, totalTransactions, totalBudgets, totalGoals,
      totalInvestments, totalBills, totalCategories,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.account.count(),
      prisma.transaction.count(),
      prisma.budget.count(),
      prisma.goal.count(),
      prisma.investment.count(),
      prisma.bill.count(),
      prisma.category.count(),
      prisma.activityLog.findMany({
        where: { event: { in: ADMIN_ACTIVITY_EVENTS } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true, email: true } } },
      }),
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
      records: {
        accounts: totalAccounts, transactions: totalTransactions, budgets: totalBudgets, goals: totalGoals,
        investments: totalInvestments, bills: totalBills, categories: totalCategories,
      },
      signupTrend: signupTrend.map((r) => ({ day: r.day, count: Number(r.count) })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id, event: a.event, detail: a.detail, createdAt: a.createdAt,
        user: a.user ? { name: a.user.name, email: a.user.email } : null,
      })),
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

// ─── GET /api/admin/reports/:type ────────────────────────────────────────────
router.get(
  "/reports/:type",
  asyncHandler(async (req: Request, res: Response) => {
    const type = req.params.type as ReportType;
    if (!REPORT_TYPES.includes(type)) {
      res.status(400).json({ error: `Invalid report type. Must be one of: ${REPORT_TYPES.join(", ")}` });
      return;
    }
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    const table = await buildReport(type, from && !isNaN(from.getTime()) ? from : undefined, to && !isNaN(to.getTime()) ? to : undefined);
    res.json(table);
  })
);

// ─── GET /api/admin/reports/:type/export ─────────────────────────────────────
router.get(
  "/reports/:type/export",
  asyncHandler(async (req: Request, res: Response) => {
    const type = req.params.type as ReportType;
    if (!REPORT_TYPES.includes(type)) {
      res.status(400).json({ error: `Invalid report type. Must be one of: ${REPORT_TYPES.join(", ")}` });
      return;
    }
    const format = ((req.query.format as string) ?? "csv").toLowerCase();
    const allowed = ["csv", "xlsx", "json", "pdf"];
    if (!allowed.includes(format)) {
      res.status(400).json({ error: `Invalid format. Must be one of: ${allowed.join(", ")}` });
      return;
    }
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    const table = await buildReport(type, from && !isNaN(from.getTime()) ? from : undefined, to && !isNaN(to.getTime()) ? to : undefined);
    const ds = new Date().toISOString().slice(0, 10);

    switch (format) {
      case "csv":
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${type}-report-${ds}.csv"`);
        res.send(generateSimpleCSV(table));
        break;
      case "xlsx":
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${type}-report-${ds}.xlsx"`);
        res.send(await generateSimpleExcel(table));
        break;
      case "json":
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${type}-report-${ds}.json"`);
        res.send(generateSimpleJSON(table));
        break;
      case "pdf":
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${type}-report-${ds}.pdf"`);
        res.send(await generateSimplePDF(table));
        break;
    }
  })
);

// ─── GET /api/admin/backup ────────────────────────────────────────────────────
// Platform-wide JSON backup: per-user app settings/profile + aggregate counts only —
// never individual users' transactions, budgets, investments, bills, or goals.
router.get(
  "/backup",
  asyncHandler(async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: {
        id: true, uid: true, email: true, name: true, role: true, status: true, createdAt: true, approvedAt: true,
        settings: { select: { data: true } },
        profile: { select: { data: true } },
        _count: { select: { transactions: true, budgets: true, investments: true, bills: true, goals: true, categories: true, accounts: true } },
      },
    });
    const backup = {
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      userCount: users.length,
      users: users.map((u) => ({
        uid: u.uid, email: u.email, name: u.name, role: u.role, status: u.status,
        createdAt: u.createdAt, approvedAt: u.approvedAt,
        settings: u.settings?.data ?? null,
        profile: u.profile?.data ?? null,
        recordCounts: u._count,
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
