"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Send, Home } from "lucide-react";
import { ErrorPageShell, errorPrimaryButton } from "@/components/ui/ErrorPageShell";
import { GoldCoin } from "@/components/ui/GoldCoin";

function OrbitingPlane() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      animate={{ rotate: 360 }}
      transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
    >
      <motion.div
        className="absolute left-1/2 top-1/2"
        style={{ marginLeft: "-0.5rem", marginTop: "-0.5rem" }}
        animate={{ x: [46, 0, -46, 0, 46], y: [0, 20, 0, -20, 0], scale: [1, 0.55, 1, 0.55, 1], opacity: [1, 0.45, 1, 0.45, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear", times: [0, 0.25, 0.5, 0.75, 1] }}
      >
        <Send className="h-4 w-4 -rotate-45 text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
      </motion.div>
    </motion.div>
  );
}

export default function NotFound() {
  const [bounce, setBounce] = useState(0);

  return (
    <ErrorPageShell>
      <div className="relative mx-auto mb-2 flex h-28 items-center justify-center gap-1 sm:h-36">
        <span className="bg-gradient-to-b from-white to-white/40 bg-clip-text text-7xl font-extrabold text-transparent sm:text-8xl">4</span>

        <motion.div
          className="relative flex h-20 w-20 items-center justify-center sm:h-28 sm:w-28"
          whileHover={{ scale: 1.12, rotate: 12 }}
          whileTap={{ scale: 0.8, rotate: -18 }}
          onTap={() => setBounce((b) => b + 1)}
          transition={{ type: "spring", stiffness: 300, damping: 12 }}
        >
          <div className="absolute inset-0 rounded-full bg-amber-400/25 blur-xl" />
          <OrbitingPlane />
          <motion.div
            key={bounce}
            animate={bounce ? { x: [0, -10, 8, -5, 0] } : undefined}
            transition={{ type: "spring", stiffness: 500, damping: 10 }}
          >
            <GoldCoin size="3.2rem" spinDuration={3} />
          </motion.div>
        </motion.div>

        <span className="bg-gradient-to-b from-white to-white/40 bg-clip-text text-7xl font-extrabold text-transparent sm:text-8xl">4</span>
      </div>

      <h1 className="text-lg font-bold text-white sm:text-xl">Lost in the Sky</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[#94A3B8]">
        We couldn&apos;t find the page you were looking for.
      </p>

      <div className="mt-8">
        <Link href="/dashboard" className={errorPrimaryButton}>
          <motion.span
            className="inline-flex"
            animate={{ x: [0, 3, 0], y: [0, -2, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Send className="h-4 w-4 -rotate-45" />
          </motion.span>
          Fly Back Home
        </Link>
      </div>

      <p className="mt-6 text-center text-xs text-white/30">
        <Home className="mr-1 inline h-3 w-3" />
        Error 404 — Page Not Found
      </p>
    </ErrorPageShell>
  );
}
