"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { searchPages, searchTransactions, SearchResult } from "@/lib/search";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency } from "@/lib/format";

/** Real, functional desktop search — same data sources as the mobile
 * GlobalSearchSheet (app pages + the signed-in user's own transactions via
 * the existing storage-mode-aware transaction services), just presented as
 * an inline dropdown instead of a full-screen sheet. Replaces the previous
 * input, which had no onChange/results/data source at all and only ever
 * pushed a hardcoded `/expenses?search=` on Enter. */
export function DesktopSearch() {
  const router = useRouter();
  const { settings } = useSettingsContext();
  const cur = (v: number) => formatCurrency(v, settings.currency);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setLoading(false); setError(false); return; }
    setLoading(true);
    setError(false);
    const timeout = setTimeout(() => {
      Promise.all([Promise.resolve(searchPages(q)), searchTransactions(q, cur)])
        .then(([pages, txns]) => setResults([...pages, ...txns]))
        .catch(() => setError(true))
        .finally(() => setLoading(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(r.href);
  };

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <div className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-1.5 text-sm text-navy/50 dark:bg-white/5 dark:text-white/40">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search pages, transactions…"
          className="w-24 min-w-0 bg-transparent text-sm outline-none text-navy dark:text-white placeholder:text-navy/50 dark:placeholder:text-white/40 lg:w-40"
          aria-label="Search"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); setResults([]); }} aria-label="Clear search" className="shrink-0 text-navy/40 hover:text-navy dark:text-white/40 dark:hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 max-h-96 overflow-y-auto rounded-xl border border-black/10 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-navy-dark">
          {loading && <p className="px-3 py-2 text-xs text-navy/50 dark:text-white/50">Searching…</p>}
          {error && <p className="px-3 py-2 text-xs text-red-500">Something went wrong — try again.</p>}
          {!loading && !error && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-navy/50 dark:text-white/50">No results for &ldquo;{query}&rdquo;.</p>
          )}
          {!loading && results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r)}
              className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm text-navy hover:bg-black/5 dark:text-white dark:hover:bg-white/5"
            >
              <span className="mt-0.5 text-xs" aria-hidden="true">{r.kind === "page" ? "→" : "🧾"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.title}</span>
                {r.subtitle && <span className="block truncate text-xs text-navy/50 dark:text-white/50">{r.subtitle}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
