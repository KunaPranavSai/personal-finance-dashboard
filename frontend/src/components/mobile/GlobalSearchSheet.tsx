"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileSheet } from "./MobileSheet";
import { searchPages, searchTransactions, SearchResult } from "@/lib/search";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency } from "@/lib/format";

/** Real, functional global search: matches the app's own pages (client-side)
 * plus the signed-in user's own transactions (via the same storage-mode-aware
 * services the Transactions page itself uses — Local-Only via IndexedDB,
 * Drive mode via GET /api/transactions, which the backend already scopes to
 * the authenticated user). No mock results, no fake matches. */
export function GlobalSearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { settings } = useSettingsContext();
  const cur = (v: number) => formatCurrency(v, settings.currency);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else { setQuery(""); setResults([]); setError(false); }
  }, [open]);

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

  const handleSelect = (r: SearchResult) => {
    onClose();
    router.push(r.href);
  };

  return (
    <MobileSheet open={open} onClose={onClose} title="Search">
      <div className="ppm-field">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pages, transactions…"
          aria-label="Search"
        />
      </div>

      {loading && <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>Searching…</p>}
      {error && <p style={{ fontSize: 13, color: "var(--ppm-critical)" }}>Something went wrong — try again.</p>}
      {!loading && !error && query.trim() && results.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>No results for &ldquo;{query}&rdquo;.</p>
      )}

      {!loading && results.length > 0 && (
        <div className="ppm-card" style={{ marginTop: 12, background: "var(--ppm-surface-2)", padding: 6 }}>
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r)}
              className="ppm-list-item"
              style={{ width: "100%", textAlign: "left", background: "none", border: "none" }}
            >
              <div className="ppm-ic" aria-hidden="true">{r.kind === "page" ? "→" : "🧾"}</div>
              <div className="ppm-info">
                <div className="ppm-name">{r.title}</div>
                {r.subtitle && <div className="ppm-meta">{r.subtitle}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </MobileSheet>
  );
}
