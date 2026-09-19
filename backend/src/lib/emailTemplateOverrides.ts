import { prisma } from "./prisma";
import { renderTemplate } from "./emailTemplateRenderer";

/**
 * Resolves the real HTML to send for a given templateKey: an enabled EmailTemplateOverride row's
 * `html` if one exists, else the caller-supplied default (the code template function's own
 * rendered output for THIS specific send, with the real recipient's name/uid/etc. already
 * interpolated).
 *
 * `vars`, when supplied, lets an override's html use `{{name}}`/`{{uid}}`/etc for the variables
 * that template genuinely receives (see emailTemplateRenderer.ts) — overrides are no longer
 * purely static as long as the admin uses the documented tokens for that template. Callers that
 * don't pass `vars` (or an override with no `{{...}}` tokens) get the override's html verbatim,
 * same as before.
 */
export async function resolveEmailHtml(templateKey: string, defaultHtml: string, vars?: Record<string, string>): Promise<string> {
  try {
    const override = await prisma.emailTemplateOverride.findUnique({ where: { templateKey } });
    if (override?.enabled && override.html) {
      return vars ? renderTemplate(templateKey, override.html, vars) : override.html;
    }
    return defaultHtml;
  } catch {
    return defaultHtml;
  }
}

export async function resolveEmailSubject(templateKey: string, defaultSubject: string): Promise<string> {
  try {
    const override = await prisma.emailTemplateOverride.findUnique({ where: { templateKey } });
    if (override?.enabled && override.subject) return override.subject;
    return defaultSubject;
  } catch {
    return defaultSubject;
  }
}
