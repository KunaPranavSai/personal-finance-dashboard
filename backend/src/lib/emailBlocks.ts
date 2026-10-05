/**
 * The Email Builder's engine. An email is an ordered list of Blocks (the structured source of truth) that compiles to
 * the same table-based HTML as the built-in emails, inside the fixed Penny Pilot header and footer.
 *
 * - validateBlocks() accepts untrusted JSON from the admin and returns a clean, size-limited list (or errors).
 * - compileBlocks() / compileHtmlMode() produce the tagged HTML that is stored on a version; {{tags}} are filled when
 *   an email is sent (renderTemplate escapes every value).
 * - HTML mode is for admins who want to write markup: it is sanitised to an email-safe allow-list (no scripts, forms,
 *   iframes, event handlers, remote CSS or non-https links) and still sits inside the fixed frame.
 */
import crypto from "crypto";
import sanitizeHtml from "sanitize-html";
import { frag, shell, captureParts, appUrl, EmailParts } from "./emailLayout";
import { EMAIL_TEMPLATES } from "./emailTemplates";
import { globalTags, TEMPLATE_TAGS } from "./emailTemplateRenderer";

export type Block =
  | { id: string; type: "eyebrow" | "heading" | "text"; text: string }
  | { id: string; type: "bullets"; items: string[] }
  | { id: string; type: "code"; value: string; note?: string }
  | { id: string; type: "button"; label: string; url: string }
  | { id: string; type: "details"; rows: [string, string][] }
  | { id: string; type: "notice"; tone: "info" | "warn"; title?: string; text: string }
  | { id: string; type: "image"; url: string; alt: string }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; size: number };

export const BLOCK_TYPES = ["eyebrow", "heading", "text", "bullets", "code", "button", "details", "notice", "image", "divider", "spacer"] as const;
const MAX_BLOCKS = 40;
const MAX_TEXT = 2000;
const MAX_HTML = 60_000;

const newId = () => crypto.randomBytes(4).toString("hex");

/** Link targets an email may contain: https, mailto, or a link built from the App URL tags. */
export function isSafeUrl(url: string): boolean {
  const u = url.trim();
  if (!u || /[\s\u0000-\u001f<>"']/.test(u)) return false;
  if (/^https:\/\//i.test(u) || /^mailto:[^\s]+$/i.test(u)) return true;
  if (/^\{\{\s*(appUrl|loginUrl)\s*\}\}/.test(u)) return true;
  return process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?(\/|$)/i.test(u);
}

const str = (v: unknown, max = MAX_TEXT) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Cleans untrusted block JSON. Unknown types and properties are dropped; limits are enforced. */
export function validateBlocks(raw: unknown): { blocks: Block[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(raw)) return { blocks: [], errors: ["Blocks must be a list."] };
  if (raw.length > MAX_BLOCKS) errors.push(`An email can have at most ${MAX_BLOCKS} blocks.`);
  const blocks: Block[] = [];
  raw.slice(0, MAX_BLOCKS).forEach((b, i) => {
    const n = i + 1;
    if (!b || typeof b !== "object") { errors.push(`Block ${n} is not valid.`); return; }
    const r = b as Record<string, unknown>;
    const id = str(r.id, 24) || newId();
    switch (r.type) {
      case "eyebrow": case "heading": case "text": {
        const text = str(r.text);
        if (!text) errors.push(`Block ${n} (${r.type}) needs text.`);
        blocks.push({ id, type: r.type, text });
        break;
      }
      case "bullets": {
        const items = (Array.isArray(r.items) ? r.items : []).map((x) => str(x, 400)).filter(Boolean).slice(0, 20);
        if (!items.length) errors.push(`Block ${n} (list) needs at least one item.`);
        blocks.push({ id, type: "bullets", items });
        break;
      }
      case "code": {
        const value = str(r.value, 80);
        if (!value) errors.push(`Block ${n} (code box) needs a value, usually {{code}}.`);
        blocks.push({ id, type: "code", value, note: str(r.note, 200) || undefined });
        break;
      }
      case "button": {
        const label = str(r.label, 80), url = str(r.url, 500);
        if (!label) errors.push(`Block ${n} (button) needs a label.`);
        if (!isSafeUrl(url)) errors.push(`Block ${n} (button) needs a link that starts with https://, mailto: or {{appUrl}}.`);
        blocks.push({ id, type: "button", label, url });
        break;
      }
      case "details": {
        const rows = (Array.isArray(r.rows) ? r.rows : []).map((x) => (Array.isArray(x) ? [str(x[0], 80), str(x[1], 400)] : ["", ""]) as [string, string]).filter(([k, v]) => k || v).slice(0, 12);
        if (!rows.length) errors.push(`Block ${n} (info card) needs at least one row.`);
        blocks.push({ id, type: "details", rows });
        break;
      }
      case "notice": {
        const text = str(r.text);
        if (!text) errors.push(`Block ${n} (notice) needs text.`);
        blocks.push({ id, type: "notice", tone: r.tone === "warn" ? "warn" : "info", title: str(r.title, 120) || undefined, text });
        break;
      }
      case "image": {
        const url = str(r.url, 500);
        if (!/^https:\/\//i.test(url) && !/^\{\{\s*appUrl\s*\}\}\//.test(url)) errors.push(`Block ${n} (image) needs an https:// address.`);
        blocks.push({ id, type: "image", url, alt: str(r.alt, 200) });
        break;
      }
      case "divider": blocks.push({ id, type: "divider" }); break;
      case "spacer": blocks.push({ id, type: "spacer", size: Math.max(4, Math.min(80, Number(r.size) || 16)) }); break;
      default: errors.push(`Block ${n} has an unknown type.`);
    }
  });
  return { blocks, errors };
}

/** Block mode: compile to the tagged HTML. */
export function compileBlocks(blocks: Block[], preheader: string): string {
  const title = (blocks.find((b) => b.type === "heading") as { text: string } | undefined)?.text ?? "Message";
  const body = blocks
    .map((b) => {
      switch (b.type) {
        case "eyebrow": return frag.eyebrow(b.text);
        case "heading": return frag.heading(b.text);
        case "text": return frag.text(b.text);
        case "bullets": return frag.bullets(b.items);
        case "code": return frag.code(b.value, b.note);
        case "button": return frag.button(b.label, b.url);
        case "details": return frag.details(b.rows);
        case "notice": return frag.notice(b.tone, b.text, b.title);
        case "image": return frag.image(b.url, b.alt);
        case "divider": return frag.divider();
        case "spacer": return frag.spacer(b.size);
      }
    })
    .join("");
  return shell({ title, preheader, body });
}

const SAFE_CSS = /^(?!.*(url\s*\(|expression|javascript|@import|behavior))[^;{}<>]*$/i;
const CSS_PROPS = ["color", "background-color", "font-size", "font-weight", "font-style", "font-family", "line-height", "letter-spacing", "text-align", "text-decoration", "text-transform", "margin", "margin-top", "margin-bottom", "margin-left", "margin-right", "padding", "padding-top", "padding-bottom", "padding-left", "padding-right", "border", "border-top", "border-bottom", "border-left", "border-right", "border-radius", "border-collapse", "width", "max-width", "height", "vertical-align", "display"];

/** HTML mode: keep only email-safe markup. Returns the cleaned body fragment. */
export function sanitizeEmailHtml(input: string): string {
  const keepUrl = (name: string, value: string) => (isSafeUrl(value) ? value : undefined);
  return sanitizeHtml(input.slice(0, MAX_HTML), {
    allowedTags: ["a", "b", "strong", "i", "em", "u", "p", "br", "div", "span", "h1", "h2", "h3", "h4", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "img", "hr", "small", "center"],
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "bgcolor", "colspan", "rowspan", "cellpadding", "cellspacing", "border", "role"],
      a: ["href", "title"],
      img: ["src", "alt", "width", "height"],
    },
    allowedSchemes: ["https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    allowedStyles: { "*": Object.fromEntries(CSS_PROPS.map((p) => [p, [SAFE_CSS]])) },
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tag, attribs) => {
        const href = attribs.href ? keepUrl("href", attribs.href) : undefined;
        const out: Record<string, string> = { ...attribs, rel: "noopener noreferrer" };
        if (href) out.href = href; else delete out.href;
        return { tagName: "a", attribs: out };
      },
      img: (tag, attribs) => {
        const src = attribs.src && (/^https:\/\//i.test(attribs.src) || /^\{\{\s*appUrl\s*\}\}\//.test(attribs.src)) ? attribs.src : undefined;
        const out: Record<string, string> = { ...attribs };
        if (src) out.src = src; else delete out.src;
        return { tagName: "img", attribs: out };
      },
    },
  });
}

export function compileHtmlMode(customHtml: string, preheader: string, title: string): { html: string; sanitized: string } {
  const sanitized = sanitizeEmailHtml(customHtml);
  const body = `<div style="font-size:15px;line-height:24px;color:#17231F;word-break:break-word;overflow-wrap:anywhere;">${sanitized}</div>`;
  return { html: shell({ title, preheader, body }), sanitized };
}

/** The built-in email as blocks, so the builder opens on exactly what is sent today. */
function partsToBlocks(x: EmailParts): Block[] {
  const out: Block[] = [{ id: newId(), type: "heading", text: x.title }];
  x.intro.forEach((text) => out.push({ id: newId(), type: "text", text }));
  if (x.bullets?.length) out.push({ id: newId(), type: "bullets", items: x.bullets });
  if (x.code) out.push({ id: newId(), type: "code", value: x.code, note: x.codeNote });
  if (x.cta) out.push({ id: newId(), type: "button", label: x.cta.label, url: x.cta.url });
  if (x.rows?.length) out.push({ id: newId(), type: "details", rows: x.rows });
  if (x.notice) out.push({ id: newId(), type: "notice", tone: x.notice.tone, title: x.notice.title, text: x.notice.text });
  (x.outro ?? []).forEach((text) => out.push({ id: newId(), type: "text", text }));
  return out;
}

export function builtInDefaults(templateKey: string) {
  const def = EMAIL_TEMPLATES.find((t) => t.id === templateKey);
  if (!def) return null;
  const parts = captureParts(() => def.tagged);
  // Links back to the app use the {{appUrl}} tag so a changed App URL in System Settings still applies.
  const base = appUrl();
  const blocks = partsToBlocks(parts).map((b) => (b.type === "button" && b.url.startsWith(base) ? { ...b, url: b.url.replace(base, "{{appUrl}}") } : b));
  return { name: def.name, subject: def.subject, preheader: parts.preheader, blocks };
}

const TAG_RE = /\{\{\s*(\w+)\s*\}\}/g;
/** What is wrong with `compiled` for this email: required tags that are missing, and tags this email cannot fill. */
export function tagProblems(templateKey: string, compiled: string, subject: string) {
  // A required variable only counts if it is in the visible body, not just the hidden inbox preview or the subject.
  const body = compiled.replace(/<div style="display:none;max-height:0;[^>]*>[^]*?<\/div>/, "");
  const inBody = new Set([...body.matchAll(TAG_RE)].map((m) => m[1]));
  const all = new Set([...(compiled + subject).matchAll(TAG_RE)].map((m) => m[1]));
  const known = new Set([...globalTags(), ...(TEMPLATE_TAGS[templateKey] ?? [])].map((t) => t.tag));
  return {
    missingRequired: (TEMPLATE_TAGS[templateKey] ?? []).filter((t) => t.required && !inBody.has(t.tag)).map((t) => t.tag),
    unknown: [...all].filter((t) => !known.has(t)),
  };
}

if (process.env.NODE_ENV === "test") {
  console.assert(isSafeUrl("https://a.com") && !isSafeUrl("javascript:alert(1)") && isSafeUrl("{{appUrl}}/login"), "url allow-list");
  console.assert(!/script|onerror|javascript/i.test(sanitizeEmailHtml('<p onclick="x()">hi<script>alert(1)</script><a href="javascript:x">l</a><img src="x" onerror="y"></p>')), "sanitiser strips active content");
}
