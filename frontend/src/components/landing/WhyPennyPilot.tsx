import { Search, ClipboardList, BarChart3, ShieldCheck } from "lucide-react";

const BLOCKS = [
  {
    icon: Search,
    title: "Know Where Your Money Goes",
    description: "Track income and expenses and understand your spending patterns.",
  },
  {
    icon: ClipboardList,
    title: "Plan Before You Spend",
    description: "Use budgets, savings goals and financial planning tools to stay organized.",
  },
  {
    icon: BarChart3,
    title: "See the Bigger Picture",
    description: "Use reports, analytics and financial insights to understand your progress.",
  },
  {
    icon: ShieldCheck,
    title: "Keep Control of Your Data",
    description: "Choose the storage approach that fits you — Google Drive or Local-Only.",
  },
];

export function WhyPennyPilot() {
  return (
    <section aria-labelledby="why-heading" className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 id="why-heading" className="text-center text-2xl font-bold text-pp-text">
          Everything you need to understand your money
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {BLOCKS.map((block) => (
            <div key={block.title} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pp-accent/10">
                <block.icon className="h-5 w-5 text-pp-accent" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-pp-text">{block.title}</h3>
                <p className="mt-1 text-sm text-pp-text-dim">{block.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
