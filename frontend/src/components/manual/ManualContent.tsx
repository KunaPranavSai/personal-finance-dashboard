import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { Components } from "react-markdown";
import { dedupeSlug } from "@/lib/manual";

/** A handful of internal Penny Pilot routes the manual can genuinely link
 * to. Anything else with a leading slash is treated as an external/unknown
 * path and rendered as a plain anchor instead of a Next Link. */
const KNOWN_APP_ROUTES = new Set(["/", "/login", "/signup", "/privacy-policy", "/terms", "/manual"]);

function textContent(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textContent((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

function buildComponents(seen: Map<string, number>): Components {
  return {
  h1: () => null, // the page-level H1 is rendered once by the page itself
  h2: ({ children }) => {
    const title = textContent(children);
    return (
      <h2 id={dedupeSlug(seen, title)} className="scroll-mt-24 border-t border-pp-border pt-10 text-2xl font-bold text-pp-text first:mt-0 first:border-t-0 first:pt-0">
        {children}
      </h2>
    );
  },
  h3: ({ children }) => {
    const title = textContent(children);
    return (
      <h3 id={dedupeSlug(seen, title)} className="scroll-mt-24 mt-8 text-lg font-semibold text-pp-text">
        {children}
      </h3>
    );
  },
  p: ({ children }) => {
    const text = textContent(children);
    // "**Label:** description" paragraphs (What it shows / How it is
    // calculated / Example / When it changes, and similar) get a small
    // labeled-row treatment instead of a plain paragraph, so formulas and
    // facts stand out from ordinary prose without touching the source text.
    const match = text.match(/^([A-Za-z /]{2,40}):\s*(.+)$/s);
    const isLabelRow = match && children && Array.isArray(children) && typeof children[0] === "object";
    if (isLabelRow) {
      return (
        <p className="my-2 rounded-lg bg-pp-surface-2 px-4 py-2.5 text-sm leading-relaxed text-pp-text-dim">
          {children}
        </p>
      );
    }
    return <p className="my-4 text-[15px] leading-7 text-pp-text-dim">{children}</p>;
  },
  strong: ({ children }) => <strong className="font-semibold text-pp-text">{children}</strong>,
  ul: ({ children }) => <ul className="my-4 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-pp-text-dim">{children}</ul>,
  ol: ({ children }) => <ol className="my-4 list-decimal space-y-1.5 pl-5 text-[15px] leading-7 text-pp-text-dim">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <div className="my-5 rounded-pp border border-pp-accent/30 bg-pp-accent/5 px-4 py-3 text-sm text-pp-text">
      {children}
    </div>
  ),
  hr: () => <hr className="my-10 border-pp-border" />,
  code: ({ children }) => (
    <code className="rounded bg-pp-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-pp-accent">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-5 overflow-x-auto rounded-pp border border-pp-border bg-pp-surface-2 p-5 text-center font-mono text-sm leading-8 text-pp-text">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-pp border border-pp-border">
      <table className="w-full min-w-[480px] text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-pp-surface-2 text-left text-pp-text-dim">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-2.5 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-t border-pp-border px-4 py-2.5 text-pp-text-dim">{children}</td>,
  a: ({ href, children }) => {
    if (!href) return <>{children}</>;
    if (href.startsWith("#")) {
      return <a href={href} className="font-medium text-pp-accent underline underline-offset-2">{children}</a>;
    }
    if (href.startsWith("/") && KNOWN_APP_ROUTES.has(href)) {
      return (
        <Link href={href} className="font-medium text-pp-accent underline underline-offset-2">
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-pp-accent underline underline-offset-2">
        {children}
      </a>
    );
  },
  };
}

export function ManualContent({ markdown }: { markdown: string }) {
  // A fresh Map per render, so repeated ids (a few section titles, like
  // "Net Worth", are used more than once across different Parts) still
  // resolve to unique anchors, matching the same de-duplication order the
  // TOC and search index use in lib/manual.ts.
  const seen = new Map<string, number>();
  return (
    <div className="mx-auto max-w-[720px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={buildComponents(seen)}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
