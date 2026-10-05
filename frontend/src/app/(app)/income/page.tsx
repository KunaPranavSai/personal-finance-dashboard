"use client";

import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/AppTopbar";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { Button } from "@/components/ui/PpButton";
import { Card, CardContent } from "@/components/ui/PpCard";
import { api } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { getLocalDashboardSummary } from "@/lib/services/dashboardService";
import { formatCurrency } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Transaction, DashboardSummary } from "@/types";
import { Plus, TrendingUp, Hash, Wallet } from "lucide-react";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileTransactionsView } from "@/components/mobile/MobileTransactionsView";
import { cn } from "@/lib/format";

export default function IncomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const { settings } = useSettingsContext();
  const isMobile = useIsMobile();
  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => (getStorageMode() === "local" ? getLocalDashboardSummary() : api.get<DashboardSummary>("/api/dashboard/summary")),
  });

  if (isMobile) return <Suspense><MobileTransactionsView initialType="INCOME" /></Suspense>;

  const momChange = summary?.kpis.changeVsPrevMonth.income ?? 0;
  const momPositive = momChange >= 0;

  return (
    <>
      <Topbar title="Income" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 2xl:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-pp-text">Income</h1>
            <p className="text-sm text-pp-text-dim">Every rupee coming in, in one place.</p>
          </div>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Income
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mantis/10">
                <TrendingUp className="h-5 w-5 text-mantis" />
              </div>
              <div>
                <p className="text-xs text-pp-text-dim">This Month&apos;s Income</p>
                <p className="text-lg font-bold text-pp-text">
                  {summary ? formatCurrency(summary.kpis.totalIncome, settings.currency) : "—"}
                </p>
                {summary && (
                  <span className={cn("text-xs font-medium", momPositive ? "text-mantis" : "text-vulcanico")}>
                    {momPositive ? "+" : ""}{formatCurrency(momChange, settings.currency)} vs last month
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pp-accent/10">
                <Wallet className="h-5 w-5 text-pp-accent" />
              </div>
              <div>
                <p className="text-xs text-pp-text-dim">Avg Transaction</p>
                <p className="text-lg font-bold text-pp-text">
                  {summary ? formatCurrency(summary.kpis.avgTransactionAmount, settings.currency) : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pp-accent/10">
                <Hash className="h-5 w-5 text-pp-accent" />
              </div>
              <div>
                <p className="text-xs text-pp-text-dim">Transactions</p>
                <p className="text-lg font-bold text-pp-text">{summary ? summary.kpis.transactionCount : "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-5">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-pp-surface-2" />}>
              <TransactionsTable fixedType="INCOME" onEdit={(tx) => { setEditing(tx); setModalOpen(true); }} />
            </Suspense>
          </CardContent>
        </Card>
      </main>

      <TransactionFormModal
        open={modalOpen}
        editing={editing}
        fixedType="INCOME"
        onClose={() => { setModalOpen(false); setEditing(null); }}
      />
    </>
  );
}
