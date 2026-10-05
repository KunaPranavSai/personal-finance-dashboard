"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useIsMobile } from "@/lib/DeviceContext";
import { Topbar } from "@/components/layout/AppTopbar";
import { MobileShell } from "@/components/mobile/MobileShell";
import { AddTransactionSheet } from "@/components/mobile/AddTransactionSheet";
import { BillFormSheet } from "@/components/mobile/BillFormSheet";
import { BudgetFormSheet } from "@/components/mobile/BudgetFormSheet";
import { InvestmentFormSheet } from "@/components/mobile/InvestmentFormSheet";
import { GoalFormSheet } from "@/components/mobile/GoalFormSheet";
import { SavingsForm } from "@/components/mobile/SavingsForm";

const TYPES = [
  { id: "expense", label: "Expense" },
  { id: "income", label: "Income" },
  { id: "bill", label: "Bills & EMI" },
  { id: "budget", label: "Monthly Budget" },
  { id: "investment", label: "Investments" },
  { id: "goal", label: "Goals" },
  { id: "saving", label: "Savings" },
] as const;
type TypeId = (typeof TYPES)[number]["id"];

/** One workspace for every "add": the swipeable selector picks the form, the page stays put. */
function AddWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const asked = params.get("type");
  const type: TypeId = (TYPES.find((t) => t.id === asked)?.id ?? "expense") as TypeId;
  const railRef = useRef<HTMLDivElement>(null);

  const select = (id: TypeId) => router.replace(`/add?type=${id}`, { scroll: false });
  const done = () => (window.history.length > 1 ? router.back() : router.push("/dashboard"));
  const monthKey = new Date().toISOString().slice(0, 7);

  // Keep the active tile in view as it changes (tap, deep link, or swipe-then-tap).
  useEffect(() => {
    railRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [type]);

  return (
    <>
      <div className="ppm-head-row">
        <button type="button" className="ppm-back" onClick={done} aria-label="Back"><ChevronLeft size={22} /></button>
        <h2 style={{ flex: 1 }}>Add Transaction</h2>
      </div>

      <div className="ppm-type-rail" role="tablist" aria-label="What are you adding?" ref={railRef}>
        {TYPES.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={type === t.id} className={type === t.id ? "on" : ""} onClick={() => select(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="ppm-card">
        {(type === "expense" || type === "income") && <AddTransactionSheet inline open onClose={done} forcedType={type === "income" ? "INCOME" : "EXPENSE"} />}
        {type === "bill" && <BillFormSheet inline open onClose={done} editing={null} />}
        {type === "budget" && <BudgetFormSheet inline open onClose={done} periodKey={monthKey} />}
        {type === "investment" && <InvestmentFormSheet inline open onClose={done} editing={null} />}
        {type === "goal" && <GoalFormSheet inline open onClose={done} editing={null} />}
        {type === "saving" && <SavingsForm onDone={done} onCreateGoal={() => select("goal")} />}
      </div>
    </>
  );
}

export default function AddPage() {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <Suspense><MobileShell title="Add"><AddWorkspace /></MobileShell></Suspense>;
  }
  return (
    <>
      <Topbar title="Add Transaction" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 2xl:px-10">
        <div className="pp-mobile mx-auto w-full max-w-xl" style={{ minHeight: 0, background: "transparent" }}>
          <Suspense><AddWorkspace /></Suspense>
        </div>
      </main>
    </>
  );
}
