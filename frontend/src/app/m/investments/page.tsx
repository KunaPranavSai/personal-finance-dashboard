"use client";

import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Investment } from "@/types";

type Stored<T> = T & { [key: string]: unknown };

const DOT_COLORS = ["var(--ppm-positive)", "var(--ppm-warning)", "var(--ppm-critical)", "var(--ppm-accent)"];

/**
 * Mobile "Invest" tab, reading the same /api/investments collection as the
 * desktop Investments page. Add/edit/delete (InvestmentFormModal-equivalent)
 * is not yet reproduced here — see the implementation report.
 */
export default function MobileInvestmentsPage() {
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["investments"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider().list<Stored<Investment>>("investments").then((items) => ({ items }))
        : api.get<{ items: Investment[] }>("/api/investments"),
  });

  const items = data?.items ?? [];
  const currentValue = items.reduce((s, i) => s + Number(i.currentValue), 0);
  const investedValue = items.reduce((s, i) => s + Number(i.investedAmount), 0);
  const gainPct = investedValue > 0 ? (currentValue - investedValue) / investedValue : 0;

  return (
    <MobileShell title="Investments">
      <div className="ppm-page-title">
        <h2>Investments</h2>
        <p>Portfolio overview</p>
      </div>

      {isLoading && (
        <div className="ppm-stack">
          <LoadingCard lines={1} />
          <LoadingCard lines={4} />
        </div>
      )}

      {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyCard icon="↗" title="No investments tracked yet" subtitle="Add holdings from the desktop Investments page — they'll appear here automatically." />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          <div className="ppm-card">
            <div className="ppm-section-label">Current Value</div>
            <div className="ppm-figure" style={{ justifyContent: "space-between" }}>
              {f(currentValue)}
              <span className={`ppm-delta${gainPct < 0 ? " down" : ""}`}>{gainPct >= 0 ? "+" : ""}{formatPercent(gainPct)} {gainPct >= 0 ? "↗" : "↘"}</span>
            </div>
          </div>

          <div className="ppm-card" style={{ marginTop: 14 }}>
            <div className="ppm-section-label">Holdings</div>
            {items.map((inv, i) => {
              const gain = Number(inv.currentValue) - Number(inv.investedAmount);
              const gainPctOne = Number(inv.investedAmount) > 0 ? gain / Number(inv.investedAmount) : 0;
              return (
                <div className="ppm-hold-row" key={inv.id}>
                  <div className="ppm-hold-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                  <div className="ppm-info">
                    <div className="ppm-name">{inv.instrument}</div>
                    <div className="ppm-meta">{inv.category}{inv.platform ? ` · ${inv.platform}` : ""}</div>
                  </div>
                  <div className="ppm-amt">
                    {f(Number(inv.currentValue))}
                    <span className="ppm-hold-ret" style={{ color: gain >= 0 ? "var(--ppm-positive)" : "var(--ppm-critical)" }}>
                      {gain >= 0 ? "+" : ""}{formatPercent(gainPctOne)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </MobileShell>
  );
}
