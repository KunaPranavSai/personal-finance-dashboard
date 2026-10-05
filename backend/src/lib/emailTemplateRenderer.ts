/**
 * `{{tag}}` substitution for EmailTemplateOverride content (the HTML an admin pastes in). The code-default
 * templates in emailTemplates.ts stay plain JS template-literal functions.
 *
 * Every template documents exactly the tags it can fill (TEMPLATE_TAGS) - the admin editor shows this list in a
 * side panel, marks the ones that must be present, and refuses to save an override that leaves one out. A tag that
 * is not in the list (typo, or one the template does not have) is left literally in place rather than stripped or
 * thrown on, so a bad edit is visible in the sent email instead of silently losing content.
 *
 * Values are HTML-escaped before insertion, so a user's name can never inject markup into an email.
 */
import { platformConfig } from "./platformConfig";
export interface TemplateTag {
  tag: string;
  description: string;
  /** An override that does not contain this tag cannot be saved (the email would be useless without it). */
  required: boolean;
  /** Shown in the editor preview and used for test sends. */
  sample: string;
}

/** Available in every email; filled automatically from System Settings, never required. */
export function globalTags(): TemplateTag[] {
  const c = platformConfig();
  return [
    { tag: "appName", description: "Product name (System Settings)", required: false, sample: c.siteName },
    { tag: "year", description: "Current year", required: false, sample: String(new Date().getFullYear()) },
    { tag: "loginUrl", description: "Link to the sign-in page (App URL in System Settings)", required: false, sample: `${c.appUrl}/login` },
    { tag: "appUrl", description: "Public web address of the app (System Settings)", required: false, sample: c.appUrl },
    { tag: "supportEmail", description: "Support email address (System Settings)", required: false, sample: c.supportEmail || "support@yourdomain.com" },
  ];
}

const NAME: TemplateTag = { tag: "name", description: "Recipient's name", required: false, sample: "Pranav" };
const CODE = (what: string): TemplateTag => ({ tag: "code", description: `The 6-digit ${what} code`, required: true, sample: "482913" });

const EXPIRY: TemplateTag = { tag: "expiry", description: "How long the code stays valid", required: false, sample: "10 minutes" };
const WHEN: TemplateTag = { tag: "when", description: "Date and time of the event (IST)", required: false, sample: "6 Oct 2026, 4:12 pm IST" };

export const TEMPLATE_TAGS: Record<string, TemplateTag[]> = {
  welcome: [NAME, { tag: "uid", description: "Their User ID for signing in", required: false, sample: "pranav.sai" }],
  email_verification: [NAME, CODE("email-verification"), EXPIRY],
  signin_code: [NAME, CODE("sign-in"), EXPIRY],
  recovery_otp: [NAME, CODE("password-reset"), EXPIRY],
  password_changed: [NAME, WHEN],
  password_reset_by_admin: [NAME],
  uid_changed: [
    NAME,
    { tag: "uid", description: "Their new User ID", required: true, sample: "new.uid" },
    { tag: "actor", description: 'Who changed it: "you" or "an administrator"', required: false, sample: "an administrator" },
  ],
  account_updated: [NAME, { tag: "changes", description: "What the admin changed", required: true, sample: "Role changed to ADMIN" }],
  pin_changed: [NAME, WHEN],
  security_alert: [
    NAME,
    { tag: "event", description: "Short name of the event", required: true, sample: "Two-factor authentication turned on" },
    { tag: "detail", description: "One sentence about what happened", required: true, sample: "two-factor authentication was turned on for your account." },
    WHEN,
  ],
  admin_access_code: [NAME, CODE("admin-access"), EXPIRY],
  migration_action_required: [NAME, WHEN],
  migration_completed: [NAME, WHEN],
  migration_failed: [NAME, WHEN],
  drive_disconnected: [NAME, WHEN],
  new_signup_admin: [
    { tag: "adminName", description: "Name of the admin receiving the email", required: false, sample: "Admin" },
    { tag: "newName", description: "Name of the new user", required: false, sample: "Pranav Sai" },
    { tag: "newEmail", description: "Email of the new user", required: false, sample: "pranav@example.com" },
    WHEN,
  ],
  super_admin_alert: [
    { tag: "event", description: "Short name of the event", required: true, sample: "Two-factor authentication turned off" },
    { tag: "detail", description: "What happened", required: true, sample: "An administrator turned off two-factor authentication." },
    { tag: "account", description: "Which admin account (User ID and role)", required: false, sample: "admin.user (ADMIN)" },
    WHEN,
  ],
};

/** Tag names each template may fill (kept for callers that only need the names). */
export const TEMPLATE_VARIABLES: Record<string, string[]> = Object.fromEntries(
  Object.entries(TEMPLATE_TAGS).map(([k, tags]) => [k, tags.map((t) => t.tag)])
);

/** Values every send gets unless the caller supplies its own: the event time, and how long each code email's code lasts. */
const CODE_EXPIRY: Record<string, string> = { email_verification: "10 minutes", signin_code: "10 minutes", recovery_otp: "5 minutes", admin_access_code: "20 minutes" };
export function defaultVars(templateKey: string): Record<string, string> {
  const when = `${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} IST`;
  return { when, ...(CODE_EXPIRY[templateKey] ? { expiry: CODE_EXPIRY[templateKey] } : {}) };
}

export function sampleVars(templateKey: string): Record<string, string> {
  return Object.fromEntries([...globalTags(), ...(TEMPLATE_TAGS[templateKey] ?? [])].map((t) => [t.tag, t.sample]));
}

const TAG_RE = /\{\{\s*(\w+)\s*\}\}/g;

/** Required tags that `html` does not contain. */
export function missingRequiredTags(templateKey: string, html: string): string[] {
  const used = new Set([...html.matchAll(TAG_RE)].map((m) => m[1]));
  return (TEMPLATE_TAGS[templateKey] ?? []).filter((t) => t.required && !used.has(t.tag)).map((t) => t.tag);
}

/** Tags in `html` that this template cannot fill (typos, or tags belonging to another template). */
export function unknownTags(templateKey: string, html: string): string[] {
  const known = new Set([...globalTags(), ...(TEMPLATE_TAGS[templateKey] ?? [])].map((t) => t.tag));
  return [...new Set([...html.matchAll(TAG_RE)].map((m) => m[1]))].filter((t) => !known.has(t));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTemplate(templateKey: string, html: string, vars: Record<string, string>): string {
  const globals = Object.fromEntries(globalTags().map((t) => [t.tag, t.sample]));
  const all: Record<string, string> = { ...globals, ...vars };
  const allowed = new Set([...globalTags().map((t) => t.tag), ...(TEMPLATE_VARIABLES[templateKey] ?? [])]);
  return html.replace(TAG_RE, (match, key: string) => {
    if (allowed.has(key) && all[key] !== undefined) return escapeHtml(all[key]);
    return match;
  });
}

/** Same substitution for plain text (the subject line): values are NOT HTML-escaped, and line breaks are removed. */
export function renderPlain(templateKey: string, text: string, vars: Record<string, string>): string {
  const globals = Object.fromEntries(globalTags().map((t) => [t.tag, t.sample]));
  const all: Record<string, string> = { ...globals, ...vars };
  const allowed = new Set([...globalTags().map((t) => t.tag), ...(TEMPLATE_VARIABLES[templateKey] ?? [])]);
  return text.replace(TAG_RE, (match, key: string) => (allowed.has(key) && all[key] !== undefined ? all[key] : match)).replace(/\s+/g, " ").trim();
}

if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
  const html = "<p>Hi {{name}}, code {{ code }} {{typo}}</p>";
  console.assert(missingRequiredTags("signin_code", "<p>{{name}}</p>").join() === "code", "required tag detected");
  console.assert(missingRequiredTags("signin_code", html).length === 0, "present tag accepted");
  console.assert(unknownTags("signin_code", html).join() === "typo", "unknown tag flagged");
  console.assert(renderTemplate("signin_code", html, { name: "<b>A</b>", code: "123456" }) === "<p>Hi &lt;b&gt;A&lt;/b&gt;, code 123456 {{typo}}</p>", "escapes values, keeps unknown tags");
  console.assert(renderTemplate("welcome", "{{appName}} {{year}}", {}).startsWith("Penny Pilot "), "globals auto-filled");
}
