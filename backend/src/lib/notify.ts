import { Resend } from "resend";
import { prisma } from "./prisma";
import { platformConfig, configuredSender } from "./platformConfig";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
// Resend's sandbox sender (onboarding@resend.dev) only delivers to the email address
// that owns the Resend account itself — sends to any other recipient are silently
// dropped. Set RESEND_FROM_EMAIL (e.g. "Penny Pilot <noreply@yourdomain.com>") once a
// domain is verified in the Resend dashboard to send to real users.
const SANDBOX_FROM = "Penny Pilot <onboarding@resend.dev>";
// Sender: what the admin set in System Settings, else the RESEND_FROM_EMAIL env var, else Resend's sandbox sender.
const fromAddress = () => configuredSender() ?? process.env.RESEND_FROM_EMAIL ?? SANDBOX_FROM;

// Dedicated channel for super-admin-facing notifications (new signups, security
// events on admin accounts), fully separate from the regular user-facing Resend
// client/key above so the two mail flows can't interfere with each other.
const superAdminResend = process.env.SUPER_ADMIN_RESEND_API_KEY ? new Resend(process.env.SUPER_ADMIN_RESEND_API_KEY) : null;
const SUPER_ADMIN_FROM = process.env.SUPER_ADMIN_RESEND_FROM_EMAIL ?? "Penny Pilot <onboarding@resend.dev>";

/** Send to the super admin's dedicated mailbox via its own Resend client. Returns whether it was sent; false when unconfigured. */
export async function notifySuperAdminByEmail(subject: string, html: string): Promise<boolean> {
  try {
    if (!superAdminResend) return false;
    const result = await superAdminResend.emails.send({ from: SUPER_ADMIN_FROM, to: platformConfig().superAdminEmail, subject, html });
    if (result.error) {
      console.error("Failed to send super admin email:", result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send super admin email:", err);
    return false;
  }
}

/** Create an in-app notification for a specific user. Failures never break the calling request. */
export async function createNotification(userId: string, type: string, title: string, message: string): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, type, title, message } });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

/** Send an arbitrary email via Resend when configured; silently skips otherwise. Returns whether it was actually sent. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    if (!resend) return false;
    const result = await resend.emails.send({ from: fromAddress(), to, subject, html });
    if (result.error) {
      console.error("Failed to send email:", result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/**
 * In-app notification for a security event, plus at most ONE email per event:
 *  - `email: false`      -> in-app only (the caller sends its own dedicated email, e.g. password changed)
 *  - `email: {key,vars}` -> that dedicated template
 *  - default             -> the generic "Security Alert" email
 * Events on admin / super-admin accounts also go to the super-admin mailbox. Every email passes through the
 * automation switches (services/email/automation.ts), so an email switched off in the admin console is not sent.
 */
export async function notifySecurityEvent(
  userId: string,
  type: string,
  title: string,
  message: string,
  opts: { req?: import("express").Request; email?: false | { key: string; vars?: Record<string, string> } } = {}
): Promise<void> {
  await createNotification(userId, type, title, message);
  try {
    const { sendAutomatedEmail } = await import("../services/email/automation");
    const { whenLabel } = await import("./emailLayout");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, role: true, uid: true } });
    if (!user) return;
    const when = whenLabel();
    if (opts.email !== false) {
      const key = opts.email?.key ?? "security_alert";
      const vars = { name: user.name || "there", when, event: title, detail: lowerFirst(message), ...(opts.email?.vars ?? {}) };
      void sendAutomatedEmail({ req: opts.req, triggerKey: key, userId, to: user.email, vars });
    }
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
      void sendAutomatedEmail({
        req: opts.req, triggerKey: "super_admin_alert", to: platformConfig().superAdminEmail, superAdminChannel: true,
        vars: { event: title, detail: message, account: `${user.uid} (${user.role})`, when },
      });
    }
  } catch (err) {
    console.error("Failed to send security notification email:", err);
  }
}

/** A user finished sign-up: in-app note for every admin, and (if switched on) one email each. */
export async function notifyAdminsOfSignup(req: import("express").Request | undefined, newUser: { name: string; email: string }): Promise<void> {
  try {
    const { sendAutomatedEmail } = await import("../services/email/automation");
    const { whenLabel } = await import("./emailLayout");
    const admins = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" },
      select: { id: true, name: true, email: true },
    });
    await Promise.all(admins.map((a) => createNotification(a.id, "info", "New sign-up", `${newUser.name || newUser.email} just joined Penny Pilot.`)));
    const when = whenLabel();
    await Promise.all(
      admins.map((a) =>
        sendAutomatedEmail({
          req, triggerKey: "new_signup_admin", to: a.email,
          vars: { adminName: a.name || "there", newName: newUser.name || "A new user", newEmail: newUser.email, when },
        })
      )
    );
  } catch (err) {
    console.error("Failed to notify admins of sign-up:", err);
  }
}
