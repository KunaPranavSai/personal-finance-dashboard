import { prisma } from "../../lib/prisma";

/**
 * Centralized entitlement reads — every enforcement point in the app (login, automated email
 * gating, the Direct Composer) goes through this service instead of querying UserEntitlement
 * directly, so there's exactly one place that knows the defaults and the precedence rule.
 *
 * Precedence (documented, not fully built): platform default → [no plan-tier system exists yet —
 * this layer is skipped entirely, there is no PlanDefaults table] → user-level UserEntitlement
 * row. Today that means: no row = the hardcoded defaults below (equivalent to an implicit
 * "everyone gets the baseline" platform default); a row overrides those fields explicitly.
 */
export interface EntitlementSnapshot {
  planLabel: string;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  restricted: boolean;
  notifyEligible: boolean;
  emailEligible: boolean;
}

const DEFAULT_ENTITLEMENT: EntitlementSnapshot = {
  planLabel: "FREE",
  features: {},
  limits: {},
  restricted: false,
  notifyEligible: true,
  emailEligible: true,
};

export async function getEntitlement(userId: string): Promise<EntitlementSnapshot> {
  try {
    const row = await prisma.userEntitlement.findUnique({ where: { userId } });
    if (!row) return DEFAULT_ENTITLEMENT;
    return {
      planLabel: row.planLabel,
      features: (row.features as Record<string, boolean>) ?? {},
      limits: (row.limits as Record<string, number | null>) ?? {},
      restricted: row.restricted,
      notifyEligible: row.notifyEligible,
      emailEligible: row.emailEligible,
    };
  } catch {
    // Fail open to defaults rather than breaking login/email/etc. on a transient DB error —
    // restricted enforcement below still defaults to "not restricted" in that case, which is the
    // safe failure direction (never lock everyone out because of an entitlement read hiccup).
    return DEFAULT_ENTITLEMENT;
  }
}

/** REAL enforcement point: checked at login (password + passkey), before tokens are issued. */
export async function isRestricted(userId: string): Promise<boolean> {
  return (await getEntitlement(userId)).restricted;
}

/** REAL enforcement point: checked by the automated-email service and the Direct Composer
 * before any non-security-critical send. Security-critical triggers ignore this — see
 * services/email/automation.ts. */
export async function isEmailEligible(userId: string): Promise<boolean> {
  return (await getEntitlement(userId)).emailEligible;
}

/**
 * NOT YET ENFORCED anywhere — no real in-app hook currently distinguishes "security" vs
 * "convenience" in-app notifications the way the automated-email triggers do, and gating
 * `createNotification` broadly risked silently suppressing security notifications it's paired
 * with (notifySecurityEvent). Exposed here so a future real hook has a single source of truth,
 * but calling code does not check it today. The admin UI must say so, not imply it works.
 */
export async function isNotifyEligible(userId: string): Promise<boolean> {
  return (await getEntitlement(userId)).notifyEligible;
}

/**
 * NOT YET ENFORCED anywhere — no code in the app currently reads arbitrary feature-flag/limit
 * keys from UserEntitlement.features/limits. Exposed for completeness/future use only.
 */
export function isFeatureEnabled(entitlement: EntitlementSnapshot, key: string): boolean {
  return Boolean(entitlement.features[key]);
}
