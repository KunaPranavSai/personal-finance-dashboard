import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { bumpSessionVersion } from "../lib/sessionVersion";
import { logActivity } from "../lib/activityLog";

const router = Router();

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

export default router;
