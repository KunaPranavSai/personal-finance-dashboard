"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { installSupport, subscribeToInstallAvailability, triggerInstallPrompt, type InstallSupport } from "@/lib/pwaInstall";

/**
 * Settings entry for installing the app. Always rendered (it's the permanent counterpart of the
 * sign-in prompt) but only offers what the browser can actually do right now:
 * installed / one-tap install / iOS Share steps / "use a supported browser".
 */
export function InstallAppCard({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<InstallSupport | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setState(installSupport());
    read();
    return subscribeToInstallAvailability(read);
  }, []);

  const install = async () => {
    setBusy(true);
    setNote(null);
    const out = await triggerInstallPrompt();
    setBusy(false);
    if (out === "dismissed") setNote("Install cancelled. You can try again any time.");
    if (out === "unavailable") setNote("Your browser hasn't offered installation yet. Reload the page and try again.");
  };

  if (!state) return null;
  const Icon = state === "ios" ? Share : state === "installed" ? Smartphone : Download;
  const text = {
    installed: "Penny Pilot is installed on this device.",
    prompt: "Add Penny Pilot to your home screen for app-like access and push notifications.",
    ios: "On iPhone and iPad: tap the Share button in Safari, then “Add to Home Screen”. Push notifications only work from the installed app.",
    unsupported: "This browser can't install apps. Open Penny Pilot in Chrome, Edge or Safari to install it.",
  }[state];

  return (
    <div className={compact ? "" : "rounded-pp border border-pp-border bg-pp-surface p-4"}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pp-accent/10">
          <Icon className="h-4 w-4 text-pp-accent" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-pp-text">Install app</p>
          <p className="mt-0.5 text-xs text-pp-text-dim">{text}</p>
          {note && <p role="status" className="mt-1 text-xs text-pp-text-dim">{note}</p>}
        </div>
        {state === "prompt" && (
          <button type="button" onClick={install} disabled={busy} className="min-h-[40px] shrink-0 rounded-full bg-pp-accent px-4 text-xs font-semibold text-pp-accent-ink hover:brightness-110 disabled:opacity-60">
            {busy ? "Opening…" : "Install"}
          </button>
        )}
      </div>
    </div>
  );
}
