import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
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
import authRoutes from "./routes/auth.routes";
import activityRoutes from "./routes/activity.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authenticate } from "./middleware/auth";

const isProd = process.env.NODE_ENV === "production";
const COOKIE_SECRET = process.env.COOKIE_SECRET ?? "pfd-cookie-secret";

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

  // CORS
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  // Body parsing
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser(COOKIE_SECRET));

  // Health check (public)
  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  // Auth routes (public — login / logout / refresh)
  app.use("/api/auth", authRoutes);

  // Protected finance routes
  app.use("/api/transactions", authenticate, transactionsRoutes);
  app.use("/api/budgets", authenticate, budgetRoutes);
  app.use("/api/dashboard", authenticate, dashboardRoutes);
  app.use("/api", authenticate, referenceRoutes);
  app.use("/api/investments", authenticate, investmentsRoutes);
  app.use("/api/bills", authenticate, billsRoutes);
  app.use("/api/goals", authenticate, goalsRoutes);
  app.use("/api/savings", authenticate, savingsRoutes);
  app.use("/api/analytics", authenticate, analyticsRoutes);
  app.use("/api/reports", authenticate, reportsRoutes);
  app.use("/api/notifications", authenticate, notificationsRoutes);
  app.use("/api/profile", authenticate, profileRoutes);
  app.use("/api/settings", authenticate, settingsRoutes);
  app.use("/api/export", authenticate, exportRoutes);
  app.use("/api/activity", authenticate, activityRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
