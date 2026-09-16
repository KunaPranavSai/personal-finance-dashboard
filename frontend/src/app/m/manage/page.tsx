"use client";

import { useState } from "react";
import { MobileShell } from "@/components/mobile/MobileShell";
import { EntityManagerCard } from "@/components/mobile/EntityManagerCard";
import { CategoryManagerCard } from "@/components/mobile/CategoryManagerCard";

const TABS = [
  { id: "accounts", label: "Wallets" },
  { id: "categories", label: "Categories" },
  { id: "payment-methods", label: "Money Sources" },
] as const;

/** Mobile equivalent of the desktop /customizations page — Wallets/Accounts,
 * Categories, and Money Sources/Payment Methods, tabbed exactly like desktop. */
export default function MobileManagePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("accounts");

  return (
    <MobileShell title="Manage">
      <div className="ppm-page-title">
        <h2>Manage</h2>
        <p>Wallets, categories &amp; money sources</p>
      </div>

      <div className="ppm-filters" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ppm-chip${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "accounts" && (
        <EntityManagerCard
          queryKey="accounts" apiPath="/api/accounts" itemLabel="wallet" addLabel="Add Wallet" icon="🏦"
          emptyTitle="No wallets yet" emptyDescription="Create your first wallet to start tracking expenses and income against it."
        />
      )}
      {tab === "categories" && <CategoryManagerCard />}
      {tab === "payment-methods" && (
        <EntityManagerCard
          queryKey="payment-methods" apiPath="/api/payment-methods" itemLabel="money source" addLabel="Add Money Source" icon="💳"
          emptyTitle="No money sources yet" emptyDescription="Create money sources like Cash, UPI, or Credit Card to tag your expenses and income."
        />
      )}
    </MobileShell>
  );
}
