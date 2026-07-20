import { Request } from "express";
import { prisma } from "./prisma";

/** Lightweight user-agent parsing — enough for an audit trail without a new dependency. */
function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  let browser = "Unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/curl/i.test(ua)) browser = "curl";

  let os = "Unknown";
  if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let device = "Desktop";
  if (/mobile|iphone|android(?!.*tablet)/i.test(ua)) device = "Mobile";
  else if (/ipad|tablet/i.test(ua)) device = "Tablet";

  return { browser, os, device };
}

export function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.ip ?? "unknown";
}

/** Record a security/audit event. Fire-and-forget safe: failures never break the request. `userId` is
 * omitted for events with no resolvable account (e.g. a login attempt with an unknown UID). */
export async function logActivity(req: Request, event: string, detail?: string, userId?: string): Promise<void> {
  try {
    const ua = String(req.headers["user-agent"] ?? "");
    const { browser, os, device } = parseUserAgent(ua);
    await prisma.activityLog.create({
      data: {
        userId: userId ?? null,
        event,
        detail: detail ?? null,
        ip: getClientIp(req),
        userAgent: ua.slice(0, 500),
        browser,
        os,
        device,
      },
    });
  } catch (err) {
    console.error("Failed to write activity log:", err);
  }
}
