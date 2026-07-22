"use client";

import { useEffect, useRef, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // The topbar this renders inside uses backdrop-blur, which (per spec)
  // creates a new containing block for fixed-position descendants — without
  // portaling to <body>, the FAB and modal below would be pinned relative to
  // that ~60px header instead of the viewport, squishing them into the top
  // of the screen on mobile instead of floating over the page.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleAction = (key: (typeof ACTIONS)[number]["key"]) => {
    setFabOpen(false);
    setMenuOpen(false);
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
      {/* Desktop: single expandable "+" button, same idea as the mobile FAB */}
      <div ref={menuRef} className="relative hidden lg:block">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close quick actions" : "Open quick actions"}
          aria-expanded={menuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-teal text-white shadow-sm transition-transform hover:brightness-110 active:scale-95"
        >
          <motion.span animate={{ rotate: menuOpen ? 135 : 0 }} transition={{ duration: 0.2 }}>
            <Plus className="h-4.5 w-4.5" />
          </motion.span>
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-navy-dark"
            >
              {ACTIONS.map((action) => (
                <button
                  key={action.key}
                  onClick={() => handleAction(action.key)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium text-navy transition-colors hover:bg-black/5 dark:text-white dark:hover:bg-white/5"
                >
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-white", action.color)}>
                    <action.icon className="h-3.5 w-3.5" />
                  </span>
                  {action.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {mounted ? createPortal(floatingUi, document.body) : null}
    </>
  );
}
