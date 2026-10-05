import { Router, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import { logActivity } from "../lib/activityLog";
import { sendEmail } from "../lib/notify";
import { requireRole } from "../middleware/auth";
import { EMAIL_TEMPLATES } from "../lib/emailTemplates";
import { globalTags, renderPlain, renderTemplate, sampleVars, TEMPLATE_TAGS } from "../lib/emailTemplateRenderer";
import { resolveEmailHtml, resolveEmailSubject } from "../lib/emailTemplateOverrides";
import { brandText } from "../lib/platformConfig";
import { Block, builtInDefaults, compileBlocks, compileHtmlMode, tagProblems, validateBlocks } from "../lib/emailBlocks";

/**
 * Email Builder API (mounted at /api/admin/email-builder, Super Admin only).
 * Lifecycle per email: built-in design -> DRAFT (saved, not live) -> PUBLISHED (what is sent) -> ARCHIVED (history).
 * Publishing is refused unless every required variable (e.g. the code in a sign-in email) is present.
 */
const router = Router();
router.use(requireRole("SUPER_ADMIN"));

const key = (req: Request) => String(req.params.key);
const known = (k: string) => EMAIL_TEMPLATES.some((t) => t.id === k);
const MAX_SUBJECT = 200;
const MAX_PREHEADER = 200;

interface DraftBody { subject?: unknown; preheader?: unknown; mode?: unknown; blocks?: unknown; html?: unknown }

/** Validates a draft payload and compiles it. Returns errors instead of throwing so the UI can list them all. */
function build(templateKey: string, body: DraftBody) {
  const errors: string[] = [];
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, MAX_SUBJECT) : "";
  const preheader = typeof body.preheader === "string" ? body.preheader.trim().slice(0, MAX_PREHEADER) : "";
  if (!subject) errors.push("The subject line cannot be empty.");
  const mode = body.mode === "html" ? "html" : "blocks";
  let compiled = "";
  let blocks: Block[] | null = null;
  let customHtml: string | null = null;
  if (mode === "blocks") {
    const v = validateBlocks(body.blocks);
    errors.push(...v.errors);
    if (v.blocks.length === 0) errors.push("Add at least one block.");
    blocks = v.blocks;
    if (errors.length === 0) compiled = compileBlocks(blocks, preheader);
  } else {
    const raw = typeof body.html === "string" ? body.html : "";
    if (!raw.trim()) errors.push("The HTML cannot be empty.");
    const title = subject || "Message";
    const r = compileHtmlMode(raw, preheader, title);
    customHtml = r.sanitized;
    compiled = r.html;
  }
  const problems = compiled ? tagProblems(templateKey, compiled, subject) : { missingRequired: [] as string[], unknown: [] as string[] };
  return { errors, subject, preheader, mode, blocks, customHtml, compiled, ...problems };
}

const publicVersion = (v: { id: string; version: number; status: string; subject: string; preheader: string; mode: string; blocks: unknown; customHtml: string | null; createdAt: Date; publishedAt: Date | null }) => ({
  id: v.id, version: v.version, status: v.status, subject: v.subject, preheader: v.preheader, mode: v.mode, blocks: v.blocks, customHtml: v.customHtml, createdAt: v.createdAt, publishedAt: v.publishedAt,
});

async function nextVersion(templateKey: string) {
  const last = await prisma.emailTemplateVersion.findFirst({ where: { templateKey }, orderBy: { version: "desc" }, select: { version: true } });
  return (last?.version ?? 0) + 1;
}

// ─── GET /:key ───────────────────────────────────────────────────────────────
router.get(
  "/:key",
  asyncHandler(async (req: Request, res: Response) => {
    const k = key(req);
    if (!known(k)) { res.status(404).json({ error: "Unknown email" }); return; }
    const [versions, legacy] = await Promise.all([
      prisma.emailTemplateVersion.findMany({ where: { templateKey: k }, orderBy: { version: "desc" }, take: 30 }),
      prisma.emailTemplateOverride.findUnique({ where: { templateKey: k } }),
    ]);
    const creators = await prisma.user.findMany({ where: { id: { in: versions.map((v) => v.createdById).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    const nameOf = new Map(creators.map((c) => [c.id, c.name]));
    res.json({
      key: k,
      defaults: builtInDefaults(k),
      tags: [...(TEMPLATE_TAGS[k] ?? []), ...globalTags()].map((t) => ({ tag: t.tag, description: t.description, required: t.required, sample: t.sample })),
      draft: versions.find((v) => v.status === "DRAFT") ? publicVersion(versions.find((v) => v.status === "DRAFT")!) : null,
      published: versions.find((v) => v.status === "PUBLISHED") ? publicVersion(versions.find((v) => v.status === "PUBLISHED")!) : null,
      history: versions.map((v) => ({ id: v.id, version: v.version, status: v.status, subject: v.subject, createdAt: v.createdAt, publishedAt: v.publishedAt, createdBy: v.createdById ? nameOf.get(v.createdById) ?? null : null })),
      legacyOverrideActive: Boolean(legacy?.enabled && legacy.html),
    });
  })
);

// ─── POST /:key/preview — compile unsaved content and render it with sample data ─
router.post(
  "/:key/preview",
  asyncHandler(async (req: Request, res: Response) => {
    const k = key(req);
    if (!known(k)) { res.status(404).json({ error: "Unknown email" }); return; }
    const b = build(k, req.body as DraftBody);
    if (!b.compiled) { res.json({ ok: false, errors: b.errors, missingRequired: b.missingRequired, unknown: b.unknown }); return; }
    const vars = sampleVars(k);
    res.json({
      ok: b.errors.length === 0, errors: b.errors, missingRequired: b.missingRequired, unknown: b.unknown,
      subject: renderPlain(k, b.subject, vars), html: renderTemplate(k, b.compiled, vars),
    });
  })
);

// ─── PATCH /:key/draft — save (replace) the single draft ──────────────────────
router.patch(
  "/:key/draft",
  asyncHandler(async (req: Request, res: Response) => {
    const k = key(req);
    if (!known(k)) { res.status(404).json({ error: "Unknown email" }); return; }
    const b = build(k, req.body as DraftBody);
    if (b.errors.length) { res.status(400).json({ error: b.errors[0], errors: b.errors }); return; }
    const data = { subject: b.subject, preheader: b.preheader, mode: b.mode, blocks: (b.blocks ?? undefined) as object | undefined, customHtml: b.customHtml, compiledHtml: b.compiled, createdById: req.auth!.userId };
    const existing = await prisma.emailTemplateVersion.findFirst({ where: { templateKey: k, status: "DRAFT" } });
    const saved = existing
      ? await prisma.emailTemplateVersion.update({ where: { id: existing.id }, data: { ...data, blocks: b.blocks ? (b.blocks as unknown as object) : undefined } })
      : await prisma.emailTemplateVersion.create({ data: { templateKey: k, version: await nextVersion(k), status: "DRAFT", ...data, blocks: b.blocks ? (b.blocks as unknown as object) : undefined } });
    res.json({ ok: true, draft: publicVersion(saved), missingRequired: b.missingRequired, unknown: b.unknown });
  })
);

// ─── POST /:key/publish — the draft becomes the email that is sent ──────────
router.post(
  "/:key/publish",
  asyncHandler(async (req: Request, res: Response) => {
    const k = key(req);
    const draft = await prisma.emailTemplateVersion.findFirst({ where: { templateKey: k, status: "DRAFT" } });
    if (!draft) { res.status(400).json({ error: "There is no draft to publish. Save your changes first." }); return; }
    const problems = tagProblems(k, draft.compiledHtml, draft.subject);
    if (problems.missingRequired.length) {
      res.status(400).json({ error: `Add the required variable${problems.missingRequired.length > 1 ? "s" : ""} before publishing: ${problems.missingRequired.map((t) => `{{${t}}}`).join(", ")}`, missingRequired: problems.missingRequired });
      return;
    }
    await prisma.$transaction([
      prisma.emailTemplateVersion.updateMany({ where: { templateKey: k, status: "PUBLISHED" }, data: { status: "ARCHIVED" } }),
      prisma.emailTemplateVersion.update({ where: { id: draft.id }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
      // A published builder version replaces any older pasted override.
      prisma.emailTemplateOverride.deleteMany({ where: { templateKey: k } }),
    ]);
    void logActivity(req, "email_template_published", `Published "${k}" version ${draft.version}`, req.auth!.userId);
    res.json({ ok: true, version: draft.version, unknown: problems.unknown });
  })
);

// ─── POST /:key/restore — copy an older version into the draft ──────────────
router.post(
  "/:key/restore",
  asyncHandler(async (req: Request, res: Response) => {
    const k = key(req);
    const source = await prisma.emailTemplateVersion.findFirst({ where: { id: String((req.body as { versionId?: string }).versionId ?? ""), templateKey: k } });
    if (!source) { res.status(404).json({ error: "That version was not found." }); return; }
    const copy = { subject: source.subject, preheader: source.preheader, mode: source.mode, customHtml: source.customHtml, compiledHtml: source.compiledHtml, createdById: req.auth!.userId, blocks: source.blocks === null ? undefined : (source.blocks as object) };
    const existing = await prisma.emailTemplateVersion.findFirst({ where: { templateKey: k, status: "DRAFT" } });
    const draft = existing
      ? await prisma.emailTemplateVersion.update({ where: { id: existing.id }, data: copy })
      : await prisma.emailTemplateVersion.create({ data: { templateKey: k, version: await nextVersion(k), status: "DRAFT", ...copy } });
    void logActivity(req, "email_template_reverted", `Restored "${k}" version ${source.version} into the draft`, req.auth!.userId);
    res.json({ ok: true, draft: publicVersion(draft) });
  })
);

// ─── POST /:key/reset-default — go back to the built-in design ──────────────
router.post(
  "/:key/reset-default",
  asyncHandler(async (req: Request, res: Response) => {
    const k = key(req);
    if (!known(k)) { res.status(404).json({ error: "Unknown email" }); return; }
    await prisma.$transaction([
      prisma.emailTemplateVersion.updateMany({ where: { templateKey: k, status: "PUBLISHED" }, data: { status: "ARCHIVED" } }),
      prisma.emailTemplateOverride.deleteMany({ where: { templateKey: k } }),
    ]);
    void logActivity(req, "email_template_override_restored", `Restored built-in design for "${k}"`, req.auth!.userId);
    res.json({ ok: true });
  })
);

// ─── POST /:key/test — send the draft (or live) email with sample data ──────
const testSends = new Map<string, number[]>();
router.post(
  "/:key/test",
  asyncHandler(async (req: Request, res: Response) => {
    const k = key(req);
    if (!known(k)) { res.status(404).json({ error: "Unknown email" }); return; }
    const body = req.body as DraftBody & { to?: string };
    const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 200) { res.status(400).json({ error: "Enter a valid email address." }); return; }
    // Resend's free tier is small: at most 5 test sends per admin per 10 minutes.
    const now = Date.now();
    const recent = (testSends.get(req.auth!.userId) ?? []).filter((t) => now - t < 10 * 60_000);
    if (recent.length >= 5) { res.status(429).json({ error: "You've sent several test emails. Please wait a few minutes." }); return; }
    const vars = sampleVars(k);
    let subject: string; let html: string;
    if (body.blocks !== undefined || body.html !== undefined) {
      const b = build(k, body);
      if (b.errors.length) { res.status(400).json({ error: b.errors[0], errors: b.errors }); return; }
      subject = renderPlain(k, b.subject, vars); html = renderTemplate(k, b.compiled, vars);
    } else {
      const def = EMAIL_TEMPLATES.find((t) => t.id === k)!;
      subject = await resolveEmailSubject(k, brandText(def.subject), vars);
      html = await resolveEmailHtml(k, renderTemplate(k, def.tagged, vars), vars);
    }
    recent.push(now); testSends.set(req.auth!.userId, recent);
    const emailSent = await sendEmail(to, `[Test] ${subject}`, html);
    void logActivity(req, "email_template_test_sent", `Test of "${k}" to ${to}: ${emailSent ? "sent" : "failed"}`, req.auth!.userId);
    res.json({ emailSent });
  })
);

export default router;
