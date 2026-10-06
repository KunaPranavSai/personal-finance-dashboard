import { Request } from "express";
import { prisma } from "../../lib/prisma";
import { sendEmail, notifySuperAdminByEmail } from "../../lib/notify";
import { logActivity } from "../../lib/activityLog";
import { resolveEmailHtml, resolveEmailSubject } from "../../lib/emailTemplateOverrides";
import { defaultVars, renderTemplate } from "../../lib/emailTemplateRenderer";
import { EMAIL_TEMPLATES } from "../../lib/emailTemplates";
import { isEmailEligible } from "../entitlements";
import { brandText } from "../../lib/platformConfig";

/**
 * Every automated email Penny Pilot can send. One row per email, one ON/OFF switch per row (EmailAutomationConfig;
 * no row = ON). The Resend free tier is small, so nothing sends unless its switch is on, and each event triggers
 * exactly one send.
 *
 * `locked` is only for the codes a person needs in order to get into their account (email verification, sign-in,
 * password recovery, admin access approval). Turning those off would lock users out, so the admin page shows
 * them as "Always on" with the reason rather than offering a switch that would break sign-in.
 */
export interface TriggerMeta {
  key: string;
  name: string;
  description: string;
  defaultTemplateKey: string;
  locked: boolean;
  audience: "user" | "admin";
}

export const AUTOMATED_EMAIL_TRIGGERS: TriggerMeta[] = [
  { key: "welcome", name: "Welcome / Account Ready", description: "When a new user finishes sign-up", defaultTemplateKey: "welcome", locked: false, audience: "user" },
  { key: "email_verification", name: "Email Verification Code", description: "Code to verify a new email address", defaultTemplateKey: "email_verification", locked: true, audience: "user" },
  { key: "signin_code", name: "Sign-in Code", description: "Code for signing in with email", defaultTemplateKey: "signin_code", locked: true, audience: "user" },
  { key: "recovery_otp", name: "Password Reset / Recovery Code", description: "Code to reset a forgotten password", defaultTemplateKey: "recovery_otp", locked: true, audience: "user" },
  { key: "password_changed", name: "Password Changed", description: "After any password change or reset", defaultTemplateKey: "password_changed", locked: false, audience: "user" },
  { key: "password_reset_by_admin", name: "Admin Password Reset", description: "When an administrator resets a user's password", defaultTemplateKey: "password_reset_by_admin", locked: false, audience: "user" },
  { key: "uid_changed", name: "User ID Changed", description: "When a User ID is changed by the user or an administrator", defaultTemplateKey: "uid_changed", locked: false, audience: "user" },
  { key: "account_updated", name: "Account Updated by Admin", description: "When an administrator edits an account", defaultTemplateKey: "account_updated", locked: false, audience: "user" },
  { key: "pin_changed", name: "PIN Changed", description: "When an existing PIN is changed (not on first creation or removal)", defaultTemplateKey: "pin_changed", locked: false, audience: "user" },
  { key: "security_alert", name: "Security Alert", description: "Two-factor, passkey and security-question changes", defaultTemplateKey: "security_alert", locked: false, audience: "user" },
  { key: "admin_access_code", name: "Admin Access Verification Code", description: "Code a user shares to approve admin access to their account", defaultTemplateKey: "admin_access_code", locked: true, audience: "user" },
  { key: "account_action_code", name: "Account Action Confirmation Code", description: "Code that confirms deleting or reactivating an account", defaultTemplateKey: "account_action_code", locked: true, audience: "user" },
  { key: "migration_action_required", name: "Migration / Drive Setup Required", description: "Admin reminder to connect Google Drive", defaultTemplateKey: "migration_action_required", locked: false, audience: "user" },
  { key: "migration_completed", name: "Migration Completed", description: "When Google Drive setup finishes", defaultTemplateKey: "migration_completed", locked: false, audience: "user" },
  { key: "migration_failed", name: "Migration Failed", description: "First failure of a Google Drive setup attempt", defaultTemplateKey: "migration_failed", locked: false, audience: "user" },
  { key: "drive_disconnected", name: "Drive Disconnected", description: "When Google Drive access is lost and must be re-authorized", defaultTemplateKey: "drive_disconnected", locked: false, audience: "user" },
  { key: "new_signup_admin", name: "New Signup Notification", description: "Tells admins when a user finishes sign-up", defaultTemplateKey: "new_signup_admin", locked: false, audience: "admin" },
  { key: "super_admin_alert", name: "Super-admin Security Alerts", description: "Security events on admin accounts, to the super-admin mailbox", defaultTemplateKey: "super_admin_alert", locked: false, audience: "admin" },
];

export function getTriggerMeta(key: string) {
  return AUTOMATED_EMAIL_TRIGGERS.find((t) => t.key === key);
}

interface SendAutomatedEmailInput {
  /** When present, the send or skip is written to the audit log. */
  req?: Request;
  triggerKey: string;
  /** The recipient's account, for the per-user "email eligible" flag. Omit for admin-audience emails. */
  userId?: string;
  to: string;
  /** Values for the template's {{tags}}. Never put secrets here. */
  vars: Record<string, string>;
  /** Send through the super-admin mailbox's own Resend client instead of the main one. */
  superAdminChannel?: boolean;
}

/**
 * The single gate for every automated email: ON/OFF switch, then (for user-facing mail) the recipient's
 * email-eligible flag, then the admin's pasted HTML if there is one, else the built-in design. A disabled email
 * is not sent, not queued and not retried; the caller carries on normally.
 */
export async function sendAutomatedEmail(input: SendAutomatedEmailInput): Promise<boolean> {
  const { req, triggerKey, userId, to } = input;
  const meta = getTriggerMeta(triggerKey);
  if (!meta) {
    console.error(`sendAutomatedEmail: unknown trigger "${triggerKey}"`);
    return false;
  }
  const audit = (event: string, detail: string) => {
    if (req) void logActivity(req, event, detail, userId);
  };

  const config = await prisma.emailAutomationConfig.findUnique({ where: { triggerKey } });
  if (!meta.locked) {
    if (config && !config.enabled) {
      audit("automated_email_skipped", `Skipped "${triggerKey}" - switched off by an administrator`);
      return false;
    }
    if (meta.audience === "user" && userId && !(await isEmailEligible(userId))) {
      audit("automated_email_skipped", `Skipped "${triggerKey}" - recipient marked email-ineligible`);
      return false;
    }
  }

  const templateKey = config?.templateKey || meta.defaultTemplateKey;
  const def = EMAIL_TEMPLATES.find((t) => t.id === templateKey) ?? EMAIL_TEMPLATES.find((t) => t.id === meta.defaultTemplateKey)!;
  const vars = { ...defaultVars(def.id), ...input.vars }; // the caller's values win
  const subject = await resolveEmailSubject(def.id, brandText(def.subject), vars);
  const html = await resolveEmailHtml(def.id, renderTemplate(def.id, def.tagged, vars), vars);
  const sent = input.superAdminChannel ? await notifySuperAdminByEmail(subject, html) : await sendEmail(to, subject, html);
  audit(sent ? "automated_email_sent" : "automated_email_failed", `Trigger "${triggerKey}"`);
  return sent;
}
