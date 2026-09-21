import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { bumpSessionVersion } from "../lib/sessionVersion";
import { markSessionRevoked, markSessionsRevoked } from "../lib/sessionRevocation";
import { logActivity } from "../lib/activityLog";
import { sendEmail } from "../lib/notify";
import { EMAIL_TEMPLATES } from "../lib/emailTemplates";
import { resolveEmailHtml, resolveEmailSubject } from "../lib/emailTemplateOverrides";
import { AUTOMATED_EMAIL_TRIGGERS } from "../services/email/automation";
import { listMigrationStatuses, getMigrationSummary, deriveMigrationState, MigrationState } from "../services/admin/migrationStatus";
import { hasLegacyPostgresData } from "../services/drive/init";
import { getSystemHealth } from "../services/admin/systemHealth";
import { lookupGeo } from "../lib/geoip";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { signImpersonation, setImpersonationCookie } from "../lib/tokens";

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
      adminCount, superAdminCount,
      signupsToday, signupsWeek, signupsMonth,
      recentActivity, migrationSummary, driveConnectedCount, health,
      recentFailedAuth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
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
      prisma.backupConnection.count({ where: { provider: "google_drive", backupFolderId: { not: null } } }),
      getSystemHealth(),
      prisma.activityLog.findMany({
        where: { event: "login_failed" },
        orderBy: { createdAt: "desc" },
        take: 10,
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
    // User activity trend (any authenticated action, not just admin-visible ones) — powers the
    // dashboard's "User Activity" Operations Monitor panel from real ActivityLog rows.
    const userActivityTrend = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as day, COUNT(*) as count
      FROM "ActivityLog"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND "userId" IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    // Error activity — any event ending in _failed, over the same 30-day window, for the
    // dashboard's Error Activity panel. No separate "error" table exists; this is the real
    // signal already captured by every failure path that calls logActivity.
    const errorActivityCount = await prisma.activityLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, event: { endsWith: "_failed" } },
    });

    res.json({
      users: {
        total: totalUsers, active: activeUsers, pending: pendingApprovals, suspended: suspendedUsers,
        admins: adminCount, superAdmins: superAdminCount,
      },
      signups: { today: signupsToday, week: signupsWeek, month: signupsMonth },
      // No "records" (transactions/budgets/etc.) section — that data now lives in each user's
      // own Google Drive, which the platform has no visibility into by design.
      signupTrend: signupTrend.map((r) => ({ day: r.day, count: Number(r.count) })),
      userActivityTrend: userActivityTrend.map((r) => ({ day: r.day, count: Number(r.count) })),
      errorActivityCount,
      recentFailedAuth: recentFailedAuth.map((a) => ({
        id: a.id, detail: a.detail, createdAt: a.createdAt,
        user: a.user ? { name: a.user.name, email: a.user.email } : null,
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id, event: a.event, detail: a.detail, createdAt: a.createdAt,
        user: a.user ? { name: a.user.name, email: a.user.email } : null,
      })),
      migrationSummary,
      driveConnectedCount,
      systemHealth: health,
    });
  })
);

// ─── GET /api/admin/activity ──────────────────────────────────────────────────
router.get(
  "/activity",
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const { userId, event, from, to, severity, resource } = req.query as {
      userId?: string; event?: string; from?: string; to?: string; severity?: string; resource?: string;
    };

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    if ((fromDate && !isNaN(fromDate.getTime())) || (toDate && !isNaN(toDate.getTime()))) {
      where.createdAt = {
        ...(fromDate && !isNaN(fromDate.getTime()) && { gte: fromDate }),
        ...(toDate && !isNaN(toDate.getTime()) && { lte: toDate }),
      };
    }
    // No dedicated severity/resource columns exist on ActivityLog — both are derived from the
    // `event` string, same convention as the frontend Timeline/Audit views (e.g. "*_failed" is
    // high severity; the segment before the first "_" is the resource, e.g. "user", "password").
    if (event) {
      where.event = event;
    } else if (resource) {
      where.event = { startsWith: `${resource}_` };
    }
    const HIGH_SEVERITY_TERMS = ["failed", "locked", "suspend"];
    if (severity === "high") {
      where.OR = HIGH_SEVERITY_TERMS.map((t) => ({ event: { contains: t, mode: "insensitive" } }));
    } else if (severity === "normal") {
      where.AND = HIGH_SEVERITY_TERMS.map((t) => ({ event: { not: { contains: t, mode: "insensitive" } } }));
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
    prisma.session.findMany({ where: { userId: id, revokedAt: null }, select: { id: true } }).then((rows) => {
      markSessionsRevoked(rows.map((r) => r.id));
      void prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }).catch(() => {});
    void logActivity(req, "force_logout_by_admin", `Forced logout for ${target.email}`, req.auth!.userId, target.id);
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
// Merges each code-defined template (default/fallback content, with sample data filled in) with
// its EmailTemplateOverride row, if any, so the admin sees exactly what would actually be sent.
router.get(
  "/email-templates",
  asyncHandler(async (_req: Request, res: Response) => {
    const overrides = await prisma.emailTemplateOverride.findMany();
    const overrideByKey = new Map(overrides.map((o) => [o.templateKey, o]));
    const items = EMAIL_TEMPLATES.map((t) => {
      const override = overrideByKey.get(t.id);
      return {
        id: t.id,
        name: t.name,
        defaultHtml: t.html,
        html: override?.enabled && override.html ? override.html : t.html,
        subject: override?.enabled && override.subject ? override.subject : null,
        hasOverride: Boolean(override),
        enabled: override?.enabled ?? true,
      };
    });
    res.json({ items });
  })
);

// ─── PATCH /api/admin/email-templates/:id ────────────────────────────────────
// Upserts an EmailTemplateOverride row for a known registry templateKey. Only html/subject/
// enabled are editable — nothing here lets an admin introduce a new {{placeholder}} the send
// path would actually substitute; the code templates remain plain JS functions with real
// arguments, so an enabled override's html/subject are sent VERBATIM to every recipient of that
// template (no per-recipient name/uid/etc. interpolation). This is disclosed to the admin in the
// response and must be surfaced in the UI, not hidden.
router.patch(
  "/email-templates/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const templateKey = String(req.params.id);
    if (!EMAIL_TEMPLATES.some((t) => t.id === templateKey)) {
      res.status(404).json({ error: "Unknown template — overrides are scoped to existing registry templates only" });
      return;
    }
    const { subject, html, enabled } = req.body as { subject?: string | null; html?: string | null; enabled?: boolean };
    const data: Record<string, unknown> = { updatedById: req.auth!.userId };
    if (subject !== undefined) data.subject = subject;
    if (html !== undefined) data.html = html;
    if (enabled !== undefined) data.enabled = Boolean(enabled);

    const updated = await prisma.emailTemplateOverride.upsert({
      where: { templateKey },
      update: data,
      create: { templateKey, ...data },
    });
    void logActivity(req, "email_template_override_updated", `Updated override for template "${templateKey}"`, req.auth!.userId);
    res.json({
      ...updated,
      warning: "Overridden content is sent as-is to every recipient — it is not re-personalized per user.",
    });
  })
);

// ─── DELETE /api/admin/email-templates/:id ───────────────────────────────────
// "Delete" for one of the 7 built-in registry templates means Restore Default — it removes the
// override row so sends fall back to the code default, never removes send capability for that
// template (there is no concept of a fully custom, non-registry template in this pass).
router.delete(
  "/email-templates/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const templateKey = String(req.params.id);
    const existing = await prisma.emailTemplateOverride.findUnique({ where: { templateKey } });
    if (!existing) {
      res.json({ ok: true, message: "Already using the default template." });
      return;
    }
    await prisma.emailTemplateOverride.delete({ where: { templateKey } });
    void logActivity(req, "email_template_override_restored", `Restored default for template "${templateKey}"`, req.auth!.userId);
    res.json({ ok: true, message: "Restored to the built-in default template." });
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
    const subject = await resolveEmailSubject(template.id, `[Test] Penny Pilot — ${template.name}`);
    const html = await resolveEmailHtml(template.id, template.html);
    const emailSent = await sendEmail(admin.email, subject, html);
    res.json({ emailSent });
  })
);

// ─── Automated Email Rules ───────────────────────────────────────────────────
// The 6 real sendEmail(...) call sites found in auth.routes.ts (see
// services/email/automation.ts). Config here only ever affects the 1 non-security-critical
// trigger ("account_updated") — the other 4 keys always send regardless of `enabled`, and the
// UI/response make that explicit rather than implying a toggle that doesn't actually gate them.
// Elevated to Super-Admin-only: this changes account-facing behavior platform-wide, a broader
// blast radius than a single user's row (Entitlements), so it gets the same restriction as
// Application Settings.
router.get(
  "/automated-emails",
  asyncHandler(async (_req: Request, res: Response) => {
    const configs = await prisma.emailAutomationConfig.findMany();
    const configByKey = new Map(configs.map((c) => [c.triggerKey, c]));
    const items = AUTOMATED_EMAIL_TRIGGERS.map((t) => {
      const config = configByKey.get(t.key);
      return {
        key: t.key,
        name: t.name,
        securityCritical: t.securityCritical,
        templateKey: config?.templateKey ?? t.defaultTemplateKey,
        enabled: config?.enabled ?? true,
        updatedAt: config?.updatedAt ?? null,
      };
    });
    res.json({ items });
  })
);

router.patch(
  "/automated-emails/:key",
  asyncHandler(async (req: Request, res: Response) => {
    if (req.auth!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only a Super Admin can change automated-email configuration" });
      return;
    }
    const triggerKey = String(req.params.key);
    const meta = AUTOMATED_EMAIL_TRIGGERS.find((t) => t.key === triggerKey);
    if (!meta) {
      res.status(404).json({ error: "Unknown automated-email trigger" });
      return;
    }
    const { enabled, templateKey } = req.body as { enabled?: boolean; templateKey?: string };
    if (templateKey && !EMAIL_TEMPLATES.some((t) => t.id === templateKey)) {
      res.status(400).json({ error: "Unknown template key" });
      return;
    }
    const data: Record<string, unknown> = { updatedById: req.auth!.userId };
    if (enabled !== undefined) data.enabled = Boolean(enabled);
    if (templateKey !== undefined) data.templateKey = templateKey;

    const updated = await prisma.emailAutomationConfig.upsert({
      where: { triggerKey },
      update: data,
      create: { triggerKey, ...data },
    });
    void logActivity(req, "automated_email_config_updated", `Updated automation rule "${triggerKey}"`, req.auth!.userId);
    res.json({
      ...updated,
      securityCritical: meta.securityCritical,
      warning: meta.securityCritical
        ? "This trigger is security-critical and always sends regardless of this setting."
        : undefined,
    });
  })
);

router.delete(
  "/automated-emails/:key",
  asyncHandler(async (req: Request, res: Response) => {
    if (req.auth!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only a Super Admin can change automated-email configuration" });
      return;
    }
    const triggerKey = String(req.params.key);
    const existing = await prisma.emailAutomationConfig.findUnique({ where: { triggerKey } });
    if (!existing) {
      res.json({ ok: true, message: "Already using defaults (enabled, default template)." });
      return;
    }
    await prisma.emailAutomationConfig.delete({ where: { triggerKey } });
    void logActivity(req, "automated_email_config_reset", `Reset automation rule "${triggerKey}" to defaults`, req.auth!.userId);
    res.json({ ok: true, message: "Reset to defaults." });
  })
);

// ─── Direct Admin Email Composer ─────────────────────────────────────────────
// A separate, manual-trigger action — never writes to Announcement or EmailAutomationConfig.
// SUPER_ADMIN only (same tier as automated-email config, since this can reach arbitrary
// addresses). Reuses the existing sendEmail() — no second delivery path — and the same
// resolveEmailHtml/renderer used by Email Templates for template-based sends.
const MAX_RECIPIENTS = 20;
type ComposerRecipient = { type: "user"; userId: string } | { type: "email"; address: string };

router.post(
  "/email/send",
  asyncHandler(async (req: Request, res: Response) => {
    if (req.auth!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only a Super Admin can send direct emails" });
      return;
    }
    const {
      recipients, subject, templateKey, customHtml, isTest,
    } = req.body as {
      recipients?: ComposerRecipient[]; subject?: string; templateKey?: string; customHtml?: string; isTest?: boolean;
    };

    if (!subject?.trim()) {
      res.status(400).json({ error: "Subject is required" });
      return;
    }
    const template = templateKey ? EMAIL_TEMPLATES.find((t) => t.id === templateKey) : undefined;
    if (templateKey && !template) {
      res.status(400).json({ error: "Unknown template key" });
      return;
    }
    if (!template && !customHtml?.trim()) {
      res.status(400).json({ error: "Provide either a template or custom body content" });
      return;
    }

    // Security-critical parity with automated emails: a template flagged security-critical in
    // the automation registry is never eligibility-gated here either, even sent manually.
    const triggerMeta = template ? AUTOMATED_EMAIL_TRIGGERS.find((t) => t.defaultTemplateKey === template.id) : undefined;
    const securityCritical = triggerMeta?.securityCritical ?? false;

    // Test mode is backend-enforced to the logged-in admin's own address — the submitted
    // recipient list is never used for a test send, so this can never reach another real user.
    let resolvedRecipients: { to: string; userId: string | null; name: string | null }[];
    if (isTest) {
      const admin = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { email: true, name: true, id: true } });
      if (!admin) {
        res.status(401).json({ error: "Account not found" });
        return;
      }
      resolvedRecipients = [{ to: admin.email, userId: admin.id, name: admin.name }];
    } else {
      if (!recipients || recipients.length === 0) {
        res.status(400).json({ error: "At least one recipient is required" });
        return;
      }
      if (recipients.length > MAX_RECIPIENTS) {
        res.status(400).json({ error: `A single send is capped at ${MAX_RECIPIENTS} recipients` });
        return;
      }
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const userIds = recipients.filter((r): r is { type: "user"; userId: string } => r.type === "user").map((r) => r.userId);
      const users = userIds.length
        ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } })
        : [];
      const userById = new Map(users.map((u) => [u.id, u]));

      resolvedRecipients = [];
      for (const r of recipients) {
        if (r.type === "user") {
          const u = userById.get(r.userId);
          if (!u) {
            res.status(400).json({ error: `Unknown user id: ${r.userId}` });
            return;
          }
          resolvedRecipients.push({ to: u.email, userId: u.id, name: u.name });
        } else {
          const address = String(r.address ?? "").trim();
          if (!emailRe.test(address)) {
            res.status(400).json({ error: `Invalid email address: ${address}` });
            return;
          }
          resolvedRecipients.push({ to: address, userId: null, name: null });
        }
      }
    }

    // Entitlement email-eligibility — only applies to known platform users, and only for
    // non-security-critical sends. Manually-entered addresses have no entitlement row to check.
    const eligibilityChecks = await Promise.all(
      resolvedRecipients.map(async (r) => {
        if (securityCritical || !r.userId) return { ...r, eligible: true };
        const entitlement = await prisma.userEntitlement.findUnique({ where: { userId: r.userId } });
        return { ...r, eligible: entitlement?.emailEligible ?? true };
      })
    );

    const results = await Promise.all(
      eligibilityChecks.map(async (r) => {
        if (!r.eligible) {
          return { to: r.to, success: false, skipped: true, reason: "email-ineligible" };
        }
        const vars: Record<string, string> = {};
        if (r.name) vars.name = r.name;
        const defaultHtml = template ? template.html : (customHtml as string);
        const html = template ? await resolveEmailHtml(template.id, defaultHtml, vars) : defaultHtml;
        const finalSubject = template ? await resolveEmailSubject(template.id, subject) : subject;
        const sent = await sendEmail(r.to, finalSubject, html);
        return { to: r.to, success: sent, skipped: false, reason: sent ? undefined : "delivery-failed" };
      })
    );

    const successCount = results.filter((r) => r.success).length;
    void logActivity(
      req,
      "admin_direct_email_sent",
      `${isTest ? "[Test] " : ""}Sent "${template ? template.name : "custom message"}" to ${results.length} recipient(s) — ${successCount} succeeded`,
      req.auth!.userId
    );

    res.json({ results, successCount, totalCount: results.length });
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

// ─── User 360° detail (Phase 4) ────────────────────────────────────────────────
// One aggregating endpoint composing data already available from existing sources — avoids
// N+1 new endpoints. Never selects secret fields (twoFactorSecret/backup codes/passwordHash/
// resetOtpHash, Passkey credentialId/publicKey, BackupConnection access/refreshToken) or any
// financial model (Transaction/Budget/Investment/Bill/Goal).
router.get(
  "/users/:id/detail",
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, uid: true, email: true, name: true, phone: true, role: true, status: true,
        twoFactorEnabled: true, mustChangePassword: true, failedLoginAttempts: true, lockedUntil: true,
        onboardedAt: true, approvedAt: true, rejectedAt: true, rejectionReason: true,
        lastLoginAt: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Admin-initiated events about this user set the real targetUserId column (see
    // logActivity/activityLog.ts) — no text/email matching, exact FK match only.
    const targetActivityWhere = { OR: [{ userId: id }, { targetUserId: id }] };

    const [backupConnection, passkeys, sessions, notifications, unreadCount, activity, appSettings, appProfile, hasLegacyData] = await Promise.all([
      prisma.backupConnection.findUnique({
        where: { userId_provider: { userId: id, provider: "google_drive" } },
        select: {
          accountEmail: true, backupFolderId: true, tokenExpiresAt: true,
          lastConnectAttemptAt: true, lastConnectError: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.passkey.findMany({
        where: { userId: id },
        select: { id: true, name: true, deviceType: true, backedUp: true, transports: true, lastUsedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.session.findMany({ where: { userId: id }, orderBy: { lastSeenAt: "desc" }, take: 50 }),
      prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, type: true, title: true, read: true, createdAt: true } }),
      prisma.notification.count({ where: { userId: id, read: false } }),
      prisma.activityLog.findMany({ where: targetActivityWhere, orderBy: { createdAt: "desc" }, take: 10 }),
      // Preferences (theme/currency/date format/etc.) are UI prefs, not financial data — shown
      // for every role, including USER, per explicit direction (documented judgment call).
      prisma.appSettings.findUnique({ where: { userId: id }, select: { data: true } }),
      prisma.appProfile.findUnique({ where: { userId: id }, select: { data: true } }),
      user.role === "USER" ? hasLegacyPostgresData(id) : Promise.resolve(false),
    ]);

    const migrationState = deriveMigrationState({
      hasLegacyData,
      connected: Boolean(backupConnection),
      initialized: Boolean(backupConnection?.backupFolderId),
      hasError: Boolean(backupConnection?.lastConnectError),
    });

    const sessionsWithGeo = sessions.map((s) => ({ ...s, geo: lookupGeo(s.ip) }));
    const lastSession = sessionsWithGeo[0] ?? null;

    res.json({
      user,
      overview: {
        registeredAt: user.createdAt,
        registeredIp: "Not recorded", // signup does not capture IP — see report
        lastLogin: user.lastLoginAt,
        lastLoginIp: lastSession?.ip ?? null,
        lastLoginGeo: lastSession?.geo ?? null,
        lastLoginDevice: lastSession ? `${lastSession.browser ?? "Unknown"} · ${lastSession.os ?? "Unknown"} · ${lastSession.device ?? "Unknown"}` : "Not recorded",
        activeSessionCount: sessions.filter((s) => !s.revokedAt).length,
        macAddress: "N/A — no HTTP/infrastructure signal can provide a client's MAC address",
      },
      storage: {
        connected: Boolean(backupConnection),
        accountEmail: backupConnection?.accountEmail ?? null,
        migrationState,
        lastConnectAttemptAt: backupConnection?.lastConnectAttemptAt ?? null,
        lastConnectError: backupConnection?.lastConnectError ?? null,
        connectedAt: backupConnection?.createdAt ?? null,
        updatedAt: backupConnection?.updatedAt ?? null,
      },
      security: {
        twoFactorEnabled: user.twoFactorEnabled,
        passkeyCount: passkeys.length,
        passkeys,
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil,
      },
      sessions: sessionsWithGeo,
      notifications: { items: notifications, unreadCount },
      preferences: { settings: appSettings?.data ?? null, profile: appProfile?.data ?? null },
      activity, // recent-10 preview only; full paginated/filtered list is GET /users/:id/activity
    });
  })
);

// ─── GET /api/admin/users/:id/activity — User 360 Activity tab, paginated ───────
// Server-side filtered by the validated :id route param (never a client-supplied userId query
// param) — same event/date-range filter pattern as the global GET /admin/activity, scoped with
// the same OR(userId=target, detail mentions target email) match used in /detail above so
// admin-initiated events about this user are included, not just their own self-actions. Actor
// name is joined via the event's own `user` relation (that user IS the actor for admin-initiated
// events, per how logActivity is called throughout the app).
router.get(
  "/users/:id/activity",
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const { event, from, to } = req.query as { event?: string; from?: string; to?: string };

    // Real FK match only — no text/email matching. userId covers self-actions (and, for
    // historical rows predating targetUserId, whatever they already captured); targetUserId
    // covers every admin→this-user action logged since this column was added.
    const where: Record<string, unknown> = { OR: [{ userId: id }, { targetUserId: id }] };
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
        where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);

    const formatted = items.map((a) => ({
      id: a.id, event: a.event, detail: a.detail, createdAt: a.createdAt,
      ip: a.ip, browser: a.browser, os: a.os, device: a.device,
      geo: lookupGeo(a.ip),
      // targetUserId set = an admin action on this user; a.user (via userId) is the actor.
      // No targetUserId = a self-action; a.user is the target themself (no Actor/Target split).
      actor: a.targetUserId === id && a.user ? { name: a.user.name, email: a.user.email } : null,
      isSelfAction: a.user?.id === id,
    }));

    res.json({ items: formatted, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  })
);

// ─── Access & Entitlements ──────────────────────────────────────────────────────
// Extensible, non-billing per-user feature/limit config (UserEntitlement) — explicitly NOT a
// subscription/billing system. Never touches financial models; features/limits are opaque JSON
// the admin sets, not anything the platform currently enforces server-side (see caveat in the
// frontend tab's own disclosure copy).
router.get(
  "/users/:id/entitlements",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const entitlement = await prisma.userEntitlement.findUnique({ where: { userId } });
    res.json(
      entitlement ?? {
        userId, planLabel: "FREE", features: {}, limits: {}, restricted: false,
        notifyEligible: true, emailEligible: true, updatedById: null, createdAt: null, updatedAt: null,
      }
    );
  })
);

router.patch(
  "/users/:id/entitlements",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.params.id);
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { planLabel, features, limits, restricted, notifyEligible, emailEligible } = req.body as {
      planLabel?: string; features?: Record<string, boolean>; limits?: Record<string, number | null>;
      restricted?: boolean; notifyEligible?: boolean; emailEligible?: boolean;
    };
    if (features && (typeof features !== "object" || Array.isArray(features))) {
      res.status(400).json({ error: "features must be an object of booleans" });
      return;
    }
    if (limits && (typeof limits !== "object" || Array.isArray(limits))) {
      res.status(400).json({ error: "limits must be an object of numbers" });
      return;
    }
    const data: Record<string, unknown> = { updatedById: req.auth!.userId };
    if (planLabel !== undefined) data.planLabel = String(planLabel).trim().slice(0, 40) || "FREE";
    if (features !== undefined) data.features = features;
    if (limits !== undefined) data.limits = limits;
    if (restricted !== undefined) data.restricted = Boolean(restricted);
    if (notifyEligible !== undefined) data.notifyEligible = Boolean(notifyEligible);
    if (emailEligible !== undefined) data.emailEligible = Boolean(emailEligible);

    const updated = await prisma.userEntitlement.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    void logActivity(req, "entitlements_updated", `Updated entitlements for ${target.email}`, req.auth!.userId, target.id);
    res.json(updated);
  })
);

// ─── Sessions (Phase 3) ────────────────────────────────────────────────────────
// GET /api/admin/users/:id/sessions — non-revoked sessions for a user (Sessions tab / User 360).
router.get(
  "/users/:id/sessions",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.params.id);
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    });
    res.json({ items: sessions });
  })
);

// POST /api/admin/users/:id/sessions/:sessionId/revoke — marks one session revoked.
// True single-device revoke: authenticate()/​POST /refresh (middleware/auth.ts,
// routes/auth.routes.ts) reject any request whose token carries this sessionId once it's in the
// in-memory revoked-session cache (lib/sessionRevocation.ts) — this no longer touches
// sessionVersion, so every other device/session for this user is unaffected.
router.post(
  "/users/:id/sessions/:sessionId/revoke",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.params.id);
    const sessionId = String(req.params.sessionId);
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    markSessionRevoked(sessionId);
    void logActivity(req, "session_revoked_by_admin", `Revoked one session for ${target.email}`, req.auth!.userId, target.id);
    res.json({
      ok: true,
      message: `That device's session has been revoked. ${target.name}'s other sessions are unaffected.`,
    });
  })
);

// ─── Announcements (Phase 9) ───────────────────────────────────────────────────
// Platform-wide content, kept in its own model — never materialized into per-user
// Notification rows, and never touches financial data.
router.get(
  "/announcements",
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query as { status?: string };
    const where: Record<string, unknown> = {};
    if (status && ["DRAFT", "SCHEDULED", "PUBLISHED", "EXPIRED"].includes(status)) {
      if (status === "EXPIRED") {
        where.expireAt = { lt: new Date() };
      } else {
        where.status = status;
      }
    }
    const items = await prisma.announcement.findMany({ where, orderBy: { createdAt: "desc" } });
    // status is stored explicitly for DRAFT/SCHEDULED/PUBLISHED but EXPIRED is derived at
    // read-time from expireAt, so a PUBLISHED row past its expiry is surfaced as EXPIRED here.
    const now = new Date();
    const withDerivedStatus = items.map((a) => ({
      ...a,
      status: a.expireAt && a.expireAt < now ? "EXPIRED" : a.status,
    }));
    res.json({ items: withDerivedStatus });
  })
);

router.post(
  "/announcements",
  asyncHandler(async (req: Request, res: Response) => {
    const { title, body, type, priority, audience, publishAt, expireAt, publishNow } = req.body as {
      title?: string; body?: string; type?: string; priority?: string; audience?: string;
      publishAt?: string | null; expireAt?: string | null; publishNow?: boolean;
    };
    if (!title?.trim() || !body?.trim()) {
      res.status(400).json({ error: "Title and body are required" });
      return;
    }
    const status = publishNow ? "PUBLISHED" : publishAt ? "SCHEDULED" : "DRAFT";
    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        type: (type as never) ?? "INFO",
        priority: (priority as never) ?? "NORMAL",
        audience: audience?.trim() || "ALL",
        status: status as never,
        publishAt: publishNow ? new Date() : publishAt ? new Date(publishAt) : null,
        expireAt: expireAt ? new Date(expireAt) : null,
        createdById: req.auth!.userId,
      },
    });
    void logActivity(req, "announcement_created", `Created announcement "${announcement.title}" (${announcement.status})`, req.auth!.userId);
    res.status(201).json(announcement);
  })
);

router.patch(
  "/announcements/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Announcement not found" });
      return;
    }
    const { title, body, type, priority, audience, status, publishAt, expireAt } = req.body as {
      title?: string; body?: string; type?: string; priority?: string; audience?: string;
      status?: string; publishAt?: string | null; expireAt?: string | null;
    };
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title.trim();
    if (body !== undefined) data.body = body.trim();
    if (type !== undefined) data.type = type;
    if (priority !== undefined) data.priority = priority;
    if (audience !== undefined) data.audience = audience.trim() || "ALL";
    if (status !== undefined) data.status = status;
    if (publishAt !== undefined) data.publishAt = publishAt ? new Date(publishAt) : null;
    if (expireAt !== undefined) data.expireAt = expireAt ? new Date(expireAt) : null;

    const updated = await prisma.announcement.update({ where: { id }, data });
    void logActivity(req, "announcement_updated", `Updated announcement "${updated.title}"`, req.auth!.userId);
    res.json(updated);
  })
);

router.post(
  "/announcements/:id/publish",
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Announcement not found" });
      return;
    }
    const updated = await prisma.announcement.update({
      where: { id },
      data: { status: "PUBLISHED", publishAt: existing.publishAt ?? new Date() },
    });
    void logActivity(req, "announcement_published", `Published announcement "${updated.title}"`, req.auth!.userId);
    res.json(updated);
  })
);

router.delete(
  "/announcements/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Announcement not found" });
      return;
    }
    await prisma.announcement.delete({ where: { id } });
    void logActivity(req, "announcement_deleted", `Deleted announcement "${existing.title}"`, req.auth!.userId);
    res.json({ ok: true });
  })
);

// ─── Access as User (impersonation) — break-glass, SUPER_ADMIN only ─────────
// OTP pattern copied from the existing recovery-OTP flow (auth.routes.ts): crypto-random
// 6-digit code, bcrypt-hashed at rest, 5-minute expiry, 5-attempt cap. The OTP goes to the
// TARGET user's email (never the admin's) — this is a user-consent code, not a login code, so
// an admin can't grant themself access without the account owner seeing it. Always sent
// regardless of emailEligible — security-critical by definition, same bypass rule as password
// reset.
const IMPERSONATION_OTP_TTL_MS = 5 * 60 * 1000;
const MAX_IMPERSONATION_OTP_ATTEMPTS = 5;
function generateImpersonationOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

router.post(
  "/users/:id/access-request",
  asyncHandler(async (req: Request, res: Response) => {
    if (req.auth!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only a Super Admin can access a user's account" });
      return;
    }
    const targetUserId = String(req.params.id);
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target.role !== "USER") {
      res.status(400).json({ error: "Access as User only applies to regular user accounts" });
      return;
    }
    const otp = generateImpersonationOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const request = await prisma.impersonationRequest.create({
      data: { adminId: req.auth!.userId, targetUserId, otpHash, otpExpiresAt: new Date(Date.now() + IMPERSONATION_OTP_TTL_MS) },
    });
    await sendEmail(
      target.email,
      "Penny Pilot — Admin access verification code",
      `<p>An administrator (${req.auth!.uid}) has requested access to your account for support purposes.</p><p>Verification code: <strong>${otp}</strong></p><p>If you did not expect this, contact support immediately.</p>`
    );
    void logActivity(req, "ADMIN_USER_ACCESS_REQUESTED", `Requested access to ${target.email}`, req.auth!.userId, targetUserId);
    res.json({ requestId: request.id, expiresAt: request.otpExpiresAt });
  })
);

router.post(
  "/users/:id/access-verify",
  asyncHandler(async (req: Request, res: Response) => {
    if (req.auth!.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Only a Super Admin can access a user's account" });
      return;
    }
    const targetUserId = String(req.params.id);
    const { requestId, code } = req.body as { requestId?: string; code?: string };
    const request = await prisma.impersonationRequest.findUnique({ where: { id: String(requestId) } });
    if (
      !request || request.adminId !== req.auth!.userId || request.targetUserId !== targetUserId ||
      request.revokedAt || request.consumedAt || Date.now() > request.otpExpiresAt.getTime()
    ) {
      void logActivity(req, "ADMIN_USER_ACCESS_DENIED", `Invalid/expired access request for user ${targetUserId}`, req.auth!.userId, targetUserId);
      res.status(401).json({ error: "This verification code has expired. Request a new one.", code: "AUTH_EXPIRED" });
      return;
    }
    if (request.attempts >= MAX_IMPERSONATION_OTP_ATTEMPTS) {
      res.status(429).json({ error: "Too many attempts. Request a new code." });
      return;
    }
    const ok = await bcrypt.compare(String(code ?? ""), request.otpHash);
    if (!ok) {
      await prisma.impersonationRequest.update({ where: { id: request.id }, data: { attempts: { increment: 1 } } });
      void logActivity(req, "ADMIN_USER_ACCESS_DENIED", `Wrong code for access request ${request.id}`, req.auth!.userId, targetUserId);
      res.status(401).json({ error: "Incorrect code", code: "AUTH_INVALID" });
      return;
    }
    await prisma.impersonationRequest.update({ where: { id: request.id }, data: { consumedAt: new Date() } });
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    setImpersonationCookie(res, signImpersonation(req.auth!.userId, targetUserId, request.id));
    void logActivity(req, "ADMIN_USER_ACCESS_GRANTED", `Granted access to ${target.email}`, req.auth!.userId, targetUserId);
    res.json({ ok: true, target: { id: target.id, name: target.name, email: target.email, uid: target.uid }, expiresAt: Date.now() + 20 * 60 * 1000 });
  })
);

export default router;
