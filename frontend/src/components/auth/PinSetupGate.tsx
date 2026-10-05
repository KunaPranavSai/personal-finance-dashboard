"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { markLoggedInToday } from "@/lib/pinDay";
import { usePinStatus } from "@/components/auth/pin";

const PIN_LENGTH = 4;
const digitsOnly = (v: string) => v.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH);

/**
 * Everyone signs in with a PIN: an account without one cannot use the app until it creates one. A session that was
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

  if (!signedUp || !data || data.enabled) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pin.length !== PIN_LENGTH) return setError(`Enter a ${PIN_LENGTH}-digit PIN.`);
    if (pin !== again) return setError("The two PINs do not match.");
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

  const base = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-tiffany/60";
  const pinField = `${base} text-center text-lg tracking-[0.4em] placeholder:text-sm placeholder:tracking-normal`;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-noturno p-4" role="dialog" aria-modal="true" aria-label="Create your PIN">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur" noValidate>
        <div>
          <h2 className="text-lg font-bold text-white">Create your PIN</h2>
          <p className="mt-1 text-sm text-white/60">You will use this {PIN_LENGTH}-digit PIN to sign in quickly. Avoid repeats like 1111 or runs like 1234.</p>
        </div>
        <input aria-label="New PIN" type="password" inputMode="numeric" autoComplete="off" className={pinField} placeholder="PIN required" value={pin} onChange={(e) => setPin(digitsOnly(e.target.value))} />
        <input aria-label="Confirm PIN" type="password" inputMode="numeric" autoComplete="off" className={pinField} placeholder="Confirm PIN required" value={again} onChange={(e) => setAgain(digitsOnly(e.target.value))} />
        {needPassword && (
          <input aria-label="Account password" type="password" autoComplete="current-password" className={`${base} text-sm`} placeholder="Password required" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={busy || pin.length !== PIN_LENGTH || again.length !== PIN_LENGTH} className="min-h-[48px] w-full rounded-xl bg-tiffany px-4 text-sm font-semibold text-noturno hover:opacity-90 disabled:opacity-50">
          {busy ? "Saving…" : "Save PIN"}
        </button>
        <button type="button" onClick={() => void logout().then(() => { window.location.href = "/login"; })} className="min-h-[44px] w-full text-sm text-white/50 hover:text-white/80">Sign out</button>
      </form>
    </div>
  );
}
