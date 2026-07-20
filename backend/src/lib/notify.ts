import { Resend } from "resend";
import { prisma } from "./prisma";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = "Penny Pilot <onboarding@resend.dev>";

/** Create an in-app notification for a specific user. Failures never break the calling request. */
export async function createNotification(userId: string, type: string, title: string, message: string): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, type, title, message } });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

/** Send an arbitrary email via Resend when configured; silently skips otherwise. */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    if (!resend) return;
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("Failed to send email:", err);
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
}

/** Notify every admin (SUPER_ADMIN + ADMIN) in-app and by email — used for new-signup review requests. */
export async function notifyAdmins(type: string, title: string, message: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" },
    select: { id: true, email: true },
  });
  await Promise.all(admins.map((a) => createNotification(a.id, type, title, message)));
  await Promise.all(admins.map((a) => sendEmail(a.email, `Penny Pilot — ${title}`, `<p>${message}</p>`)));
}
