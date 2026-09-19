"use client";

import { motion } from "framer-motion";
import { Cloud, Shield, RotateCcw, Download, Upload, Lock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/format";

const DRIVE_FEATURES = [
  {
    icon: Cloud,
    title: "Your Google Drive, Your Data",
    description: "When you choose Google Drive mode, Penny Pilot creates a dedicated folder in your Drive. Your financial data lives there as structured JSON files — you own it completely.",
  },
  {
    icon: Shield,
    title: "Restricted Access (drive.file scope)",
    description: "Penny Pilot requests only the drive.file OAuth scope. This means it can only see, create, and modify files that Penny Pilot itself creates. It cannot browse, read, or modify any other file in your Drive.",
  },
  {
    icon: Lock,
    title: "Encrypted Tokens",
    description: "OAuth access and refresh tokens are encrypted at rest (AES-256-GCM) in our database. They are used exclusively server-side to make authenticated Drive API calls on your behalf.",
  },
  {
    icon: RotateCcw,
    title: "Automatic Version History",
    description: "Google Drive automatically retains prior revisions of your data files. This powers Penny Pilot's built-in 'restore a previous version' feature — no separate backup copies needed.",
  },
  {
    icon: Upload,
    title: "You Control the Connection",
    description: "Connect or disconnect your Google account at any time from Settings. Disconnecting immediately deletes stored tokens from our database but leaves your Drive files untouched.",
  },
  {
    icon: Download,
    title: "Works with Existing Workspaces",
    description: "If you reconnect a Google account that already has a Penny Pilot workspace, you choose whether to reuse that data or start fresh. No silent merging between accounts.",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Choose Google Drive Mode",
    description: "During signup or later in Settings, select Google Drive as your storage mode.",
  },
  {
    step: "02",
    title: "Connect Your Account",
    description: "Complete the Google OAuth flow, granting Penny Pilot permission to create and manage its own folder in your Drive.",
  },
  {
    step: "03",
    title: "Automatic Sync",
    description: "Your transactions, budgets, investments, bills, and goals are written to versioned JSON files in your Drive folder automatically.",
  },
  {
    step: "04",
    title: "Restore When Needed",
    description: "Use the built-in restore feature to revert to any previous version of your data, powered by Google Drive's native revision history.",
  },
];

export function GoogleDrive() {
  return (
    <section id="google-drive" className="py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal dark:bg-teal/20 dark:border-teal/40"
          >
            <span className="relative h-1.5 w-1.5 rounded-full bg-teal animate-pulse" aria-hidden="true" />
            GOOGLE DRIVE BACKUP
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl"
          >
            Keep your financial data backed up — on your terms
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 mx-auto max-w-2xl text-lg text-navy/60 dark:text-white/60"
          >
            Optional Google Drive integration gives you automatic, versioned backups in your own 
            Drive account. You stay in control — Penny Pilot only accesses what it creates.
          </motion.p>
        </div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <h3 className="text-2xl font-bold text-navy dark:text-white text-center mb-10">How it works</h3>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map(({ step, title, description }, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="relative text-center"
              >
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-teal/10 text-teal dark:bg-teal/20 mx-auto">
                  <span className="text-2xl font-bold text-navy dark:text-white">{step}</span>
                </div>
                <h4 className="text-lg font-semibold text-navy dark:text-white mb-2">{title}</h4>
                <p className="text-sm text-navy/60 dark:text-white/60">{description}</p>
                {i < HOW_IT_WORKS_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-teal/20 dark:bg-teal/40" aria-hidden="true" />
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-2xl font-bold text-navy dark:text-white text-center mb-10">Why Google Drive backup</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DRIVE_FEATURES.map(({ icon: Icon, title, description }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className={cn(
                  "relative rounded-2xl border border-black/5 bg-white/60 p-6 transition-all hover:border-teal/30 hover:shadow-xl hover:shadow-teal/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-teal/40 dark:hover:shadow-teal/10"
                )}
              >
                <div className="mb-4 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal dark:bg-teal/20">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h4 className="text-lg font-semibold text-navy dark:text-white">{title}</h4>
                <p className="mt-2 text-sm text-navy/60 dark:text-white/60">{description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Important notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-12 rounded-xl border border-amber/30 bg-amber/10 p-6 dark:bg-amber/20"
        >
          <h4 className="flex items-center gap-2 text-lg font-semibold text-amber-800 dark:text-amber-900 mb-4">
            <CheckCircle className="h-5 w-5" aria-hidden="true" />
            Important notes
          </h4>
          <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-800">
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Google Drive mode requires an active Google account connection. Core features will not function without one.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>You are responsible for maintaining your Google account and sufficient Drive storage space.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>If you revoke access or disconnect, Penny Pilot loses the ability to read/write your data until reconnected.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Penny Pilot depends on Google&apos;s services. We are not responsible for Google outages or API changes.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Prefer local-only? Choose &ldquo;This Device Only&rdquo; mode &mdash; data stays in your browser&apos;s IndexedDB, never sent to any server or Drive.</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </section>
  );
}