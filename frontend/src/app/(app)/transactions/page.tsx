"use client";

import { useState, Suspense } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Transaction } from "@/types";
import { Plus } from "lucide-react";

export default function TransactionsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  return (
    <>
      <Topbar title="Transactions" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-navy/50 dark:text-white/50">
            Manage all your income and expense transactions in one place.
          </p>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Transaction
          </Button>
        </div>

        <Card>
          <CardContent className="pt-5">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />}>
              <TransactionsTable onEdit={(tx) => { setEditing(tx); setModalOpen(true); }} />
            </Suspense>
          </CardContent>
        </Card>
      </main>

      <TransactionFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
      />
    </>
  );
}
