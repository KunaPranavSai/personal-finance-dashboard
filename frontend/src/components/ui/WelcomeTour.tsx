"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Wallet, ArrowLeftRight, BarChart3, FileText,
  Bell, Shield, KeyRound, ChevronRight, ChevronLeft, X,
} from "lucide-react";
import { Button } from "./Button";

const SLIDES = [
  { icon: LayoutDashboard, title: "Dashboard", body: "See your income, expenses, savings, and net worth at a glance." },
  { icon: Wallet, title: "Budget Management", body: "Set monthly, quarterly, or yearly budgets per category and track utilization." },
  { icon: ArrowLeftRight, title: "Expense & Income Tracking", body: "Log transactions with categories, accounts, payment methods, and tags." },
  { icon: BarChart3, title: "Analytics", body: "Build fully customizable charts across any time range and filter combination." },
  { icon: FileText, title: "Reports", body: "Export monthly summaries, category reports, and budget comparisons." },
  { icon: Bell, title: "Notifications", body: "Stay on top of budget alerts, bill reminders, and security events." },
  { icon: Shield, title: "Security Settings", body: "Enable Two-Factor Authentication and review your Activity Log." },
  { icon: KeyRound, title: "Backup Codes", body: "Save your 2FA backup codes somewhere safe when you enable 2FA." },
];

export function WelcomeTour({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const isFirst = step === 0;
  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-navy-dark"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-navy/40 hover:bg-black/5 dark:text-white/40 dark:hover:bg-white/10"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>

            {isFirst && (
              <div className="mb-6 text-center">
                <p className="text-xl font-bold text-navy dark:text-white">Welcome to Penny Pilot</p>
                <p className="mt-1 text-sm text-navy/50 dark:text-white/50">Here&apos;s a quick look at what you can do.</p>
              </div>
            )}

            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
                <slide.icon className="h-8 w-8 text-teal" />
              </div>
              <div>
                <p className="text-lg font-semibold text-navy dark:text-white">{slide.title}</p>
                <p className="mt-2 text-sm text-navy/60 dark:text-white/60">{slide.body}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5">
              {SLIDES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-teal" : "w-1.5 bg-black/10 dark:bg-white/15"}`}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={isFirst}
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              {isLast ? (
                <Button type="button" size="sm" onClick={handleClose}>Get Started</Button>
              ) : (
                <Button type="button" size="sm" onClick={() => setStep((s) => Math.min(SLIDES.length - 1, s + 1))}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {!isLast && (
              <button
                onClick={handleClose}
                className="mt-4 w-full text-center text-xs text-navy/40 hover:text-navy/60 dark:text-white/40 dark:hover:text-white/60"
              >
                Skip for now
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
