import { Coffee, CalendarClock, Flag } from "lucide-react";

const POINTS = [
  { icon: Coffee, label: "Everyday spending" },
  { icon: CalendarClock, label: "Monthly planning" },
  { icon: Flag, label: "Long-term goals" },
];

export function BuiltForRealLife() {
  return (
    <section aria-labelledby="real-life-heading" className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-pp border border-pp-border bg-pp-surface-2/50 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <h2 id="real-life-heading" className="text-xl font-bold text-pp-text">
          Money management should feel simple.
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {POINTS.map((point) => (
            <div key={point.label} className="flex items-center gap-2">
              <point.icon className="h-4 w-4 text-pp-accent" aria-hidden="true" />
              <span className="text-sm font-medium text-pp-text-dim">{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
