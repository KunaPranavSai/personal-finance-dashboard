"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { ManualSearchEntry } from "@/lib/manual";

/** Lightweight, dependency-free client-side search over the manual's own
 * headings and paragraph text. No search-engine library, since this only
 * ever runs against one document already loaded on the page. */
export function ManualSearch({ index }: { index: ManualSearchEntry[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return index
      .filter((entry) => entry.title.toLowerCase().includes(q) || entry.text.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, index]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pp-text-dim" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the manual (e.g. budget, Google Drive, 2FA)"
          aria-label="Search the manual"
          className="w-full rounded-xl border border-pp-border bg-pp-surface py-2.5 pl-10 pr-9 text-sm text-pp-text outline-none focus:border-pp-accent"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-pp-text-dim hover:bg-pp-surface-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {query.trim().length >= 2 && (
        <div className="absolute z-20 mt-2 w-full rounded-pp border border-pp-border bg-pp-surface shadow-pp">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-pp-text-dim">No matching sections.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r) => (
                <li key={r.id}>
                  <a
                    href={`#${r.id}`}
                    onClick={() => setQuery("")}
                    className="block px-4 py-2.5 text-sm hover:bg-pp-surface-2"
                  >
                    <span className="font-medium text-pp-text">{r.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
