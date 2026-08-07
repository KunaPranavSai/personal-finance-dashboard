"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, LogOut } from "lucide-react";
import { ErrorPageShell, errorPrimaryButton, errorGhostButton } from "@/components/ui/ErrorPageShell";
import { useAuth } from "@/lib/AuthContext";

export default function AccessDeniedPage() {
  const { logout } = useAuth();
  const [shake, setShake] = useState(0);

  const handleSwitchAccount = async () => {
    await logout();
    // Hard navigation — see Topbar's handleLogout for why router.replace
    // isn't enough for a real logout.
    window.location.href = "/login";
  };

  return (
    <ErrorPageShell>
      <div onClick={() => setShake((s) => s + 1)} className="cursor-pointer">
        <motion.div
          key={shake}
          animate={shake ? { x: [0, -8, 8, -6, 6, -2, 2, 0] } : undefined}
          transition={{ duration: 0.45 }}
          className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl border border-amber-400/20 bg-white/5 sm:h-28 sm:w-28"
        >
          <motion.div
            className="absolute inset-0 rounded-3xl bg-red-500/20 blur-xl"
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <Lock className="relative h-10 w-10 text-amber-300 sm:h-12 sm:w-12" />
        </motion.div>
      </div>

      <h1 className="bg-gradient-to-b from-amber-200 to-red-400 bg-clip-text text-5xl font-extrabold text-transparent sm:text-6xl">
        403
      </h1>
      <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">Restricted Airspace</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[#94A3B8]">
        You don&apos;t have permission to access this vault.
      </p>
      <p className="mt-1 text-xs text-white/25">(Tap the lock)</p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/dashboard" className={errorPrimaryButton}>
          Return to Dashboard
        </Link>
        <button type="button" onClick={handleSwitchAccount} className={errorGhostButton}>
          <LogOut className="h-4 w-4" />
          Switch Account
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-white/30">Error 403 — Access Denied</p>
    </ErrorPageShell>
  );
}
