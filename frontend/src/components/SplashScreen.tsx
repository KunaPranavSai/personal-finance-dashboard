"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const NAVY = "#1F2A44";
const GREEN = "#1FAE6B";

// Rough monoline "P" outline traced to match the PennyPilot mark: stem up, top bar right,
// rounded bowl down to the stem/bowl junction.
const P_PATH = "M28,138 L28,18 L74,18 A26,26 0 0 1 74,70 L28,70";
// Open "C" arc sitting inside the P's bowl, gap facing up-right to match the logo.
const C_PATH = "M64,37 A15,15 0 1 1 46,30";

const TOTAL_MS = 3000;

export function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("pp-splash-shown")) {
      setVisible(false);
      onFinish?.();
      return;
    }
    const t = setTimeout(() => {
      setVisible(false);
      if (typeof window !== "undefined") sessionStorage.setItem("pp-splash-shown", "1");
    }, TOTAL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{
            background: "radial-gradient(circle at 50% 45%, #ffffff 0%, #f7f8fa 100%)",
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeOut", delay: 0.1 } }}
        >
          <motion.div
            className="flex flex-col items-center"
            initial={{ opacity: 1, scale: 1, y: 0 }}
            animate={{ scale: [1, 1, 0.96], y: [0, 0, -15] }}
            transition={{
              duration: TOTAL_MS / 1000,
              times: [0, 0.85, 1],
              ease: "easeOut",
            }}
          >
            {/* Logo mark */}
            <div className="relative flex h-40 w-40 items-center justify-center">
              {/* Ambient glow behind the mark, stage 4 */}
              <motion.div
                className="absolute h-32 w-32 rounded-full"
                style={{ background: `radial-gradient(circle, ${NAVY}33 0%, transparent 70%)`, filter: "blur(16px)" }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: [0, 0, 0.7, 0], scale: [0.6, 0.6, 1.15, 1.3] }}
                transition={{ duration: 3, times: [0, 0.5, 0.63, 0.75], ease: "easeOut" }}
              />

              <motion.svg
                viewBox="0 0 100 156"
                className="relative h-32 w-24"
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1, 1.08, 1] }}
                transition={{ duration: 3, times: [0, 0.5, 0.58, 0.64], ease: "easeOut" }}
              >
                {/* Stage 1: seed dot */}
                <motion.circle
                  cx="51"
                  cy="44"
                  r="15"
                  fill={NAVY}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0, 1, 1, 0.4] }}
                  transition={{ duration: 3, times: [0, 0.1, 0.27, 0.3], ease: "easeOut" }}
                  style={{ transformOrigin: "51px 44px" }}
                />

                {/* Stage 2: the "C" draws in and spins once, with a shine sweep */}
                <motion.g
                  initial={{ rotate: 0, opacity: 0 }}
                  animate={{ rotate: 360, opacity: 1 }}
                  transition={{
                    rotate: { duration: 0.5, delay: 0.3, ease: "easeInOut" },
                    opacity: { duration: 0.15, delay: 0.28 },
                  }}
                  style={{ transformOrigin: "51px 44px" }}
                >
                  <motion.path
                    d={C_PATH}
                    fill="none"
                    stroke={NAVY}
                    strokeWidth={7}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, delay: 0.32, ease: "easeOut" }}
                  />
                  <motion.circle
                    cx="51"
                    cy="38"
                    r="9"
                    fill="white"
                    opacity={0.85}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.9, 0] }}
                    transition={{ duration: 0.4, delay: 0.45, ease: "easeOut" }}
                  />
                </motion.g>

                {/* Stage 3: outer "P" draws, then settles */}
                <motion.path
                  d={P_PATH}
                  fill="none"
                  stroke={NAVY}
                  strokeWidth={13}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    pathLength: { duration: 0.7, delay: 0.8, ease: "easeInOut" },
                    opacity: { duration: 0.1, delay: 0.8 },
                  }}
                />
              </motion.svg>
            </div>

            {/* Stage 5: brand name */}
            <motion.h1
              className="mt-4 text-3xl font-extrabold tracking-wide"
              style={{ color: NAVY }}
              initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.4, delay: 1.8, ease: "easeOut" }}
            >
              PENNYPILOT
            </motion.h1>

            {/* Stage 6: tagline */}
            <motion.p
              className="mt-1 text-xs font-semibold tracking-[0.2em]"
              style={{ color: GREEN }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 2.0, ease: "easeOut" }}
            >
              SMART MONEY MANAGEMENT
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
