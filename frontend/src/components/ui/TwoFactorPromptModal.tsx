"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "./Button";

export function TwoFactorPromptModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();

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
            className="relative w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-navy-dark"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10">
              <ShieldCheck className="h-7 w-7 text-teal" />
            </div>
            <h2 className="text-lg font-bold text-navy dark:text-white">
              Secure your account with Two-Factor Authentication
            </h2>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-teal">Recommended</p>
            <p className="mt-3 text-sm text-navy/60 dark:text-white/60">
              Add an extra layer of protection so only you can sign in, even if your password is compromised. You can always set this up later from Security settings.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={() => { onClose(); router.push("/setup-2fa"); }}>Set Up Now</Button>
              <button
                onClick={onClose}
                className="rounded-lg py-2 text-sm font-medium text-navy/50 hover:text-navy/80 dark:text-white/50 dark:hover:text-white/80 transition-colors"
              >
                Skip For Now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
