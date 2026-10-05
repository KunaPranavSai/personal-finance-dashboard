import { prisma } from "./prisma";

/**
 * Platform-wide settings a Super Admin edits in Admin -> System Settings. Read synchronously from a small cache so
 * email rendering, the rate limiter and password rules never wait on the database; the cache refreshes right after
 * a save and every minute (so a second server instance picks changes up too).
 *
 * Precedence for each value: what the admin entered -> the matching environment variable -> a safe default.
 *
 * Deliberately NOT here: anything a wrong value could use to lock everyone out or open a security hole - CORS
 * origins, passkey origins and the Google OAuth redirect still come from the server's APP_URL / FRONTEND_URL
 * environment variables, and secrets (API keys) stay in the environment.
 */
export interface PlatformConfig {
  siteName: string;
  /** Public base URL used for links in emails (no trailing slash). */
  appUrl: string;
  supportEmail: string;
  emailFromName: string;
  /** Verified sender address in Resend; empty means "use RESEND_FROM_EMAIL / the sandbox sender". */
  emailFromAddress: string;
  superAdminEmail: string;
  defaultSessionTimeoutMinutes: number;
  minPasswordLength: number;
  require2FAForAdmins: boolean;
  /** Requests per IP per 15 minutes across the whole API. */
  apiRateLimit: number;
}

const FALLBACK_APP_URL = "https://personal-finance-dashboard-three-topaz.vercel.app";
const DEFAULT_SUPER_ADMIN = "superadminpennypilot@gmail.com";

const clean = (v: string | null | undefined) => (v ?? "").trim();
const stripSlash = (v: string) => v.replace(/\/+$/, "");

function build(row: Partial<Record<string, unknown>> | null): PlatformConfig {
  const r = (row ?? {}) as Record<string, string | number | boolean | null | undefined>;
  const envUrl = clean((process.env.APP_URL ?? "").split(",")[0]);
  return {
    siteName: clean(r.siteName as string) || "Penny Pilot",
    appUrl: stripSlash(clean(r.appUrl as string) || envUrl || FALLBACK_APP_URL),
    supportEmail: clean(r.supportEmail as string) || clean(process.env.SUPPORT_EMAIL),
    emailFromName: clean(r.emailFromName as string),
    emailFromAddress: clean(r.emailFromAddress as string),
    superAdminEmail: clean(r.superAdminEmail as string) || DEFAULT_SUPER_ADMIN,
    defaultSessionTimeoutMinutes: Number(r.defaultSessionTimeoutMinutes) > 0 ? Number(r.defaultSessionTimeoutMinutes) : 30,
    minPasswordLength: Number(r.minPasswordLength) >= 6 ? Number(r.minPasswordLength) : 8,
    require2FAForAdmins: Boolean(r.require2FAForAdmins),
    apiRateLimit: Number(r.apiRateLimit) >= 30 ? Number(r.apiRateLimit) : 300,
  };
}

let cache: PlatformConfig = build(null);

export const platformConfig = (): PlatformConfig => cache;

export async function refreshPlatformConfig(): Promise<PlatformConfig> {
  try {
    cache = build(await prisma.platformSettings.findUnique({ where: { id: "singleton" } }));
  } catch (err) {
    console.error("Could not load platform settings; keeping the last known values:", err);
  }
  return cache;
}

/** Load once at startup, then keep fresh. */
export function startPlatformConfig(): void {
  void refreshPlatformConfig();
  setInterval(() => void refreshPlatformConfig(), 60_000).unref();
}

/** `Name <address>` for the Resend `from` field, or null when no custom sender is configured. */
export function configuredSender(): string | null {
  const c = cache;
  if (!c.emailFromAddress) return null;
  return `${c.emailFromName || c.siteName} <${c.emailFromAddress}>`;
}

/** Replaces the built-in product name in default copy with the configured site name. */
export const brandText = (s: string): string => (cache.siteName === "Penny Pilot" ? s : s.replace(/Penny Pilot/g, cache.siteName));
