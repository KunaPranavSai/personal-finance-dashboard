"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/format";

const FAQ_ITEMS = [
  {
    question: "What is Penny Pilot?",
    answer: "Penny Pilot is a personal finance dashboard that helps you track income, expenses, budgets, bills, savings goals, and investments in one organized place. It runs in your browser and as an installable PWA on any device.",
  },
  {
    question: "What can I track with Penny Pilot?",
    answer: "You can track income and expense transactions (with categories, subcategories, tags, notes, accounts, payment methods), monthly/quarterly/yearly budgets per category, recurring bills with due dates and auto-pay, savings goals with targets and monthly contributions, and investments with current values, returns, and contribution schedules.",
  },
  {
    question: "Can I track income and expenses?",
    answer: "Yes. Penny Pilot's core feature is transaction tracking. Each entry includes date, description, amount, type (income/expense), category, subcategory, merchant, account, payment method, location, tags, notes, and whether it's recurring/fixed-variable/essential.",
  },
  {
    question: "Can I create budgets?",
    answer: "Yes. You can create budgets for any category with monthly, quarterly, or yearly periods. The dashboard shows utilization percentage, status (under/near/over budget), actual vs. planned amounts, and variance.",
  },
  {
    question: "Can I track savings goals?",
    answer: "Yes. Create goals with a name, category (including Emergency Fund), target amount, current amount, and monthly contribution. Progress is shown visually with percentage bars. Multiple goals can run simultaneously.",
  },
  {
    question: "Can I track investments?",
    answer: "Yes. Track instruments with category, invested amount, current value, purchase date, monthly contribution, annual return percentage, platform, and notes. The dashboard shows investment growth and portfolio value.",
  },
  {
    question: "Does Penny Pilot support Google Drive backups?",
    answer: "Yes. You can choose Google Drive mode during signup or switch to it later in Settings. Penny Pilot uses the restricted drive.file OAuth scope to create a dedicated folder in your Drive and writes your financial data as versioned JSON files. Google Drive's native revision history powers the built-in restore feature. You can disconnect at any time — your files remain in your Drive.",
  },
  {
    question: "How does Penny Pilot handle my financial information?",
    answer: "Your financial data is not stored in Penny Pilot's central database. You choose: Google Drive mode (data in your Drive, encrypted OAuth tokens in our DB) or This Device Only mode (local IndexedDB, never leaves your browser). We don't sell data, use third-party analytics, or track you across sites. See our Privacy Policy for full details.",
  },
  {
    question: "Can I delete my account?",
    answer: "Account deletion requests can currently be submitted by contacting Penny Pilot support at the email listed in our Privacy Policy and Terms of Service. Self-service account deletion is not yet available within the app and is planned for a future update. When we receive a request, we verify and process it per our data-retention practices. Deleting your Penny Pilot account does not delete data already stored in your Google Drive or local browser storage — you control that separately.",
  },
  {
    question: "Is Penny Pilot financial advice?",
    answer: "No. Penny Pilot is a personal record-keeping and planning tool. It does not provide financial, investment, tax, or legal advice. Any summaries, charts, budgets, or insights it generates are derived purely from the data you provide and should not be relied upon as professional advice.",
  },
  {
    question: "Does Penny Pilot connect to my bank automatically?",
    answer: "No. Penny Pilot does not have automatic bank synchronization. You manually enter transactions, which gives you full control and awareness of every entry. This also means your bank credentials are never shared with or stored by Penny Pilot.",
  },
  {
    question: "Can I use Penny Pilot offline?",
    answer: "Yes. Penny Pilot is a Progressive Web App (PWA). Once installed, it works offline for viewing and editing your data (in This Device Only mode, or with cached data in Google Drive mode). Changes sync when you're back online.",
  },
  {
    question: "Can I install Penny Pilot as an app?",
    answer: "Yes. Use the \"Install App\" button in the header or on this page. On browsers that support it, this triggers your browser's native install prompt. On browsers without that support (including iOS Safari), you'll see instructions for adding Penny Pilot to your home screen manually.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-16 sm:py-24 lg:py-32 bg-white/30 dark:bg-white/5">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal dark:bg-teal/20 dark:border-teal/40"
          >
            <span className="relative h-1.5 w-1.5 rounded-full bg-teal animate-pulse" aria-hidden="true" />
            FAQ
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-normal tracking-tight text-navy dark:text-white sm:text-4xl [font-family:var(--font-landing-display,inherit)]"
          >
            Common questions
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-navy/60 dark:text-white/60"
          >
            Can&apos;t find your answer? Check our <a href="/privacy-policy" className="font-medium text-teal underline hover:opacity-80">Privacy Policy</a> or <a href="/terms" className="font-medium text-teal underline hover:opacity-80">Terms of Service</a>.
          </motion.p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map(({ question, answer }, i) => (
            <motion.div
              key={question}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className={cn(
                "rounded-xl border border-black/5 bg-white/60 overflow-hidden transition-all dark:border-white/10 dark:bg-white/5",
                openIndex === i && "border-teal/30 dark:border-teal/40"
              )}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className={cn(
                  "w-full px-6 py-4 flex items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
                )}
                aria-expanded={openIndex === i}
                aria-controls={`faq-answer-${i}`}
              >
                <span className="text-base font-semibold text-navy dark:text-white pr-8">{question}</span>
                <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-teal/10 text-teal dark:bg-teal/20 transition-transform duration-200">
                  {openIndex === i ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
              </button>
              <motion.div
                id={`faq-answer-${i}`}
                initial={false}
                animate={{ height: openIndex === i ? "auto" : 0, opacity: openIndex === i ? 1 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-4 border-t border-black/5 dark:border-white/10">
                  <p className="text-sm text-navy/70 dark:text-white/70">{answer}</p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}