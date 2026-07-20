import { Resend } from "resend";
import { prisma } from "./prisma";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/** Create an in-app notification. Failures never break the calling request. */
export async function createNotification(type: string, title: string, message: string): Promise<void> {
  try {
    await prisma.notification.create({ data: { type, title, message } });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

async function getProfileEmailForNotify(): Promise<string | null> {
  const rec = await prisma.appProfile.findUnique({ where: { id: "singleton" } });
  const data = (rec?.data ?? {}) as Record<string, unknown>;
  const email = typeof data.email === "string" ? data.email : null;
  return email && email !== "user@example.com" ? email : null;
}

/** Send a security email via Resend when configured; silently skips otherwise. */
export async function sendSecurityEmail(subject: string, html: string): Promise<void> {
  try {
    if (!resend) return;
    const email = await getProfileEmailForNotify();
    if (!email) return;
    await resend.emails.send({
      from: "Penny Pilot <onboarding@resend.dev>",
      to: email,
      subject,
      html,
    });
  } catch (err) {
    console.error("Failed to send security email:", err);
  }
}

/** In-app notification + email in one call, for security events. */
export async function notifySecurityEvent(type: string, title: string, message: string): Promise<void> {
  await createNotification(type, title, message);
  void sendSecurityEmail(`Penny Pilot — ${title}`, `<p>${message}</p><p style="color:#888;font-size:12px">If this wasn't you, reset your password immediately.</p>`);
}
