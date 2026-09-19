"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Database, UserCheck, EyeOff, HardDrive, Key, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/format";

const SECURITY_FEATURES = [
  {
    icon: Shield,
    title: "Encrypted OAuth Tokens",
    description: "Google Drive access tokens are encrypted at rest using AES-256-GCM before being stored in our database. They are never stored in plain text.",
  },
  {
    icon: Lock,
    title: "Secure Authentication",
    description: "Passwords are hashed with bcrypt (never stored plain text). Optional 2FA/TOTP and passkey support for additional account protection.",
  },
  {
    icon: Database,
    title: "Your Data, Your Storage",
    description: "Choose Google Drive mode (data in your Drive, restricted drive.file scope) or This Device Only mode (local IndexedDB, never leaves your browser).",
  },
  {
    icon: UserCheck,
    title: "Protected Routes & Sessions",
    description: "Signed HTTP-only cookies for sessions. Sensitive actions (Drive disconnect, data restore) require re-verification when 2FA is enabled.",
  },
  {
    icon: EyeOff,
    title: "No Tracking or Analytics",
    description: "No third-party analytics, advertising trackers, or data selling. Only strictly necessary first-party cookies for session and theme preferences.",
  },
  {
    icon: HardDrive,
    title: "Google Drive Version History",
    description: "In Drive mode, Google automatically retains prior file revisions, powering Penny Pilot's built-in 'restore previous version' feature.",
  },
  {
    icon: Key,
    title: "Restricted Drive Scope",
    description: "Penny Pilot requests only drive.file scope — it can only see, create, and modify files it creates. Cannot browse or access other Drive files.",
  },
  {
    icon: AlertTriangle,
    title: "Transparent Data Handling",
    description: "Clear privacy policy detailing exactly what data is collected, where it's stored, how tokens are handled, and your rights over your data.",
  },
];

export function PrivacySecurity() {
  return (
    <section id="privacy-security" className="py-16 sm:py-24 lg:py-32 bg-white/30 dark:bg-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal dark:bg-teal/20 dark:border-teal/40"
          >
            <span className="relative h-1.5 w-1.5 rounded-full bg-teal animate-pulse" aria-hidden="true" />
            PRIVACY & SECURITY
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold tracking-tight text-navy dark:text-white sm:text-4xl"
          >
            Your financial information deserves to be handled carefully
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 mx-auto max-w-2xl text-lg text-navy/60 dark:text-white/60"
          >
            Penny Pilot is built on a privacy-first architecture. You choose where your data lives, 
            and we implement industry-standard security practices to protect it.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SECURITY_FEATURES.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={cn(
                "group relative rounded-2xl border border-black/5 bg-white/60 p-6 transition-all hover:border-teal/30 hover:shadow-xl hover:shadow-teal/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-teal/40 dark:hover:shadow-teal/10"
              )}
            >
              <div className="mb-4 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal dark:bg-teal/20">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-navy dark:text-white">{title}</h3>
              <p className="mt-2 text-sm text-navy/60 dark:text-white/60">{description}</p>
            </motion.div>
          ))}
        </div>

        {/* Legal links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/privacy-policy"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-teal/30 bg-teal/10 px-5 py-2.5 text-sm font-semibold text-teal transition-all hover:bg-teal/20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark dark:bg-teal/20 dark:border-teal/40"
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