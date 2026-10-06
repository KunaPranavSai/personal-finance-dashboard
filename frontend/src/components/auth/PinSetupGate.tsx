"use client";

import { pinProblem } from "@/lib/zodHelpers";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { markLoggedInToday } from "@/lib/pinDay";
import { usePinStatus } from "@/components/auth/pin";

const PIN_LENGTH = 4;
const digitsOnly = (v: string) => v.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH);

/**
 * Administrator accounts must have a PIN before they can use the console. Ordinary users are NOT forced: they see a
 * small reminder on each new sign-in session until they set one (they can dismiss it and set it later in Security).
 * The original note follows. Everyone signs in with a PIN: an account without one cannot use the app until it creates one. A session that was
 * just opened does not retype its password; an older one is asked for it (the server decides). Explorers who have not
 * finished sign-up are skipped, because the sign-up sheet asks for the PIN as its last step.
 */
export function PinSetupGate() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const signedUp = Boolean(user) && (user!.role !== "USER" || (user!.emailVerified !== false && user!.profileCompleted !== false));
  const { data } = usePinStatus(signedUp);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const forced = user?.role !== "USER";
  const [openForm, setOpenForm] = useState(false);
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem("pp_pin_reminder") === "1"; } catch { return false; } });
  const dismiss = () => { setDismissed(true); setOpenForm(false); try { sessionStorage.setItem("pp_pin_reminder", "1"); } catch { /* shows again next load */ } };

  if (!signedUp || !data || data.enabled) return null;
  if (!forced && !openForm) {
    if (dismissed) return null;
    return (
      <div role="status" className="fixed inset-x-0 top-0 z-[120] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-pp-border bg-pp-bg/95 p-3 text-pp-text shadow-2xl backdrop-blur">
          <KeyRound size={20} className="shrink-0 text-pp-accent" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm"><strong>Set a sign-in PIN</strong><span className="block text-xs text-pp-text-dim">Sign in faster and more securely next time.</span></p>
          <button type="button" onClick={() => setOpenForm(true)} className="min-h-[40px] shrink-0 rounded-xl bg-pp-accent px-3 text-sm font-semibold text-pp-accent-ink">Set PIN</button>
          <button type="button" onClick={dismiss} aria-label="Remind me later" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-pp-text-dim hover:bg-pp-chip-bg"><X size={16} aria-hidden="true" /></button>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pin.length !== PIN_LENGTH) return setError(`Enter a ${PIN_LENGTH}-digit PIN.`);
    const weak = pinProblem(pin);
    if (weak) return setError(weak);
    if (pin !== again) return setError("The two PINs don't match. Re-enter the same PIN in both boxes.");
    if (needPassword && !password) return setError("Enter your account password to confirm it's you.");
    setBusy(true);
    try {
      await api.post("/api/auth/pin", { pin, password: needPassword ? password : undefined });
      if (user) markLoggedInToday(user.uid);
      await qc.invalidateQueries({ queryKey: ["pin-status"] });
    } catch (err) {
      const code = (err as { details?: { code?: string } }).details?.code;
      if (code === "PASSWORD_REQUIRED") setNeedPassword(true);
      setError((err as Error).message || "Could not set your PIN");
    } finally {
      setBusy(false);
    }
  };

  const base = "w-full rounded-xl border border-pp-border bg-pp-surface-2 px-4 py-3 text-pp-text placeholder:text-pp-text-dim/70 outline-none focus:border-pp-accent";
  const pinField = `${base} text-center text-lg tracking-[0.4em] placeholder:text-sm placeholder:tracking-normal`;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-pp-bg p-4" role="dialog" aria-modal="true" aria-label="Create your PIN">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-pp-border bg-pp-surface-2 p-5 backdrop-blur" noValidate>
        <div>
          <h2 className="text-lg font-bold text-pp-text">Create your PIN</h2>
          <p className="mt-1 text-sm text-pp-text-dim">You will use this {PIN_LENGTH}-digit PIN to sign in quickly. Avoid repeats like 1111 or runs like 1234.</p>
        </div>
        <PasswordInput aria-label="New PIN" inputMode="numeric" autoComplete="off" className={pinField} placeholder="PIN required" value={pin} onChange={(e) => setPin(digitsOnly(e.target.value))} />
        <PasswordInput aria-label="Confirm PIN" inputMode="numeric" autoComplete="off" className={pinField} placeholder="Confirm PIN required" value={again} onChange={(e) => setAgain(digitsOnly(e.target.value))} />
        {needPassword && (
          <PasswordInput aria-label="Account password" autoComplete="current-password" className={`${base} text-sm`} placeholder="Password required" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        {error && <p role="alert" className="text-sm text-pp-critical">{error}</p>}
        <button type="submit" disabled={busy || pin.length !== PIN_LENGTH || again.length !== PIN_LENGTH} className="min-h-[48px] w-full rounded-xl bg-pp-accent px-4 text-sm font-semibold text-pp-accent-ink hover:opacity-90 disabled:opacity-50">
          {busy ? "Saving…" : "Save PIN"}
        </button>
        {forced
          ? <button type="button" onClick={() => void logout().then(() => { window.location.href = "/login"; })} className="min-h-[44px] w-full text-sm text-pp-text-dim hover:text-pp-text">Sign out</button>
          : <button type="button" onClick={dismiss} className="min-h-[44px] w-full text-sm text-pp-text-dim hover:text-pp-text">Not now</button>}
      </form>
    </div>
  );
}
