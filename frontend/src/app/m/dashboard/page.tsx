"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { AddTransactionSheet } from "@/components/mobile/AddTransactionSheet";
import { LoadingCard, ErrorCard } from "@/components/mobile/MobileStates";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/lib/reference";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { getLocalDashboardSummary, getLocalCategoryBreakdown } from "@/lib/services/dashboardService";
import { listLocalTransactions } from "@/lib/services/transactionsService";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatPercent, formatDateIN } from "@/lib/format";
import type { DashboardSummary, Transaction, PaginatedResponse } from "@/types";

const CATEGORY_ICONS = ["📊", "🧾", "🎯", "🍔", "🚗", "🏠", "🎬", "🛒"];

export default function MobileDashboardPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { settings } = useSettingsContext();
  const currency = settings.currency;
  const f = (v: number) => formatCurrency(v, currency);
  const [sheetOpen, setSheetOpen] = useState(false);

  const displayName = user?.name || profile?.name;
  const firstName = displayName?.split(" ")[0];

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => (getStorageMode() === "local" ? getLocalDashboardSummary() : api.get<DashboardSummary>("/api/dashboard/summary")),
  });

  const { data: breakdown } = useQuery({
    queryKey: ["category-breakdown"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getLocalCategoryBreakdown()
        : api.get<{ items: { category: string; total: number }[] }>("/api/dashboard/breakdown/category"),
  });

  const { data: recentTxns } = useQuery({
    queryKey: ["transactions", "recent-3"],
    queryFn: () =>
      getStorageMode() === "local"
        ? listLocalTransactions({ page: 1, pageSize: 3 })
        : api.get<PaginatedResponse<Transaction>>("/api/transactions?page=1&pageSize=3&sortBy=date&sortDir=desc"),
  });

  if (isLoading) {
    return (
      <MobileShell title="Penny Pilot">
        <div className="ppm-stack">
          <LoadingCard lines={2} />
          <LoadingCard />
          <LoadingCard />
        </div>
      </MobileShell>
    );
  }

  if (isError || !summary) {
    return (
      <MobileShell title="Penny Pilot">
        <ErrorCard onRetry={() => refetch()} />
      </MobileShell>
    );
  }

  const k = summary.kpis;
  const incomeChange = k.changeVsPrevMonth?.income ?? 0;
  const netWorthUp = (k.netWorth ?? 0) >= 0;
  const cashflowTotal = Math.max(k.currentMonth.income, 1);
  const incomePct = Math.min(100, (k.currentMonth.income / cashflowTotal) * 100);
  const expensePct = Math.min(100 - incomePct, (k.currentMonth.expense / cashflowTotal) * 100);
  const totalBreakdown = (breakdown?.items ?? []).reduce((s, i) => s + i.total, 0) || 1;

  return (
    <MobileShell title={firstName ? `Hi, ${firstName}` : "Penny Pilot"}>
      <div className="ppm-card">
        <div className="ppm-section-label">Total Net Worth</div>
        <div className="ppm-figure">
          {f(k.netWorth)}
          <span className={`ppm-delta${netWorthUp ? "" : " down"}`}>{netWorthUp ? "+" : ""}{formatPercent(incomeChange)} {netWorthUp ? "↗" : "↘"}</span>
        </div>
        <div className="ppm-quick-actions">
          <button type="button" className="ppm-qa-btn primary" onClick={() => setSheetOpen(true)}>
            <span aria-hidden="true">＋</span>Add
          </button>
          <Link href="/settings?tab=backup" className="ppm-qa-btn">
            <span aria-hidden="true">⟳</span>Sync
          </Link>
          <Link href="/goals" className="ppm-qa-btn">
            <span aria-hidden="true">◎</span>Goals
          </Link>
        </div>
      </div>

      <div className="ppm-stack">
        <div className="ppm-card">
          <div className="ppm-section-label">Monthly Cash Flow</div>
          <div className="ppm-cf-row">
            <span className="in">Income {f(k.currentMonth.income)}</span>
            <span className="out">Expenses {f(k.currentMonth.expense)}</span>
          </div>
          <div className="ppm-bar-track">
            <div className="ppm-bar-fill" style={{ width: `${incomePct}%`, background: "var(--ppm-positive)" }} />
            <div className="ppm-bar-fill" style={{ width: `${expensePct}%`, background: "var(--ppm-warning)" }} />
          </div>
        </div>

        <div className="ppm-card">
          <div className="ppm-section-label">
            Category Breakdown
            <Link href="/budget">View</Link>
          </div>
          {(breakdown?.items ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>No spending recorded yet.</p>
          ) : (
            (breakdown?.items ?? []).slice(0, 4).map((item, i) => (
              <div className="ppm-cat-row" key={item.category}>
                <div className="ppm-ic" aria-hidden="true">{CATEGORY_ICONS[i % CATEGORY_ICONS.length]}</div>
                <div className="ppm-info">
                  <div className="ppm-name">{item.category}</div>
                </div>
                <div className="ppm-amt">
                  {f(item.total)}
                  <span className="sub">{formatPercent(item.total / totalBreakdown)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="ppm-card">
          <div className="ppm-section-label">
            Recent Transactions
            <Link href="/transactions">View all</Link>
          </div>
          {(recentTxns?.items ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>No transactions yet — tap Add to log your first one.</p>
          ) : (
            (recentTxns?.items ?? []).map((t) => (
              <div className="ppm-txn-row" key={t.id}>
                <div className="ppm-ic" aria-hidden="true">{t.type === "INCOME" ? "💰" : "🧾"}</div>
                <div className="ppm-info">
                  <div className="ppm-name">{t.description}</div>
                  <div className="ppm-meta">{formatDateIN(t.date)} · {t.category?.name ?? "Uncategorized"}</div>
                </div>
                <div className={`ppm-amt ${t.type === "INCOME" ? "pos" : "neg"}`}>
                  {t.type === "INCOME" ? "+" : "-"}{f(t.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AddTransactionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </MobileShell>
  );
}
