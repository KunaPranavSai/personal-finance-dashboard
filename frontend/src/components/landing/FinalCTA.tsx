import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-pp border border-pp-border bg-pp-surface p-8 text-center shadow-pp sm:p-10">
        <h2 className="text-2xl font-bold text-pp-text">Ready to take control of your money?</h2>
        <p className="mt-2 text-sm text-pp-text-dim">Free to use, no credit card required.</p>
        <div className="mt-6">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl bg-pp-accent px-6 py-3 text-sm font-semibold text-pp-accent-ink transition-opacity hover:opacity-90"
          >
            Get Started
          </Link>
        </div>
      </div>
    </section>
  );
}
