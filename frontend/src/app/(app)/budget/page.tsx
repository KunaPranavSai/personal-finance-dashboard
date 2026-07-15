"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { BudgetTable } from "@/components/budget/BudgetTable";
import { BudgetFormModal } from "@/components/budget/BudgetFormModal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Plus } from "lucide-react";

function currentPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const periodKey = currentPeriodKey();

  return (
    <>
      <Topbar title="Budget Planner" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-navy/50 dark:text-white/50">
            Monthly budgets for {periodKey}. Actuals are calculated live from your transactions.
          </p>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Set Budget
          </Button>
        </div>

        <Card>
          <CardContent className="pt-5">
            <BudgetTable periodKey={periodKey} />
          </CardContent>
        </Card>
      </main>

      <BudgetFormModal open={modalOpen} onClose={() => setModalOpen(false)} periodKey={periodKey} />
    </>
  );
}
