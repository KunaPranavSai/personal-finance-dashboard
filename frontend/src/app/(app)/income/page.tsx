"use client";

import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useSettingsContext } from "@/lib/SettingsContext";
import { Transaction, DashboardSummary } from "@/types";
import { Plus, TrendingUp } from "lucide-react";

export default function IncomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const { settings } = useSettingsContext();
  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummary>("/api/dashboard/summary"),
  });

  return (
    <>
      <Topbar title="Income" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 rounded-xl2 border border-black/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-navy-dark">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-navy/50 dark:text-white/50">This Month&apos;s Income</p>
              <p className="text-lg font-bold text-navy dark:text-white">
                {summary ? formatCurrency(summary.kpis.totalIncome, settings.currency) : "—"}
              </p>
            </div>
          </div>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Income
          </Button>
        </div>

        <Card>
          <CardContent className="pt-5">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />}>
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
