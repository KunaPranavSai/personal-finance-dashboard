/**
 * One transactional email layout for every Penny Pilot email: header, title, short message, optional code box or
 * button, supporting rows, security notice, support line and footer. Table-based with inline styles so it renders
 * in Gmail, Outlook and Apple Mail, and a small @media block for phones.
 *
 * Every dynamic value passed in is HTML-escaped here, so callers hand over plain text only. `{{tag}}` markers survive
 * escaping untouched, which is what lets the same functions produce the editable "tagged" default for the admin editor.
 *
 * The layout is built from `frag` (the individual blocks) and `shell` (the fixed header/footer frame). Both
 * renderEmail() and the admin Email Builder compose them, so a builder-made email looks identical to a built-in one.
 */
import { platformConfig, brandText } from "./platformConfig";

/** Public base URL for links in emails, from System Settings (falls back to the APP_URL env var). */
export const appUrl = () => platformConfig().appUrl;

const C = { navy: "#001621", teal: "#004741", mint: "#21F1A8", ink: "#17231F", dim: "#5B6B62", line: "#E3E8E4", bg: "#F3F5F2", card: "#FFFFFF", warnBg: "#FFF6E5", warnInk: "#8A5A00", infoBg: "#EAF6F1", infoInk: "#0B4F43" };

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailParts {
  /** Hidden inbox preview text. */
  preheader: string;
  title: string;
  /** Short lines of body text, shown above the code/button. */
  intro: string[];
  /** A one-time code, shown large with spacing. */
  code?: string;
  codeNote?: string;
  cta?: { label: string; url: string };
  /** Label/value facts (e.g. "When", "What changed"). */
  rows?: [string, string][];
  /** Bulleted list under the intro. */
  bullets?: string[];
  notice?: { tone: "info" | "warn"; title?: string; text: string };
  /** Short lines after the code/button. */
  outro?: string[];
}

const WRAP = "word-break:break-word;overflow-wrap:anywhere;";
const tx = (v: string) => esc(brandText(v));
const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${C.ink};${WRAP}">${tx(t)}</p>`;

export const frag = {
  heading: (text: string) =>
    `<h1 class="pp-h1" style="margin:0 0 16px;${WRAP}font-size:24px;line-height:30px;font-weight:800;letter-spacing:-0.01em;color:${C.ink};">${tx(text)}</h1>`,
  eyebrow: (text: string) =>
    `<div style="margin:0 0 8px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.teal};${WRAP}">${tx(text)}</div>`,
  text: (text: string) => p(text),
  bullets: (items: string[]) =>
    items.length
      ? `<ul style="margin:0 0 16px;padding-left:20px;">${items.map((b) => `<li style="margin:0 0 6px;font-size:15px;line-height:22px;color:${C.ink};${WRAP}">${tx(b)}</li>`).join("")}</ul>`
      : "",
  code: (value: string, note?: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 14px;"><tr><td align="center" style="background:${C.bg};border:1px solid ${C.line};border-radius:14px;padding:18px 8px;"><div class="pp-code" style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;line-height:40px;font-weight:700;letter-spacing:8px;color:${C.teal};">${esc(value)}</div>${note ? `<div style="margin-top:8px;font-size:12px;color:${C.dim};">${tx(note)}</div>` : ""}</td></tr></table>`,
  button: (label: string, url: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 18px;"><tr><td style="border-radius:12px;background:${C.teal};"><a href="${esc(url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:12px;">${tx(label)}</a></td></tr></table>`,
  details: (rows: [string, string][]) =>
    rows.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border:1px solid ${C.line};border-radius:12px;border-collapse:separate;">${rows
          .map(
            ([k, v], i) =>
              `<tr><td style="padding:12px 16px;font-size:12px;color:${C.dim};width:34%;vertical-align:top;${i ? `border-top:1px solid ${C.line};` : ""}">${tx(k)}</td><td style="padding:12px 16px;font-size:14px;color:${C.ink};font-weight:600;${WRAP}${i ? `border-top:1px solid ${C.line};` : ""}">${esc(v)}</td></tr>`
          )
          .join("")}</table>`
      : "",
  notice: (tone: "info" | "warn", text: string, title?: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px;"><tr><td style="background:${tone === "warn" ? C.warnBg : C.infoBg};border-radius:12px;padding:14px 16px;font-size:13px;line-height:20px;${WRAP}color:${tone === "warn" ? C.warnInk : C.infoInk};">${title ? `<strong>${tx(title)}</strong><br/>` : ""}${tx(text)}</td></tr></table>`,
  divider: () => `<div style="margin:6px 0 18px;border-top:1px solid ${C.line};font-size:0;line-height:0;">&nbsp;</div>`,
  spacer: (px: number) => {
    const h = Math.max(4, Math.min(80, Math.round(px) || 16));
    return `<div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;
  },
  image: (url: string, alt: string) =>
    `<div style="margin:0 0 16px;"><img src="${esc(url)}" alt="${esc(alt)}" style="display:block;max-width:100%;height:auto;border:0;border-radius:12px;"/></div>`,
};

/** The fixed frame around the body: document head, hidden preheader, branded header and the footer. */
export function shell(o: { title: string; preheader: string; body: string }): string {
  const APP_URL = esc(appUrl());
  const SUPPORT_EMAIL = platformConfig().supportEmail;
  const BRAND = platformConfig().siteName;
  const support = SUPPORT_EMAIL
    ? `Need help? Write to <a href="mailto:${esc(SUPPORT_EMAIL)}" style="color:${C.teal};">${esc(SUPPORT_EMAIL)}</a>.`
    : `Need help? Open ${esc(BRAND)} and use Help &amp; Support.`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/><title>${tx(o.title)}</title>
<style>@media (max-width:620px){.pp-wrap{width:100%!important}.pp-pad{padding:24px 18px!important}.pp-code{font-size:28px!important;letter-spacing:6px!important}.pp-h1{font-size:22px!important;line-height:28px!important}}</style></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${tx(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="pp-wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${C.card};border-radius:18px;overflow:hidden;border:1px solid ${C.line};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="background:${C.navy};padding:22px 28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="${APP_URL}/logo.png" width="36" height="36" alt="" style="display:block;border-radius:9px;border:0;"/></td>
<td style="vertical-align:middle;padding-left:12px;"><div style="font-size:18px;font-weight:800;color:#FFFFFF;letter-spacing:-0.01em;">${esc(BRAND)}</div><div style="font-size:12px;color:${C.mint};">Personal finance, organized.</div></td>
</tr></table></td></tr>
<tr><td class="pp-pad" style="padding:32px 32px 8px;">
${o.body}
</td></tr>
<tr><td class="pp-pad" style="padding:8px 32px 28px;"><div style="border-top:1px solid ${C.line};padding-top:18px;font-size:12px;line-height:19px;color:${C.dim};">${support}<br/><br/>
You received this because of activity on your ${esc(BRAND)} account. We will never ask you for your password, PIN or sign-in code by email or phone.<br/><br/>
<a href="${APP_URL}/privacy-policy" style="color:${C.dim};">Privacy</a> &nbsp;·&nbsp; <a href="${APP_URL}/terms" style="color:${C.dim};">Terms</a> &nbsp;·&nbsp; &copy; ${new Date().getFullYear()} ${esc(BRAND)}</div></td></tr>
</table></td></tr></table></body></html>`;
}

/** Records the parts of the next renderEmail() call, so the Email Builder can start from a built-in email's structure. */
let captured: EmailParts | null = null;
export function captureParts(fn: () => string): EmailParts {
  captured = null;
  fn();
  const out = captured as EmailParts | null;
  captured = null;
  if (!out) throw new Error("template did not call renderEmail");
  return out;
}

export function renderEmail(x: EmailParts): string {
  captured = x;
  const body =
    frag.heading(x.title) +
    x.intro.map(p).join("") +
    frag.bullets(x.bullets ?? []) +
    (x.code ? frag.code(x.code, x.codeNote) : "") +
    (x.cta ? frag.button(x.cta.label, x.cta.url) : "") +
    frag.details(x.rows ?? []) +
    (x.notice ? frag.notice(x.notice.tone, x.notice.text, x.notice.title) : "") +
    (x.outro ?? []).map(p).join("");
  return shell({ title: x.title, preheader: x.preheader, body });
}

/** "6 Oct 2026, 4:12 pm IST" - the time shown in password / PIN change emails. */
export function whenLabel(d = new Date()): string {
  return `${d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} IST`;
}
