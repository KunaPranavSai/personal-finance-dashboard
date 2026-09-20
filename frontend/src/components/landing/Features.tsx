import { ArrowLeftRight, Target, LineChart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/PpCard";

const FEATURES = [
  {
    icon: ArrowLeftRight,
    title: "Track",
    description: "Track income and expenses in one place.",
  },
  {
    icon: Target,
    title: "Plan",
    description: "Create budgets, goals and financial plans.",
  },
  {
    icon: LineChart,
    title: "Understand",
    description: "See your financial picture through meaningful insights and reports.",
  },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="px-4 py-12 sm:px-6 lg:px-8">
      <h2 id="features-heading" className="sr-only">Track, plan, and understand your finances</h2>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title}>
            <Card>
              <CardContent className="pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pp-accent/10">
                  <f.icon className="h-5 w-5 text-pp-accent" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-pp-text">{f.title}</h3>
                <p className="mt-1 text-sm text-pp-text-dim">{f.description}</p>
              </CardContent>
            </Card>
          </article>
        ))}
      </div>
    </section>
  );
}
