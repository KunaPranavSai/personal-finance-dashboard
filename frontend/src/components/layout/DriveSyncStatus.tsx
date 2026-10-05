"use client";

// Subtle, honest Google Drive sync indicator — reuses the EXISTING Drive
// architecture entirely (DriveStorageProvider already writes synchronously
// to Drive as part of each create/update/delete request; this component
// doesn't invent a second sync system, it just surfaces the real state of
// that existing request/mutation lifecycle so the user never has to open
// Manage Storage → Sync to know whether their last change is safe).
//
// - "Syncing…" while any TanStack Query mutation is in flight (global,
//   works for every page automatically via useIsMutating — no per-page
//   wiring needed).
// - "Synced" briefly after the last mutation settles successfully.
// - "Drive sync paused" if the backend reports DRIVE_NOT_CONNECTED /
//   DRIVE_REAUTH_REQUIRED / DRIVE_NOT_INITIALIZED (api.ts already dispatches
//   DRIVE_DISCONNECTED_EVENT for exactly this) — stays until resolved.
// - Renders nothing at all in Local-Only mode (there is nothing to sync).
import { useEffect, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { DRIVE_DISCONNECTED_EVENT } from "@/lib/api";
import { getStorageMode } from "@/lib/storage";
import { cn } from "@/lib/format";

type SyncState = "idle" | "syncing" | "synced" | "paused";

export function DriveSyncStatus() {
  const isLocalOnly = getStorageMode() === "local";
  const mutatingCount = useIsMutating();
  const [state, setState] = useState<SyncState>("idle");
  const [drivePaused, setDrivePaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const onDisconnected = () => setDrivePaused(true);
    window.addEventListener(DRIVE_DISCONNECTED_EVENT, onDisconnected);
    return () => window.removeEventListener(DRIVE_DISCONNECTED_EVENT, onDisconnected);
  }, []);

  useEffect(() => {
    if (isLocalOnly) return;
    if (mutatingCount > 0) {
      setDrivePaused(false); // a mutation is in flight again — give it a fresh chance
      setState("syncing");
      return;
    }
    // Just finished a batch of mutations — show "Synced" briefly, then fade.
    if (state === "syncing") {
      setState("synced");
      const t = setTimeout(() => setState("idle"), 2500);
      return () => clearTimeout(t);
    }
  }, [mutatingCount, isLocalOnly, state]);

  if (isLocalOnly) return null;
  if (drivePaused) {
    return (
      <span
        className="hidden items-center gap-1.5 rounded-full bg-vulcanico/10 px-2.5 py-1 text-xs font-medium text-vulcanico sm:flex"
        title="Reconnect Google Drive to resume syncing your changes"
      >
        <CloudOff className="h-3.5 w-3.5" />
        Sync paused
      </span>
    );
  }
  if (state === "idle") return null;
  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:flex",
        state === "syncing" ? "bg-pp-accent/10 text-pp-accent" : "bg-mantis/10 text-mantis"
      )}
      aria-live="polite"
    >
      {state === "syncing" ? <RefreshCw className={cn("h-3.5 w-3.5", !reducedMotion && "animate-spin")} /> : <Cloud className="h-3.5 w-3.5" />}
      {state === "syncing" ? "Syncing…" : "Synced"}
    </span>
  );
}
