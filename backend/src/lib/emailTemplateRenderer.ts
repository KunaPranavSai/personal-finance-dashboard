/**
 * Small, centralized `{{var}}` substitution — for EmailTemplateOverride content only. The
 * code-default templates in emailTemplates.ts are untouched: they're plain JS template-literal
 * functions called with real positional arguments and already work correctly.
 *
 * Exposes exactly the parameters each template function genuinely receives today — no invented
 * variables. An unknown `{{token}}` (typo, or a variable that template doesn't have) is left
 * literally in place rather than stripped or thrown on, so a bad edit never produces a crash —
 * the admin sees the raw `{{token}}` in the sent email and knows something's wrong, rather than
 * silently losing content.
 */
export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  welcome: ["name", "uid", "tempPassword"],
  rejection: ["name", "reason"],
  password_reset_by_admin: ["name", "uid", "tempPassword"],
  uid_reset_by_admin: ["name", "uid"],
  account_updated: ["name", "changes"],
  recovery_otp: ["name", "code"],
  password_changed: ["name"],
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTemplate(templateKey: string, html: string, vars: Record<string, string>): string {
  const allowed = new Set(TEMPLATE_VARIABLES[templateKey] ?? []);
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    if (allowed.has(key) && vars[key] !== undefined) return escapeHtml(vars[key]);
    return match;
  });
}
