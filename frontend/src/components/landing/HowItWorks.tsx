const STEPS = [
  { number: "01", title: "Create your account", description: "Sign up in a minute — no admin approval needed." },
  { number: "02", title: "Add your finances", description: "Log income, expenses, budgets, bills, and goals." },
  { number: "03", title: "Understand and plan", description: "See patterns and progress, then plan ahead." },
];

const FLOW_WORDS = ["Track", "Understand", "Plan", "Improve"];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="border-y border-pp-border bg-pp-surface-2/50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 id="how-it-works-heading" className="text-center text-2xl font-bold text-pp-text">How Penny Pilot works</h2>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="text-center sm:text-left">
              <span className="text-2xl font-bold text-pp-accent">{step.number}</span>
              <h3 className="mt-2 text-base font-semibold text-pp-text">{step.title}</h3>
              <p className="mt-1 text-sm text-pp-text-dim">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-pp-border pt-6 text-xs font-semibold text-pp-text-dim">
          {FLOW_WORDS.map((word, i) => (
            <span key={word} className="flex items-center gap-2">
              <span className="rounded-full bg-pp-chip-bg px-3 py-1 text-pp-accent">{word}</span>
              {i < FLOW_WORDS.length - 1 && <span aria-hidden="true">→</span>}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
