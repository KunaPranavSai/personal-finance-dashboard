"use client";

import { MobileShell } from "@/components/mobile/MobileShell";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

/** Mobile Activity tab: the unified ledger (income, expenses, bills, budgets, investments, goals). */
export function MobileActivityView() {
  return (
    <MobileShell title="Activity">
      <ActivityFeed />
    </MobileShell>
  );
}
