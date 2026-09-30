import { Wallet, ShoppingCart, PieChart, CalendarClock, PiggyBank, TrendingUp, FileText, LineChart } from "lucide-react";

const MODULES = [
  { icon: Wallet, label: "Income" },
  { icon: ShoppingCart, label: "Expenses" },
  { icon: PieChart, label: "Budgets" },
  { icon: CalendarClock, label: "Bills" },
  { icon: PiggyBank, label: "Savings goals" },
  { icon: TrendingUp, label: "Investments" },
  { icon: LineChart, label: "Analytics" },
  { icon: FileText, label: "Reports" },
];

/** The page's single marquee: shows the breadth of what one dashboard covers. */
export function Modules() {
  return (
    <section aria-label="What Penny Pilot covers" className="border-y border-white/10 bg-white/[0.02] py-6">
      <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <ul className="lp-marquee flex w-max items-center gap-12 pr-12">
          {[...MODULES, ...MODULES].map((m, i) => (
            <li key={i} aria-hidden={i >= MODULES.length} className="flex items-center gap-3 text-xl font-medium text-pp-text-dim">
              <m.icon className="h-5 w-5 text-pp-accent" strokeWidth={1.75} aria-hidden="true" />
              {m.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
