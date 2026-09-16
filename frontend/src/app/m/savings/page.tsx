"use client";

import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard, ErrorCard, EmptyCard } from "@/components/mobile/MobileStates";
import { api } from "@/lib/api";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { SavingsSummary } from "@/types";

/**
 * Mobile "Savings" screen. The desktop savings page calls /api/savings
 * unconditionally — it does NOT branch on getStorageMode() the way
 * Transactions/Budgets/Bills/Goals do, so a Local-Only user's desktop
 * Savings page already only reflects Drive data (or none). This mobile
 * screen reproduces that exact (imperfect) behavior rather than "fixing"
 * it, per the brief's instruction not to change existing behavior while
 * transforming presentation — see the implementation report.
 */
export default function MobileSavingsPage() {
  const { settings } = useSettingsContext();
  const f = (v: number) => formatCurrency(v, settings.currency);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["savings"],
    queryFn: () => api.get<SavingsSummary>("/api/savings"),
  });

  return (
    <MobileShell title="Savings">
      <div className="ppm-page-title">
        <h2>Savings</h2>
        <p>Income vs. expense, over time</p>
      </div>

      {isLoading && (
        <div className="ppm-stack">
          <LoadingCard lines={1} />
          <LoadingCard lines={4} />
        </div>
      )}

      {isError && !isLoading && <ErrorCard onRetry={() => refetch()} />}

      {!isLoading && !isError && data && data.totalIncome === 0 && data.totalExpenses === 0 && (
        <EmptyCard icon="🐷" title="No transaction data yet" subtitle="Add some income and expense transactions to see your savings breakdown." />
      )}

      {!isLoading && !isError && data && (data.totalIncome > 0 || data.totalExpenses > 0) && (
        <>
          <div className="ppm-card">
            <div className="ppm-cat-row">
              <div className="ppm-ic" aria-hidden="true">💰</div>
              <div className="ppm-info"><div className="ppm-name">Total Income</div></div>
              <div className="ppm-amt pos">{f(data.totalIncome)}</div>
            </div>
            <div className="ppm-cat-row">
              <div className="ppm-ic" aria-hidden="true">📉</div>
              <div className="ppm-info"><div className="ppm-name">Total Expenses</div></div>
              <div className="ppm-amt neg">{f(data.totalExpenses)}</div>
            </div>
            <div className="ppm-cat-row">
              <div className="ppm-ic" aria-hidden="true">🐷</div>
              <div className="ppm-info">
                <div className="ppm-name">Total Savings</div>
                <div className="ppm-meta">Rate: {formatPercent(data.savingsRate)}</div>
              </div>
              <div className={`ppm-amt ${data.totalSavings >= 0 ? "pos" : "neg"}`}>{f(data.totalSavings)}</div>
            </div>
          </div>

          <div className="ppm-card" style={{ marginTop: 14 }}>
            <div className="ppm-section-label">Monthly Savings Trend</div>
            {data.monthlyTrend.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>No monthly data yet.</p>
            ) : (
              data.monthlyTrend.map((m) => (
                <div className="ppm-cat-row" key={m.month}>
                  <div className="ppm-info">
                    <div className="ppm-name">{m.month}</div>
                    <div className="ppm-meta">In {f(m.income)} · Out {f(m.expense)}</div>
                  </div>
                  <div className={`ppm-amt ${m.savings >= 0 ? "pos" : "neg"}`}>{f(m.savings)}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </MobileShell>
  );
}
