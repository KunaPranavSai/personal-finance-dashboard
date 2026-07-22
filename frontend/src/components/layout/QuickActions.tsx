"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, TrendingDown, TrendingUp, Wallet, LineChart, X } from "lucide-react";
import { useUiStore } from "@/store/uiStore";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { cn } from "@/lib/format";

const ACTIONS = [
  { key: "expense", label: "Expense", icon: TrendingDown, color: "bg-red-500" },
  { key: "income", label: "Income", icon: TrendingUp, color: "bg-emerald-500" },
  { key: "budget", label: "Budget", icon: Wallet, color: "bg-amber-500" },
  { key: "investment", label: "Investment", icon: LineChart, color: "bg-teal" },
] as const;

export function QuickActions() {
  const router = useRouter();
  const { quickAddType, openQuickAdd } = useUiStore();
  const [fabOpen, setFabOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // The topbar this renders inside uses backdrop-blur, which (per spec)
  // creates a new containing block for fixed-position descendants — without
  // portaling to <body>, the FAB and modal below would be pinned relative to
  // that ~60px header instead of the viewport, squishing them into the top
  // of the screen on mobile instead of floating over the page.
  useEffect(() => setMounted(true), []);

  const handleAction = (key: (typeof ACTIONS)[number]["key"]) => {
    setFabOpen(false);
    if (key === "expense") openQuickAdd("EXPENSE");
    else if (key === "income") openQuickAdd("INCOME");
    else if (key === "budget") router.push("/budget");
    else router.push("/investments");
  };

  const floatingUi = (
    <>
      {/* Mobile: expandable FAB */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 lg:hidden">
        <AnimatePresence>
          {fabOpen &&
            ACTIONS.map((action, i) => (
              <motion.button
                key={action.key}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleAction(action.key)}
                className="flex items-center gap-2 rounded-full bg-white py-2 pl-3 pr-4 text-sm font-semibold text-navy shadow-lg dark:bg-navy-dark dark:text-white"
              >
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-white", action.color)}>
                  <action.icon className="h-4 w-4" />
                </span>
                {action.label}
              </motion.button>
            ))}
        </AnimatePresence>
        <button
          onClick={() => setFabOpen((v) => !v)}
          aria-label={fabOpen ? "Close quick actions" : "Open quick actions"}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-teal text-white shadow-xl transition-transform active:scale-95"
        >
          <motion.span animate={{ rotate: fabOpen ? 135 : 0 }} transition={{ duration: 0.2 }}>
            {fabOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </motion.span>
        </button>
      </div>

      <TransactionFormModal
        open={quickAddType !== null}
        fixedType={quickAddType ?? undefined}
        onClose={() => openQuickAdd(null)}
      />
    </>
  );

  return (
    <>
      {/* Desktop: top action buttons */}
      <div className="hidden items-center gap-2 lg:flex">
        {ACTIONS.map((action) => (
          <button
            key={action.key}
            onClick={() => handleAction(action.key)}
            className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-navy/70 transition-colors hover:bg-black/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
          >
            <Plus className="h-3.5 w-3.5" /> {action.label}
          </button>
        ))}
      </div>

      {mounted ? createPortal(floatingUi, document.body) : null}
    </>
  );
}
