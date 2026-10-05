"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Receipt, PiggyBank, PieChart } from "lucide-react";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { computeCapital, type CapitalSummary } from "@/lib/capital";
import { useSettingsContext } from "@/lib/SettingsContext";
import { formatCurrency, formatDateIN } from "@/lib/format";
import { LoadingCard, ErrorCard } from "@/components/mobile/MobileStates";

async function loadSummary(): Promise<CapitalSummary> {
  if (getStorageMode() !== "local") return api.get<CapitalSummary>("/api/capital/summary");
  const p = getStorageProvider();
  const [investments, bills, goals, budgets, transactions, categories] = await Promise.all(
    (["investments", "bills", "goals", "budgets", "transactions", "categories"] as const).map((c) => p.list(c))
  );
  return computeCapital({ investments, bills, goals, budgets, transactions, categories });
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="ppm-cap-row">
      <span>{label}</span>
      <span className={tone ? `ppm-amt ${tone}` : undefined}>{value}</span>
    </div>
  );
}

/** Capital home: four tappable summaries; each opens its full management page (create / edit / delete live there). */
export function CapitalOverview() {
  const { settings } = useSettingsContext();
  const m = (v: number) => formatCurrency(v, settings.currency);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["capital-summary"], queryFn: loadSummary });

  if (isLoading) return <LoadingCard lines={6} />;
  if (isError || !data) return <ErrorCard onRetry={() => refetch()} />;
  const { investments: inv, bills, savings, budgets } = data;

  return (
    <>
      <div className="ppm-page-title">
        <h2>Capital</h2>
        <p>Your commitments and allocations at a glance</p>
      </div>
      <div className="ppm-hub">
        <Link href="/investments" className="ppm-card ppm-cap-card">
          <div className="ppm-cap-head"><div className="ppm-ic" aria-hidden="true"><Landmark size={20} /></div><div className="ppm-name">Investments</div><span className="ppm-chev" aria-hidden="true">›</span></div>
          <div className="ppm-figure">{m(inv.invested)}</div>
          <div className="ppm-meta">{inv.count} {inv.count === 1 ? "investment" : "investments"}</div>
          {inv.byCategory.map((l) => <Row key={l.label} label={l.label} value={m(l.amount)} />)}
          {inv.count > 0 && <Row label="Current value" value={m(inv.currentValue)} />}
          {inv.count > 0 && <Row label="Gain / loss" value={`${inv.gain >= 0 ? "+" : "-"}${m(Math.abs(inv.gain))}`} tone={inv.gain >= 0 ? "pos" : "neg"} />}
        </Link>

        <Link href="/bills" className="ppm-card ppm-cap-card">
          <div className="ppm-cap-head"><div className="ppm-ic" aria-hidden="true"><Receipt size={20} /></div><div className="ppm-name">Bills &amp; EMIs</div><span className="ppm-chev" aria-hidden="true">›</span></div>
          <div className="ppm-figure">{m(bills.monthlyTotal)}</div>
          <div className="ppm-meta">{bills.count} active {bills.count === 1 ? "commitment" : "commitments"}</div>
          <Row label="Due this month" value={m(bills.dueThisMonth)} />
          <Row label="Due in 7 days" value={String(bills.dueSoonCount)} />
          {bills.nextDue && <Row label="Next payment" value={formatDateIN(bills.nextDue)} />}
          {bills.top.map((l) => <Row key={l.label} label={l.label} value={m(l.amount)} />)}
        </Link>

        <Link href="/goals" className="ppm-card ppm-cap-card">
          <div className="ppm-cap-head"><div className="ppm-ic" aria-hidden="true"><PiggyBank size={20} /></div><div className="ppm-name">Savings</div><span className="ppm-chev" aria-hidden="true">›</span></div>
          <div className="ppm-figure">{m(savings.saved)}</div>
          <div className="ppm-meta">{savings.count} savings {savings.count === 1 ? "plan" : "plans"}</div>
          <Row label="Monthly contribution" value={m(savings.monthlyContribution)} />
          {savings.top.map((l) => <Row key={l.label} label={l.label} value={m(l.amount)} />)}
        </Link>

        <Link href="/budget" className="ppm-card ppm-cap-card">
          <div className="ppm-cap-head"><div className="ppm-ic" aria-hidden="true"><PieChart size={20} /></div><div className="ppm-name">Budgets</div><span className="ppm-chev" aria-hidden="true">›</span></div>
          <div className="ppm-figure">{m(budgets.allocated)}</div>
          <div className="ppm-meta">allocated this month</div>
          <Row label="Used" value={m(budgets.used)} />
          <Row label="Remaining" value={m(budgets.remaining)} tone={budgets.remaining >= 0 ? "pos" : "neg"} />
          {budgets.top.map((l) => <Row key={l.label} label={l.label} value={`${m(l.amount)} / ${m(l.limit)}`} />)}
        </Link>
      </div>
    </>
  );
}
