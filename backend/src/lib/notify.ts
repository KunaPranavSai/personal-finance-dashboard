import { Resend } from "resend";
import { prisma } from "./prisma";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
// Resend's sandbox sender (onboarding@resend.dev) only delivers to the email address
// that owns the Resend account itself — sends to any other recipient are silently
// dropped. Set RESEND_FROM_EMAIL (e.g. "Penny Pilot <noreply@yourdomain.com>") once a
// domain is verified in the Resend dashboard to send to real users.
const FROM = process.env.RESEND_FROM_EMAIL ?? "Penny Pilot <onboarding@resend.dev>";

// Dedicated channel for super-admin-facing notifications (new signups, security
// events on admin accounts), fully separate from the regular user-facing Resend
// client/key above so the two mail flows can't interfere with each other.
const superAdminResend = process.env.SUPER_ADMIN_RESEND_API_KEY ? new Resend(process.env.SUPER_ADMIN_RESEND_API_KEY) : null;
const SUPER_ADMIN_FROM = process.env.SUPER_ADMIN_RESEND_FROM_EMAIL ?? "Penny Pilot <onboarding@resend.dev>";
const SUPER_ADMIN_EMAIL = "superadminpennypilot@gmail.com";

/** Send a notification to the super admin's dedicated mailbox via its own Resend client; silently skips if unconfigured. */
export async function notifySuperAdminByEmail(subject: string, html: string): Promise<void> {
  try {
    if (!superAdminResend) return;
    const result = await superAdminResend.emails.send({ from: SUPER_ADMIN_FROM, to: SUPER_ADMIN_EMAIL, subject, html });
    if (result.error) console.error("Failed to send super admin email:", result.error);
  } catch (err) {
    console.error("Failed to send super admin email:", err);
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
    const result = await resend.emails.send({ from: FROM, to, subject, html });
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

/** Send a security email to a user's own address when configured; silently skips otherwise. */
async function sendSecurityEmail(userId: string, subject: string, html: string): Promise<void> {
  try {
    if (!resend) return;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return;
    await sendEmail(user.email, subject, html);
  } catch (err) {
    console.error("Failed to send security email:", err);
  }
}

/** In-app notification + email in one call, for security events on a specific user's account. */
export async function notifySecurityEvent(userId: string, type: string, title: string, message: string): Promise<void> {
  await createNotification(userId, type, title, message);
  void sendSecurityEmail(userId, `Penny Pilot — ${title}`, `<p>${message}</p><p style="color:#888;font-size:12px">If this wasn't you, reset your password immediately.</p>`);

  // Security events on admin/super-admin accounts also go to the dedicated super admin mailbox.
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, uid: true } });
    if (user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN")) {
      void notifySuperAdminByEmail(
        `Penny Pilot — Admin security event: ${title}`,
        `<p><strong>${user.uid}</strong> (${user.role}): ${message}</p>`
      );
    }
  } catch (err) {
    console.error("Failed to check user role for super admin notification:", err);
  }
}

/** Notify every admin (SUPER_ADMIN + ADMIN) in-app and by email — used for new-signup review requests. */
export async function notifyAdmins(type: string, title: string, message: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" },
    select: { id: true, email: true },
  });
  await Promise.all(admins.map((a) => createNotification(a.id, type, title, message)));
  await Promise.all(admins.map((a) => sendEmail(a.email, `Penny Pilot — ${title}`, `<p>${message}</p>`)));
  void notifySuperAdminByEmail(`Penny Pilot — ${title}`, `<p>${message}</p>`);
}
