"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PennyPilotCoinLoader } from "./ui/PennyPilotCoinLoader";

// Theme tokens (cypress in light, mint in dark), so the loader matches whichever theme the visitor sees.
const NAVY = "var(--pp-accent)";
const GREEN = "var(--pp-text-dim)";

// Timeline (ms): logo 0-500, brand name 300-700, tagline 550-950,
// progress line 700-1900, pause 1900-2100, exit fade 2100-2500.
const HOLD_MS = 2100;

export function Preloader({ onFinish }: { onFinish?: () => void }) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduce || (typeof window !== "undefined" && sessionStorage.getItem("pp-preloader-shown"))) {
      setVisible(false);
      onFinish?.();
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = setTimeout(() => {
      setVisible(false);
      if (typeof window !== "undefined") sessionStorage.setItem("pp-preloader-shown", "1");
    }, HOLD_MS);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!visible) document.body.style.overflow = "";
  }, [visible]);

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-pp-surface"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <div className="flex flex-col items-center px-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            >
              <PennyPilotCoinLoader className="text-2xl sm:text-3xl" style={{ color: NAVY }} />
            </motion.div>

            <motion.p
              className="mt-1.5 text-xs font-semibold tracking-[0.2em]"
              style={{ color: GREEN }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.55, ease: "easeOut" }}
            >
              SMART MONEY MANAGEMENT
            </motion.p>

            <div
              className="relative mt-8 h-1 w-[200px] overflow-hidden rounded-full"
              style={{ backgroundColor: "color-mix(in srgb, var(--pp-accent) 14%, transparent)" }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: NAVY }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.2, delay: 0.7, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
