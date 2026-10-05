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
export interface TemplateTag {
  tag: string;
  description: string;
  /** An override that does not contain this tag cannot be saved (the email would be useless without it). */
  required: boolean;
  /** Shown in the editor preview and used for test sends. */
  sample: string;
}

const APP_URL = process.env.APP_URL ?? "https://personal-finance-dashboard-three-topaz.vercel.app";

/** Available in every email; filled automatically, never required. */
export const GLOBAL_TAGS: TemplateTag[] = [
  { tag: "appName", description: "Product name", required: false, sample: "Penny Pilot" },
  { tag: "year", description: "Current year", required: false, sample: String(new Date().getFullYear()) },
  { tag: "loginUrl", description: "Link to the sign-in page", required: false, sample: `${APP_URL}/login` },
];

const NAME: TemplateTag = { tag: "name", description: "Recipient's name", required: false, sample: "Pranav" };
const CODE = (what: string): TemplateTag => ({ tag: "code", description: `The 6-digit ${what} code`, required: true, sample: "482913" });

export const TEMPLATE_TAGS: Record<string, TemplateTag[]> = {
  welcome: [
    NAME,
    { tag: "uid", description: "Their User ID for signing in", required: true, sample: "pranav.sai" },
    { tag: "tempPassword", description: "Temporary password they must change", required: true, sample: "TempPass123" },
  ],
  rejection: [NAME, { tag: "reason", description: "Why the request was not approved (may be empty)", required: false, sample: "Incomplete information" }],
  password_reset_by_admin: [
    NAME,
    { tag: "uid", description: "Their User ID", required: false, sample: "pranav.sai" },
    { tag: "tempPassword", description: "New temporary password", required: true, sample: "TempPass123" },
  ],
  uid_reset_by_admin: [NAME, { tag: "uid", description: "Their new User ID", required: true, sample: "new.uid" }],
  account_updated: [NAME, { tag: "changes", description: "Text list of what the admin changed", required: true, sample: "Role changed to ADMIN" }],
  recovery_otp: [NAME, CODE("password-reset")],
  password_changed: [NAME],
  email_verification: [NAME, CODE("email-verification")],
  signin_code: [NAME, CODE("sign-in")],
};

/** Tag names each template may fill (kept for callers that only need the names). */
export const TEMPLATE_VARIABLES: Record<string, string[]> = Object.fromEntries(
  Object.entries(TEMPLATE_TAGS).map(([k, tags]) => [k, tags.map((t) => t.tag)])
);

export function sampleVars(templateKey: string): Record<string, string> {
  return Object.fromEntries([...GLOBAL_TAGS, ...(TEMPLATE_TAGS[templateKey] ?? [])].map((t) => [t.tag, t.sample]));
}

const TAG_RE = /\{\{\s*(\w+)\s*\}\}/g;

/** Required tags that `html` does not contain. */
export function missingRequiredTags(templateKey: string, html: string): string[] {
  const used = new Set([...html.matchAll(TAG_RE)].map((m) => m[1]));
  return (TEMPLATE_TAGS[templateKey] ?? []).filter((t) => t.required && !used.has(t.tag)).map((t) => t.tag);
}

/** Tags in `html` that this template cannot fill (typos, or tags belonging to another template). */
export function unknownTags(templateKey: string, html: string): string[] {
  const known = new Set([...GLOBAL_TAGS, ...(TEMPLATE_TAGS[templateKey] ?? [])].map((t) => t.tag));
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
  const globals = Object.fromEntries(GLOBAL_TAGS.map((t) => [t.tag, t.tag === "year" ? String(new Date().getFullYear()) : t.sample]));
  const all: Record<string, string> = { ...globals, ...vars };
  const allowed = new Set([...GLOBAL_TAGS.map((t) => t.tag), ...(TEMPLATE_VARIABLES[templateKey] ?? [])]);
  return html.replace(TAG_RE, (match, key: string) => {
    if (allowed.has(key) && all[key] !== undefined) return escapeHtml(all[key]);
    return match;
  });
}

if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
  const html = "<p>Hi {{name}}, code {{ code }} {{typo}}</p>";
  console.assert(missingRequiredTags("signin_code", "<p>{{name}}</p>").join() === "code", "required tag detected");
  console.assert(missingRequiredTags("signin_code", html).length === 0, "present tag accepted");
  console.assert(unknownTags("signin_code", html).join() === "typo", "unknown tag flagged");
  console.assert(renderTemplate("signin_code", html, { name: "<b>A</b>", code: "123456" }) === "<p>Hi &lt;b&gt;A&lt;/b&gt;, code 123456 {{typo}}</p>", "escapes values, keeps unknown tags");
  console.assert(renderTemplate("welcome", "{{appName}} {{year}}", {}).startsWith("Penny Pilot "), "globals auto-filled");
}
