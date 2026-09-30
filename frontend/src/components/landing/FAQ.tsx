"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";
import { FAQ_ITEMS } from "./faqData";
import { GLASS } from "./styles";

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" aria-labelledby="faq-heading" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 id="faq-heading" className="text-4xl font-semibold tracking-tighter text-pp-text sm:text-5xl">
          Frequently asked questions
        </h2>

        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map(({ question, answer }, i) => (
            <article key={question} className={cn(GLASS, "overflow-hidden")}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="flex min-h-[56px] w-full items-center justify-between gap-4 px-6 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pp-accent"
                  aria-expanded={openIndex === i}
                  aria-controls={`faq-answer-${i}`}
                >
                  <span className="text-base font-semibold text-pp-text">{question}</span>
                  <ChevronDown
                    className={cn("h-5 w-5 shrink-0 text-pp-accent transition-transform duration-300", openIndex === i && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
              </h3>
              <div
                id={`faq-answer-${i}`}
                role="region"
                className={cn("grid transition-all duration-300", openIndex === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-6 text-base leading-relaxed text-pp-text-dim">{answer}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
