"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useUiStore } from "@/store/uiStore";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { AddTransactionSheet } from "@/components/mobile/AddTransactionSheet";
import { useIsMobile } from "@/lib/DeviceContext";

export function QuickActions() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { quickAddType, openQuickAdd } = useUiStore();
  const [mounted, setMounted] = useState(false);

  // The topbar this renders inside uses backdrop-blur, which (per spec)
  // creates a new containing block for fixed-position descendants — without
  // portaling to <body>, the FAB and modal below would be pinned relative to
  // that ~60px header instead of the viewport, squishing them into the top
  // of the screen on mobile instead of floating over the page.
  useEffect(() => setMounted(true), []);

  const openAdd = () => router.push("/add");

  const floatingUi = (
    <>
      {/* Mobile: FAB opens the Add Transaction page. Offset clears the fixed bottom nav (~60px)
          plus safe-area inset — a flat bottom-6 would sit under/behind it
          on an actual mobile route (.pp-mobile), which is where this now
          also renders (see MobileShell) alongside its original desktop-
          narrow-window use inside Topbar. */}
      <div className="fixed right-6 z-40 lg:hidden" style={{ bottom: "calc(var(--ppm-nav-total, calc(56px + env(safe-area-inset-bottom, 0px))) + var(--ppm-fab-gap, 16px))" }}>
        <button
          onClick={openAdd}
          aria-label="Add transaction"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal to-pp-accent text-white shadow-xl shadow-pp-accent/25"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {isMobile ? (
        <AddTransactionSheet open={quickAddType !== null} onClose={() => openQuickAdd(null)} />
      ) : (
        <TransactionFormModal
          open={quickAddType !== null}
          fixedType={quickAddType ?? undefined}
          onClose={() => openQuickAdd(null)}
        />
      )}
    </>
  );

  return (
    <>
      {/* Desktop: the same single entry point, no menu */}
      <button
        onClick={openAdd}
        aria-label="Add transaction"
        className="hidden h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal to-pp-accent text-white shadow-md shadow-pp-accent/20 transition-transform hover:scale-105 lg:flex"
      >
        <Plus className="h-4.5 w-4.5" />
      </button>

      {mounted ? createPortal(floatingUi, document.body) : null}
    </>
  );
}
