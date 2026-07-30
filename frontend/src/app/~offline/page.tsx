"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff, Send, Wifi } from "lucide-react";
import { ErrorPageShell, errorPrimaryButton } from "@/components/ui/ErrorPageShell";
import { GoldCoin } from "@/components/ui/GoldCoin";

const RING_COUNT = 3;

/**
 * Precached by the service worker (next.config.ts `fallbacks.document`) and
 * served whenever a page navigation fails with no network and no cached
 * match — e.g. a route the user never visited while online. Auto-detects
 * reconnection via the browser's online/offline events.
 */
export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!justReconnected) return;
    const t = setTimeout(() => router.replace("/dashboard"), 1600);
    return () => clearTimeout(t);
  }, [justReconnected, router]);

  const ringColor = isOnline ? "rgba(16,185,129,0.5)" : "rgba(168,85,247,0.5)";

  return (
    <ErrorPageShell>
      <div className="relative mx-auto mb-4 flex h-32 items-center justify-center sm:h-36">
        {Array.from({ length: RING_COUNT }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{ borderColor: ringColor, width: "2rem", height: "2rem" }}
            animate={{ scale: [1, 5.5], opacity: [0.7, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: i * 0.8 }}
          />
        ))}

        <motion.div
          className="absolute"
          style={{ marginLeft: "-2.5rem" }}
          animate={{ rotate: [-14, 14, -14], x: [-2, 2, -2] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Send className="h-5 w-5 -rotate-45 text-purple-300 drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]" />
        </motion.div>

        <div className="relative z-10">
          <GoldCoin size="3rem" spinDuration={isOnline ? 2.2 : 0} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {justReconnected ? (
          <motion.div key="online" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
              <Wifi className="h-4 w-4 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold text-white sm:text-xl">Reconnected!</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#94A3B8]">Taking you back to your dashboard…</p>
          </motion.div>
        ) : (
          <motion.div key="offline" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20">
              <WifiOff className="h-4 w-4 text-purple-300" />
            </div>
            <h1 className="text-lg font-bold text-white sm:text-xl">Signal Lost</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#94A3B8]">
              You&apos;re currently offline. This page hasn&apos;t been loaded before, so it isn&apos;t available
              offline. Pages you&apos;ve already visited — like your Dashboard — still work without a connection.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8">
        <button type="button" onClick={() => router.push("/dashboard")} className={errorPrimaryButton}>
          Go to Dashboard
        </button>
      </div>
    </ErrorPageShell>
  );
}
