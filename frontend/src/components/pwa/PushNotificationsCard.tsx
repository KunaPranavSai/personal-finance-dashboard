"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { toUserMessage } from "@/lib/errorMessage";
import { getStorageMode } from "@/lib/storage";
import {
  disablePush,
  enablePush,
  readPushState,
  sendTestPush,
  supportMessage,
  updatePushCategories,
  type PushCategories,
  type PushState,
} from "@/lib/push";

const CATEGORIES: { key: keyof PushCategories; label: string; hint: string; driveOnly?: boolean }[] = [
  { key: "security", label: "Security alerts", hint: "New sign-ins, password and 2-step changes" },
  { key: "backup", label: "Google Drive alerts", hint: "When Penny Pilot loses access to your Drive" },
  { key: "bills", label: "Bill & EMI reminders", hint: "3 days before, 1 day before and on the due date", driveOnly: true },
];

/**
 * Real mobile/desktop push through the installed PWA. The permission prompt appears only when the user
 * taps "Turn on notifications". Bill reminders are scheduled by the server from the user's Google Drive
 * data, so they are unavailable in device-only mode (the server never sees that data).
 */
export function PushNotificationsCard() {
  const { toast } = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const deviceOnly = typeof window !== "undefined" && getStorageMode() === "local";

  const refresh = useCallback(async () => setState(await readPushState()), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (name: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      toast(err instanceof Error && !("status" in err) ? err.message : toUserMessage(err), "error");
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  if (!state) return <div className="h-20 animate-pulse rounded-pp bg-pp-surface-2" aria-hidden="true" />;

  const blocked = !state.support.ok ? supportMessage[state.support.reason] : state.permission === "denied" ? "Notifications are blocked for this site. Allow them in your browser or phone settings, then reload this page." : null;

  return (
    <div className="rounded-pp border border-pp-border bg-pp-surface p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pp-accent/10">
          {state.subscribed ? <Bell className="h-4 w-4 text-pp-accent" aria-hidden="true" /> : <BellOff className="h-4 w-4 text-pp-text-dim" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-pp-text">Push notifications</p>
          <p className="mt-0.5 text-xs text-pp-text-dim">
            {blocked ?? (state.subscribed ? "On for this device. Alerts arrive even when Penny Pilot is closed." : "Get alerts on this device, even when Penny Pilot is closed.")}
          </p>
        </div>
        {!blocked && !state.subscribed && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("enable", () => enablePush(Object.fromEntries(CATEGORIES.map((c) => [c.key, true])) as PushCategories))}
            className="min-h-[40px] shrink-0 rounded-full bg-pp-accent px-4 text-xs font-semibold text-pp-accent-ink hover:brightness-110 disabled:opacity-60"
          >
            {busy === "enable" ? "Turning on…" : "Turn on"}
          </button>
        )}
      </div>

      {state.subscribed && (
        <div className="mt-4 space-y-3 border-t border-pp-border pt-4">
          {CATEGORIES.map((c) => {
            const unavailable = c.driveOnly && deviceOnly;
            const on = unavailable ? false : state.categories[c.key] !== false;
            return (
              <label key={c.key} className={`flex items-start justify-between gap-3 ${unavailable ? "opacity-60" : "cursor-pointer"}`}>
                <span className="min-w-0">
                  <span className="block text-sm text-pp-text">{c.label}</span>
                  <span className="block text-xs text-pp-text-dim">{unavailable ? "Needs Google Drive storage. Device-only data is never sent to our server." : c.hint}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={on}
                  disabled={unavailable || busy !== null}
                  onChange={(e) => run(`cat-${c.key}`, async () => void (await updatePushCategories({ [c.key]: e.target.checked })))}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-pp-border accent-[var(--pp-accent)]"
                />
              </label>
            );
          })}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run("test", async () => {
                  const r = await sendTestPush();
                  toast(r.accepted > 0 ? "Test sent. It should appear on this device in a moment." : "The push service didn't accept the test. Try turning notifications off and on again.", r.accepted > 0 ? "success" : "error");
                })
              }
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-pp-border px-4 text-xs font-semibold text-pp-text hover:bg-pp-chip-bg disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" /> {busy === "test" ? "Sending…" : "Send a test"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("disable", disablePush)}
              className="min-h-[40px] rounded-full px-4 text-xs font-semibold text-pp-critical hover:bg-pp-critical/10 disabled:opacity-60"
            >
              {busy === "disable" ? "Turning off…" : "Turn off"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
