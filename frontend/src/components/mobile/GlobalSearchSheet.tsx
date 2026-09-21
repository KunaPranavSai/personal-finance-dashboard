"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  searchPages,
  searchTransactions,
  searchUserData,
  loadUserDataSnapshot,
  SearchResult,
  UserDataSnapshot,
} from "@/lib/search";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency } from "@/lib/format";
import { Receipt, BarChart3, TrendingUp, Target, Landmark, CreditCard, Tag, Search, Lock } from "lucide-react";

const RESULT_ICON: Record<SearchResult["kind"], React.ReactNode> = {
  page: "→",
  transaction: <Receipt size={16} aria-hidden="true" />,
  budget: <BarChart3 size={16} aria-hidden="true" />,
  investment: <TrendingUp size={16} aria-hidden="true" />,
  bill: <Receipt size={16} aria-hidden="true" />,
  goal: <Target size={16} aria-hidden="true" />,
  account: <Landmark size={16} aria-hidden="true" />,
  paymentMethod: <CreditCard size={16} aria-hidden="true" />,
  category: <Tag size={16} aria-hidden="true" />,
};

// A handful of common destinations shown before the user types anything —
// real app pages, not fabricated suggestions.
const SUGGESTED_HREFS = ["/transactions", "/budget", "/investments", "/bills", "/settings/security"];

/** Highlights the first case-insensitive occurrence of `query` inside
 * `text`, where practical (skipped when the match came purely from a
 * keyword/fuzzy match with no literal substring to point at). */
function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/** Real, functional global search presented as a full-screen, app-style
 * overlay (search bar pinned at the top, results scroll below — never a
 * small sheet hovering just above the keyboard). Searches the app's own
 * pages/features plus the signed-in user's own data: transactions, budgets,
 * investments, bills, goals, wallets/accounts, money sources and
 * categories — via the same storage-mode-aware services each of those
 * pages already uses (Local-Only IndexedDB or the existing REST endpoints,
 * both already scoped to the authenticated user). No mock results. */
export function GlobalSearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { settings } = useSettingsContext();
  const cur = useMemo(() => (v: number) => formatCurrency(v, settings.currency), [settings.currency]);
  const [query, setQuery] = useState("");
  const [txnResults, setTxnResults] = useState<SearchResult[]>([]);
  const [snapshot, setSnapshot] = useState<UserDataSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [txnLoading, setTxnLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setTxnResults([]);
      setError(false);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    setSnapshotLoading(true);
    loadUserDataSnapshot()
      .then(setSnapshot)
      .catch(() => setSnapshot(null))
      .finally(() => setSnapshotLoading(false));
    return () => clearTimeout(t);
  }, [open]);

  // Live matching on every keystroke for pages + the already-fetched data
  // snapshot (pure client-side filtering, no network wait). Only the
  // transaction lookup needs a network/IndexedDB round trip, so only that
  // part is (lightly) debounced.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setTxnResults([]);
      setTxnLoading(false);
      setError(false);
      return;
    }
    setTxnLoading(true);
    setError(false);
    const timeout = setTimeout(() => {
      searchTransactions(q, cur)
        .then(setTxnResults)
        .catch(() => setError(true))
        .finally(() => setTxnLoading(false));
    }, 120);
    return () => clearTimeout(timeout);
  }, [query, cur]);

  const q = query.trim();
  const pageResults = q ? searchPages(q) : [];
  const dataResults = q ? searchUserData(q, snapshot, cur) : [];
  const allResults = [...pageResults, ...dataResults, ...txnResults];
  const grouped = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    for (const r of allResults) {
      const list = groups.get(r.group) ?? [];
      list.push(r);
      groups.set(r.group, list);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, txnResults, snapshot]);

  const isLoading = txnLoading || (snapshotLoading && q.length > 0);

  const handleSelect = (r: SearchResult) => {
    onClose();
    router.push(r.href);
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="ppm-sheet-portal">
      <div
        className={`ppm-search-overlay${open ? " show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        aria-hidden={!open}
      >
        <div className="ppm-search-top">
          <button type="button" className="ppm-search-back" aria-label="Close search" onClick={onClose}>
            ←
          </button>
          <div className="ppm-search-input-wrap">
            <span aria-hidden="true" style={{ color: "var(--ppm-text-dim)", fontSize: 15 }}>⌕</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, transactions, budgets…"
              aria-label="Search"
              enterKeyHint="search"
            />
            {query && (
              <button type="button" className="ppm-search-clear" aria-label="Clear search" onClick={handleClear}>
                ×
              </button>
            )}
          </div>
        </div>

        <div className="ppm-search-results">
          {!q && (
            <>
              <div className="ppm-search-group-label">Suggestions</div>
              <div className="ppm-card" style={{ background: "var(--ppm-surface-2)", padding: 6 }}>
                {SUGGESTED_HREFS.map((href) => {
                  const label =
                    href === "/transactions" ? "Transactions" :
                    href === "/budget" ? "Budget" :
                    href === "/investments" ? "Investments" :
                    href === "/bills" ? "Bills & EMIs" :
                    "2FA, Passkeys & Password";
                  const icon =
                    href === "/transactions" ? "≡" :
                    href === "/budget" ? "◧" :
                    href === "/investments" ? "↗" :
                    href === "/bills" ? <Receipt size={16} aria-hidden="true" /> :
                    <Lock size={16} aria-hidden="true" />;
                  return (
                    <button
                      key={href}
                      type="button"
                      className="ppm-list-item ppm-search-result"
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none" }}
                      onClick={() => handleSelect({ id: `suggest:${href}`, kind: "page", group: "Suggestions", title: label, href })}
                    >
                      <div className="ppm-ic" aria-hidden="true">{icon}</div>
                      <div className="ppm-info"><div className="ppm-name">{label}</div></div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {q && error && <p style={{ fontSize: 13, color: "var(--ppm-critical)" }}>Something went wrong — try again.</p>}

          {q && !error && (
            <>
              {allResults.length === 0 && !isLoading && (
                <div className="ppm-empty">
                  <div className="ic" aria-hidden="true"><Search size={20} /></div>
                  <div className="t">No matches for &ldquo;{query}&rdquo;</div>
                  <div className="s">Try a different keyword, like a page name or a transaction description.</div>
                </div>
              )}

              {Array.from(grouped.entries()).map(([group, items]) => (
                <div key={group}>
                  <div className="ppm-search-group-label">{group}</div>
                  <div className="ppm-card" style={{ background: "var(--ppm-surface-2)", padding: 6 }}>
                    {items.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelect(r)}
                        className="ppm-list-item ppm-search-result"
                        style={{ width: "100%", textAlign: "left", background: "none", border: "none" }}
                      >
                        <div className="ppm-ic" aria-hidden="true">{RESULT_ICON[r.kind]}</div>
                        <div className="ppm-info">
                          <div className="ppm-name">{highlight(r.title, query)}</div>
                          {r.subtitle && <div className="ppm-meta">{r.subtitle}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {isLoading && allResults.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--ppm-text-dim)", marginTop: 10 }}>Searching…</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
