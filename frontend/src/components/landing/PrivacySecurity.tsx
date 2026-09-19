"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Database, KeyRound, EyeOff, RotateCcw, Info } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/format";

const SECURITY_FEATURES = [
  {
    icon: Lock,
    title: "Secure authentication",
    description: "Passwords are hashed with bcrypt — never stored in plain text. Optional 2FA (TOTP) and passkey support add another layer.",
  },
  {
    icon: Database,
    title: "Your data, your storage",
    description: "Choose Google Drive mode (data in your own Drive, restricted drive.file scope) or This Device Only mode — local IndexedDB, nothing leaves your browser.",
  },
  {
    icon: Shield,
    title: "Encrypted OAuth tokens",
    description: "Google Drive access tokens are encrypted at rest (AES-256-GCM) before storage, and used exclusively server-side to call the Drive API on your behalf.",
  },
  {
    icon: KeyRound,
    title: "Restricted Drive scope",
    description: "Penny Pilot requests only the drive.file OAuth scope — it can see, create, and modify only the files it creates. It cannot browse the rest of your Drive.",
  },
  {
    icon: RotateCcw,
    title: "Automatic version history",
    description: "In Drive mode, Google retains prior file revisions automatically — powering Penny Pilot's built-in restore-a-previous-version feature.",
  },
  {
    icon: EyeOff,
    title: "No tracking, no selling",
    description: "No third-party analytics or advertising trackers. Only strictly necessary first-party cookies for your session and theme preference.",
  },
];

export function PrivacySecurity() {
  return (
    <section id="privacy-security" className="py-16 sm:py-24 lg:py-28 bg-white/30 dark:bg-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal dark:border-teal/40 dark:bg-teal/20">
            <span className="relative h-1.5 w-1.5 rounded-full bg-teal" />
            PRIVACY &amp; SECURITY
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl">
            Your financial data, on your terms
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-navy/60 dark:text-white/60">
            Penny Pilot never stores your financial data on its own servers by default — you
            choose whether it lives in your own Google Drive or only on this device.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY_FEATURES.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="group relative rounded-2xl border border-black/5 bg-white/60 p-6 transition-all hover:border-teal/30 hover:shadow-xl hover:shadow-teal/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-teal/40 dark:hover:shadow-teal/10"
            >
              <div className="mb-4 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal dark:bg-teal/20">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-navy dark:text-white">{title}</h3>
              <p className="mt-2 text-sm text-navy/60 dark:text-white/60">{description}</p>
            </motion.div>
          ))}
        </div>

        {/* Google Drive backup, condensed — the specific mechanics behind the
            "Your data, your storage" card above. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 flex flex-col gap-4 rounded-2xl border border-black/5 bg-white/60 p-6 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-start sm:gap-6 sm:p-8"
        >
          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-start">
            <Info className="h-5 w-5 text-teal" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-navy dark:text-white sm:mt-1">How Drive backup works</h3>
          </div>
          <p className="text-sm text-navy/60 dark:text-white/60">
            Choosing Google Drive mode creates a dedicated &ldquo;Penny Pilot&rdquo; folder in your own
            Drive and connects it via Google OAuth (restricted drive.file scope only). Your data
            is written there as structured files that Google automatically versions. Disconnect
            at any time from Settings — your Drive files stay exactly as they are, and Penny
            Pilot immediately loses the ability to read or write until you reconnect. Prefer to
            skip Drive entirely? This Device Only mode keeps everything local, with no Google
            connection at all.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mt-10 text-center"
        >
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/privacy-policy"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-teal/30 bg-teal/10 px-5 py-2.5 text-sm font-semibold text-teal transition-all hover:bg-teal/20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 dark:border-teal/40 dark:bg-teal/20 dark:focus-visible:ring-offset-navy-dark"
              )}
            >
              Read Privacy Policy
            </Link>
            <Link
              href="/terms"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-navy/15 bg-white/60 px-5 py-2.5 text-sm font-semibold text-navy transition-all hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
              )}
            >
              Read Terms of Service
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
