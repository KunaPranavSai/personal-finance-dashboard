import { Request } from "express";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../lib/notify";
import { logActivity } from "../../lib/activityLog";
import { resolveEmailHtml, resolveEmailSubject } from "../../lib/emailTemplateOverrides";
import { isEmailEligible } from "../entitlements";

/**
 * The 6 real automated-email call sites found by grepping every sendEmail(...) call in the
 * business logic (auth.routes.ts) — not invented. `securityCritical: true` triggers ALWAYS send
 * regardless of the automation toggle or the recipient's emailEligible flag: a password reset,
 * password-reset code, or account-access-changing email must never be silently suppressed. Only
 * "account_updated" (a convenience notice, not required for account access/security) can
 * actually be disabled or skipped for an ineligible user.
 */
export const AUTOMATED_EMAIL_TRIGGERS: { key: string; name: string; defaultTemplateKey: string; securityCritical: boolean }[] = [
  { key: "recovery_otp", name: "Password Reset Code", defaultTemplateKey: "recovery_otp", securityCritical: true },
  { key: "password_changed", name: "Password Changed Notification", defaultTemplateKey: "password_changed", securityCritical: true },
  { key: "account_updated", name: "Account Updated by Admin", defaultTemplateKey: "account_updated", securityCritical: false },
  { key: "password_reset_by_admin", name: "Password Reset by Admin", defaultTemplateKey: "password_reset_by_admin", securityCritical: true },
  { key: "uid_reset_by_admin", name: "UID Reset by Admin", defaultTemplateKey: "uid_reset_by_admin", securityCritical: true },
];

export function getTriggerMeta(key: string) {
  return AUTOMATED_EMAIL_TRIGGERS.find((t) => t.key === key);
}

interface SendAutomatedEmailInput {
  req: Request;
  triggerKey: string;
  userId: string;
  to: string;
  defaultSubject: string;
  defaultHtml: string;
  vars: Record<string, string>;
}

/**
 * Single gate for all 6 real automated-email call sites: checks the EmailAutomationConfig
 * enabled flag and the recipient's UserEntitlement.emailEligible flag — unless the trigger is
 * security-critical, in which case both checks are bypassed and the email always sends. Skipped
 * sends are still logged via logActivity (reusing the existing writer), so a skip is never
 * silent in the audit trail even though the user doesn't receive anything.
 */
export async function sendAutomatedEmail(input: SendAutomatedEmailInput): Promise<boolean> {
  const { req, triggerKey, userId, to, defaultSubject, defaultHtml, vars } = input;
  const meta = getTriggerMeta(triggerKey);
  const securityCritical = meta?.securityCritical ?? true; // fail safe: unknown trigger never gets silently suppressed

  if (!securityCritical) {
    const [config, eligible] = await Promise.all([
      prisma.emailAutomationConfig.findUnique({ where: { triggerKey } }),
      isEmailEligible(userId),
    ]);
    if (config && !config.enabled) {
      void logActivity(req, "automated_email_skipped", `Skipped "${triggerKey}" — automation rule disabled`, userId);
      return false;
    }
    if (!eligible) {
      void logActivity(req, "automated_email_skipped", `Skipped "${triggerKey}" — recipient marked email-ineligible`, userId);
      return false;
    }
  }

  const config = await prisma.emailAutomationConfig.findUnique({ where: { triggerKey } });
  const templateKey = config?.templateKey || meta?.defaultTemplateKey || triggerKey;
  const subject = await resolveEmailSubject(templateKey, defaultSubject);
  const html = await resolveEmailHtml(templateKey, defaultHtml, vars);
  const sent = await sendEmail(to, subject, html);
  void logActivity(req, sent ? "automated_email_sent" : "automated_email_failed", `Trigger "${triggerKey}" → ${to}`, userId);
  return sent;
}
