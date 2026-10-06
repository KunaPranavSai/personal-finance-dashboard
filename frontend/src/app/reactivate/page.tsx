"use client";

import { PasswordInput } from "@/components/ui/PasswordInput";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";

const input = "w-full rounded-lg border border-pp-border bg-transparent px-3 py-3 text-sm text-pp-text outline-none focus:border-pp-accent";
const btn = "flex min-h-[48px] w-full items-center justify-center rounded-xl bg-pp-accent px-4 text-sm font-semibold text-pp-accent-ink disabled:opacity-50";

/**
 * Reactivate an account that is inside its 30-day deletion period. Needs fresh authentication: the registered email,
 * the account password (a PIN or remembered device is not enough) and the registered phone number, confirmed by a code
 * emailed to the account's address. Nothing is stored in the browser.
 */
function Reactivate() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [tfa, setTfa] = useState<{ token: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof ApiClientError || e instanceof Error ? e.message : "That didn't work. Please try again."); } finally { setBusy(false); }
  };
  const finish = () => { window.location.href = "/dashboard"; };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-5 py-10">
      <div>
        <h1 className="text-2xl font-extrabold text-pp-text">Reactivate your account</h1>
        <p className="mt-1 text-sm text-pp-text-dim">If you scheduled your account for deletion less than 30 days ago, you can cancel it here. Your data is still there.</p>
      </div>

      {tfa ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.post("/api/auth/2fa/login-verify", { challengeToken: tfa.token, code: tfa.code }); finish(); }); }}>
          <label className="block text-sm font-medium text-pp-text" htmlFor="r-2fa">Two-factor code</label>
          <input id="r-2fa" className={input} inputMode="numeric" autoComplete="one-time-code" autoFocus value={tfa.code} onChange={(e) => setTfa({ ...tfa, code: e.target.value })} />
          <button className={btn} disabled={busy || !tfa.code.trim()}>Finish reactivating</button>
        </form>
      ) : !challenge ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => { const r = await api.post<{ challenge: string }>("/api/account/reactivate/start", { email, password, phone }); setChallenge(r.challenge); }); }}>
          <div><label className="mb-1 block text-sm font-medium text-pp-text" htmlFor="r-email">Registered email</label><input id="r-email" type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium text-pp-text" htmlFor="r-pw">Account password</label><PasswordInput id="r-pw" autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium text-pp-text" htmlFor="r-phone">Registered phone number</label><input id="r-phone" inputMode="tel" autoComplete="tel" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <p className="text-xs text-pp-text-dim">We then email a 6-digit code to your registered email address to confirm it is you.</p>
          <button className={btn} disabled={busy || !email || !password || phone.replace(/\D/g, "").length < 6}>Send confirmation code</button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          const r = await api.post<{ requires2FA?: boolean; challengeToken?: string }>("/api/account/reactivate/verify", { challenge, code });
          if (r.requires2FA && r.challengeToken) setTfa({ token: r.challengeToken, code: "" }); else finish();
        }); }}>
          <label className="block text-sm font-medium text-pp-text" htmlFor="r-code">Confirmation code from your email</label>
          <input id="r-code" className={input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className={btn} disabled={busy || code.length !== 6}>Reactivate account</button>
        </form>
      )}

      {err && <p role="alert" className="text-sm font-medium text-red-600">{err}</p>}
      <Link href="/login" className="text-center text-sm text-pp-text-dim underline">Back to sign in</Link>
    </main>
  );
}

export default function ReactivatePage() {
  return <Suspense fallback={null}><Reactivate /></Suspense>;
}
