"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { LoginPageClient } from "@/app/login/LoginPageClient";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { useLoginModal } from "./LoginModalContext";

/**
 * Renders the real login flow (LoginPageClient — same component /login uses,
 * same AuthContext, same 2FA/passkey/recovery logic) as an overlay on top of
 * the landing page instead of navigating away. On a successful sign-in,
 * LoginPageClient's own effect calls router.replace(...) to the dashboard,
 * which unmounts this page (and the modal with it) — no extra close logic
 * needed there.
 */
export function LoginModal() {
  const { isOpen, closeLoginModal } = useLoginModal();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLoginModal();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, closeLoginModal]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex justify-center overflow-y-auto bg-black/60 px-4 py-6 backdrop-blur-sm sm:py-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeLoginModal();
          }}
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-md self-start"
          >
            <FocusTrap active={isOpen}>
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Log in to Penny Pilot"
                className="relative overflow-hidden rounded-pp border border-pp-border shadow-2xl"
              >
                <button
                  type="button"
                  onClick={closeLoginModal}
                  aria-label="Close login"
                  className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                <LoginPageClient embedded />
              </div>
            </FocusTrap>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
