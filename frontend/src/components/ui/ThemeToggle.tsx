"use client";

import { Moon, Sun } from "lucide-react";
import { useSettingsContext } from "@/lib/SettingsContext";
import { cn } from "@/lib/format";

/** Light/dark switch for public pages; uses the same setting the dashboard does, so the choice carries over after sign-in. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, updateSettings } = useSettingsContext();
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => updateSettings({ theme: dark ? "light" : "dark" })}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn("flex h-10 w-10 items-center justify-center rounded-full text-pp-text-dim transition-colors hover:bg-pp-chip-bg hover:text-pp-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent", className)}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" /> : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
    </button>
  );
}
