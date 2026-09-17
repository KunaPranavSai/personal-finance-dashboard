import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import transactionsRoutes from "./routes/transactions.routes";
import budgetRoutes from "./routes/budget.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import referenceRoutes from "./routes/reference.routes";
import investmentsRoutes from "./routes/investments.routes";
import billsRoutes from "./routes/bills.routes";
import goalsRoutes from "./routes/goals.routes";
import savingsRoutes from "./routes/savings.routes";
import analyticsRoutes from "./routes/analytics.routes";
import reportsRoutes from "./routes/reports.routes";
import notificationsRoutes from "./routes/notifications.routes";
import profileRoutes from "./routes/profile.routes";
import settingsRoutes from "./routes/settings.routes";
import exportRoutes from "./routes/export.routes";
import driveRoutes from "./routes/drive.routes";
import authRoutes from "./routes/auth.routes";
import voiceGreetingRoutes from "./routes/voiceGreeting.routes";
import activityRoutes from "./routes/activity.routes";
import adminRoutes from "./routes/admin.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authenticate, requireRole, requireDriveConnected } from "./middleware/auth";

const isProd = process.env.NODE_ENV === "production";
if (!process.env.COOKIE_SECRET) {
  throw new Error("COOKIE_SECRET is not set — refusing to start with a default cookie secret.");
}
const COOKIE_SECRET = process.env.COOKIE_SECRET;

// The set of origins allowed to make credentialed (cookie-bearing) requests.
// APP_URL is the same env var already used to build links in outgoing emails
// (see backend/src/lib/emailTemplates.ts), so it doubles as the canonical
// frontend origin here rather than requiring a second env var. Both APP_URL
// and FRONTEND_URL accept a comma-separated list, since Vercel projects can
// have more than one live alias domain (e.g. after a project rename, the old
// name often keeps resolving alongside the new one).
function parseOriginList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

const ALLOWED_ORIGINS = new Set(
  [
    ...parseOriginList(process.env.APP_URL),
    ...parseOriginList(process.env.FRONTEND_URL),
    !isProd ? "http://localhost:3000" : null,
  ].filter((v): v is string => Boolean(v))
);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / non-browser requests (curl, health checks) send no Origin header
  return ALLOWED_ORIGINS.has(origin);
}

export function createApp() {
  const app = express();

  // Behind Render/reverse proxies — needed so req.ip reflects the real client.
  app.set("trust proxy", 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: isProd ? { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:", "https:"], connectSrc: ["'self'"] } } : false,
      hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
      frameguard: { action: "deny" },
      noSniff: true,
      xssFilter: true,
    })
  );

  // CORS — locked to an explicit allowlist. `origin: true` would reflect ANY
  // requesting site as allowed, which combined with `credentials: true` lets
  // any website make authenticated (cookie-bearing) requests on a victim's
  // behalf. Never widen this back to `true`.
  app.use(cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // Idempotency-Key: sent by the frontend's api.post() on every create
    // request (transactions/bills/goals/investments/budgets — see
    // lib/idempotencyKey.ts) to let a retried request be recognized instead
    // of creating a duplicate record. Omitting it here doesn't fail loudly —
    // the browser's CORS preflight silently strips the header from its
    // Access-Control-Allow-Headers response, so every cross-origin create
    // request (frontend and backend on different origins/ports, as in prod)
    // gets blocked client-side with a bare net::ERR_FAILED and no server-side
    // log at all.
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    // Without this, frontend JS can't read Content-Disposition on a
    // cross-origin fetch response (browsers only expose a small CORS-safelisted
    // set of response headers by default) — file-download filenames (consent
    // PDF, data export) silently fall back to a generic name instead of the
    // server-provided one.
    exposedHeaders: ["Content-Disposition"],
  }));

  // CSRF defense-in-depth: the frontend and backend are cross-origin
  // (Vercel/Render), so the session cookie must use SameSite=None in
  // production (see setTokenCookies in auth.routes.ts), which alone gives no
  // CSRF protection. Reject state-changing requests whose Origin isn't on the
  // same allowlist CORS uses. GETs are exempt (no side effects expected).
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !isAllowedOrigin(req.headers.origin)) {
      res.status(403).json({ error: "Request origin not allowed" });
      return;
    }
    next();
  });

  // Baseline rate limit across the whole API — defense-in-depth beyond the
  // stricter per-route limiters already applied to auth endpoints. Report/
  // export/backup generation is CPU-heavy and had no throttling at all.
  app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down and try again shortly.", code: "RATE_LIMITED" },
  }));

  // Body parsing
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser(COOKIE_SECRET));

  // Health check (public)
  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  // Auth routes (public — login / logout / refresh)
  app.use("/api/auth", authRoutes);

  // Voice greetings (public — the signup-success greeting fires before any
  // session exists). Only ever synthesizes one of a small fixed set of
  // known messages server-side; see routes/voiceGreeting.routes.ts.
  app.use("/api/voice-greeting", voiceGreetingRoutes);

  // Google Drive connection itself — must be reachable before a user is "connected", so this
  // is authenticated but NOT gated behind requireDriveConnected (that would be circular).
  app.use("/api/drive", authenticate, driveRoutes);

  // Protected finance routes — Drive is the only persistent store for this data, so every one
  // of these requires an initialized Drive connection in addition to being logged in.
  app.use("/api/transactions", authenticate, requireDriveConnected, transactionsRoutes);
  app.use("/api/budgets", authenticate, requireDriveConnected, budgetRoutes);
  app.use("/api/dashboard", authenticate, requireDriveConnected, dashboardRoutes);
  app.use("/api/investments", authenticate, requireDriveConnected, investmentsRoutes);
  app.use("/api/bills", authenticate, requireDriveConnected, billsRoutes);
  app.use("/api/goals", authenticate, requireDriveConnected, goalsRoutes);
  app.use("/api/savings", authenticate, requireDriveConnected, savingsRoutes);
  app.use("/api/analytics", authenticate, requireDriveConnected, analyticsRoutes);
  app.use("/api/reports", authenticate, requireDriveConnected, reportsRoutes);
  // Profile has its own Drive-vs-Postgres branching per request (see
  // routes/profile.routes.ts) — Local-Only users' profile is Postgres-backed
  // exactly like admins', so this route doesn't gate on Drive at all.
  app.use("/api/profile", authenticate, profileRoutes);
  app.use("/api/settings", authenticate, requireDriveConnected, settingsRoutes);
  app.use("/api/export", authenticate, requireDriveConnected, exportRoutes);

  // Not financial data — stays Postgres-backed, no Drive gate needed.
  app.use("/api/notifications", authenticate, notificationsRoutes);
  app.use("/api/activity", authenticate, activityRoutes);
  app.use("/api/admin", authenticate, requireRole("SUPER_ADMIN", "ADMIN"), adminRoutes);

  // referenceRoutes is mounted at the bare "/api" prefix (its own routes are /categories,
  // /accounts, /payment-methods) and MUST be registered last among /api/* mounts: Express
  // matches middleware by registration order for overlapping prefixes, not by specificity, and
  // an Express Router falls through to the next app.use when none of its own routes match a
  // path — so if this were registered earlier, its requireDriveConnected (applied inside
  // reference.routes.ts) would incorrectly run for every other /api/* request too, before ever
  // reaching their real, more specific handlers below.
  app.use("/api", authenticate, referenceRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
