"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";
import { FAQ_ITEMS } from "./faqData";

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" aria-labelledby="faq-heading" className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <h2 id="faq-heading" className="text-center text-2xl font-bold text-pp-text">Frequently asked questions</h2>

        <div className="mt-8 space-y-2">
          {FAQ_ITEMS.map(({ question, answer }, i) => (
            <article key={question} className="overflow-hidden rounded-pp border border-pp-border bg-pp-surface">
              <h3>
                <button
                  type="button"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  aria-expanded={openIndex === i}
                  aria-controls={`faq-answer-${i}`}
                >
                  <span className="text-sm font-semibold text-pp-text">{question}</span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-pp-text-dim transition-transform", openIndex === i && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
              </h3>
              <div
                id={`faq-answer-${i}`}
                role="region"
                className={cn("grid transition-all duration-200", openIndex === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-sm text-pp-text-dim">{answer}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
