"use client";

import { PasswordInput } from "@/components/ui/PasswordInput";
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { AnimatedCodeVerification } from "@/components/ui/AnimatedCodeVerification";
import { isRememberSession, markLoggedInToday, pinToday, readPinDay } from "@/lib/pinDay";

const PIN_LENGTH = 4;

export function usePinStatus(enabledFlag = true) {
  return useQuery({
    queryKey: ["pin-status"],
    queryFn: () => api.get<{ enabled: boolean }>("/api/auth/pin"),
    enabled: enabledFlag,
    staleTime: 60000,
  });
}

/** Remembered sessions skip the daily sign-in; the PIN is asked once per local day instead. */
export function PinGate({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { data, isLoading } = usePinStatus();
  const [unlockedDay, setUnlockedDay] = useState(() => readPinDay(userId));
  const needsPin = isRememberSession() && Boolean(data?.enabled) && unlockedDay !== pinToday();

  if (isRememberSession() && isLoading) return null;
  if (!needsPin) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-pp-surface p-4">
      <AnimatedCodeVerification
        length={PIN_LENGTH}
        title="Enter your PIN"
        subtitle="Daily check — you'll only be asked once today"
        tip="Forgot it? Sign out and back in with your password"
        successTitle="Welcome back!"
        successSubtitle="Unlocking your dashboard…"
        onVerify={async (pin) => { await api.post("/api/auth/pin/verify", { pin }); }}
        onSuccess={() => { markLoggedInToday(userId); setUnlockedDay(pinToday()); }}
      />
    </div>
  );
}

/** Set / remove the daily PIN. `variant` only swaps the class set so mobile and desktop share one implementation. */
export function PinSettings({ variant, userId }: { variant: "mobile" | "desktop"; userId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = usePinStatus();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const enabled = Boolean(data?.enabled);
  const m = variant === "mobile";

  const done = useCallback(() => { setOpen(false); setPin(""); setPassword(""); qc.invalidateQueries({ queryKey: ["pin-status"] }); }, [qc]);

  const save = async () => {
    if (pin.length !== PIN_LENGTH) return toast(`PIN must be ${PIN_LENGTH} digits`, "error");
    setBusy(true);
    try {
      await api.post("/api/auth/pin", { pin, password });
      markLoggedInToday(userId);
      toast("Sign-in PIN enabled", "success");
      done();
    } catch (e) { toast((e as Error).message || "Couldn't set PIN", "error"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await api.delete("/api/auth/pin"); toast("Sign-in PIN removed", "success"); done(); }
    catch (e) { toast((e as Error).message || "Couldn't remove PIN", "error"); }
    finally { setBusy(false); }
  };

  const field = m ? "ppm-field" : "space-y-1";
  return (
    <div className={m ? "ppm-list-item" : "py-3"} style={m ? { cursor: "default", flexWrap: "wrap" } : undefined}>
      <div className="flex w-full items-center justify-between gap-3">
        <div className={m ? "ppm-info" : ""}>
          <p className={m ? "ppm-name" : "text-sm font-medium text-pp-text"}>Sign-in PIN</p>
          <p className={m ? "ppm-meta" : "text-xs text-pp-text-dim"}>{enabled ? "On — sign in with your PIN, once a day" : "Sign in faster, once a day"}</p>
        </div>
        {enabled ? (
          <button type="button" className={m ? "ppm-link-btn" : "text-sm font-medium text-pp-accent"} disabled={busy} onClick={remove}>Remove</button>
        ) : (
          <button type="button" className={m ? "ppm-link-btn" : "text-sm font-medium text-pp-accent"} onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "Enable"}</button>
        )}
      </div>
      {open && !enabled && (
        <div className="mt-3 w-full">
          <div className={field}>
            <label htmlFor="pin-new" className={m ? undefined : "text-xs text-pp-text-dim"}>New {PIN_LENGTH}-digit PIN</label>
            <PasswordInput id="pin-new" inputMode="numeric" autoComplete="off" maxLength={PIN_LENGTH} value={pin} placeholder="PIN required"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className={m ? undefined : "w-full rounded-lg border border-pp-border bg-pp-surface px-3 py-2 text-sm"} />
          </div>
          <div className={field}>
            <label htmlFor="pin-pw" className={m ? undefined : "text-xs text-pp-text-dim"}>Account password</label>
            <PasswordInput id="pin-pw" autoComplete="current-password" value={password} placeholder="Password required"
              onChange={(e) => setPassword(e.target.value)} className={m ? undefined : "w-full rounded-lg border border-pp-border bg-pp-surface px-3 py-2 text-sm"} />
          </div>
          <button type="button" disabled={busy || !pin || !password} onClick={save}
            className={m ? "ppm-sheet-submit" : "rounded-lg bg-pp-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"}>
            {busy ? "Saving…" : "Save PIN"}
          </button>
        </div>
      )}
    </div>
  );
}
