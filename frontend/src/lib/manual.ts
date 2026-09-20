import fs from "node:fs";
import path from "node:path";

// PENNY_PILOT_USER_MANUAL.md is the single master document (kept at the
// project root, alongside both `frontend/` and `backend/`), so the public
// /manual page always reflects the same file a developer edits directly,
// never a second hand-maintained copy.
function resolveManualPath(): string {
  const candidates = [
    path.join(process.cwd(), "..", "PENNY_PILOT_USER_MANUAL.md"),
    path.join(process.cwd(), "PENNY_PILOT_USER_MANUAL.md"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  return found ?? candidates[0];
}

export function getManualMarkdown(): string {
  // Normalize CRLF to LF: the master document is edited on Windows, and a
  // trailing \r on every line otherwise breaks the line-based heading/anchor
  // parsing below (react-markdown itself doesn't care either way).
  return fs.readFileSync(resolveManualPath(), "utf-8").replace(/\r\n/g, "\n");
}

/** The manual's own cover, intro, and numbered table of contents are
 * replaced on the website by the page's own H1 and the ManualToc component,
 * so this returns only the body starting at "Part 1", avoiding a duplicate
 * title and a duplicate (unstyled) table of contents. */
export function getManualBody(markdown: string): string {
  const marker = "## Part 1:";
  const index = markdown.indexOf(marker);
  return index === -1 ? markdown : markdown.slice(index);
}

export interface ManualHeading {
  id: string;
  title: string;
  level: 2 | 3;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** A few section titles repeat verbatim across different Parts (for
 * example "Net Worth" is explained once conceptually and again in the
 * calculations chapter). `seen` must be a fresh Map per top-to-bottom pass
 * over the document, and the same pass order must be used everywhere a
 * heading id is produced, so the TOC, search index, and the actual
 * rendered anchor ids always agree on which "net-worth" is which. */
export function dedupeSlug(seen: Map<string, number>, title: string): string {
  const base = slugify(title);
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

/** Every H2 ("## Part N: Title") and H3 within it, used for the table of
 * contents, "On this page" navigation, and the client-side search index. */
export function getManualHeadings(markdown: string): ManualHeading[] {
  const lines = markdown.split("\n");
  const headings: ManualHeading[] = [];
  const seen = new Map<string, number>();
  for (const line of lines) {
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      headings.push({ id: dedupeSlug(seen, h2[1]), title: h2[1], level: 2 });
      continue;
    }
    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      headings.push({ id: dedupeSlug(seen, h3[1]), title: h3[1], level: 3 });
    }
  }
  return headings;
}

export interface ManualSearchEntry {
  id: string;
  title: string;
  level: 2 | 3;
  text: string;
}

/** A flat, plain-text index (heading + the paragraphs under it, markdown
 * syntax stripped) used for the lightweight client-side search. */
export function getManualSearchIndex(markdown: string): ManualSearchEntry[] {
  const lines = markdown.split("\n");
  const entries: ManualSearchEntry[] = [];
  const seen = new Map<string, number>();
  let current: ManualSearchEntry | null = null;

  const strip = (s: string) =>
    s
      .replace(/[#*`>|]/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

  for (const line of lines) {
    const h2 = line.match(/^## (.+)$/);
    const h3 = line.match(/^### (.+)$/);
    if (h2 || h3) {
      if (current) entries.push(current);
      const title = (h2 ? h2[1] : h3![1]).trim();
      current = { id: dedupeSlug(seen, title), title, level: h2 ? 2 : 3, text: "" };
      continue;
    }
    if (current && line.trim()) {
      current.text += " " + strip(line);
    }
  }
  if (current) entries.push(current);
  return entries;
}
