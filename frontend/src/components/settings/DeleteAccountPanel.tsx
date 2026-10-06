"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";

/**
 * Delete account (30-day scheduled deletion). Four independent server-side checks (PIN, password, two-factor, phone)
 * each return a short-lived signed proof; only when all four exist does the slider unlock. After the slide, a
 * server-generated puzzle must be solved before the server accepts the request. Nothing secret is kept in browser
 * storage: proofs live only in this component's memory.
 */
type Proofs = { pin?: string; password?: string; twofa?: string; phone?: string };
interface Status { required: { pin: boolean; password: boolean; twofa: boolean; phone: boolean }; hasPhone: boolean; days: number }

const input = "w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm text-pp-text outline-none focus:border-pp-accent";
const btn = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-pp-accent px-4 text-sm font-semibold text-pp-accent-ink disabled:opacity-50";
const msg = (e: unknown, fallback: string) => (e instanceof ApiClientError || e instanceof Error ? e.message : fallback);

function Step({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-pp-border p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-pp-text">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${done ? "bg-emerald-500 text-white" : "border border-pp-border text-pp-text-dim"}`} aria-hidden="true">{done ? <Check size={12} /> : null}</span>
        {title}{done && <span className="sr-only"> verified</span>}
        {done && <span className="ml-auto text-xs font-medium text-emerald-600" aria-hidden="true">Verified</span>}
      </div>
      {!done && <div className="mt-3 space-y-2">{children}</div>}
    </li>
  );
}

function SlideToConfirm({ label, onComplete, disabled }: { label: string; onComplete: () => void; disabled?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const HANDLE = 52;
  const max = () => Math.max(1, (track.current?.clientWidth ?? 280) - HANDLE - 8);
  const finish = useCallback((at: number) => { if (at >= max() * 0.92) { setX(max()); onComplete(); setTimeout(() => setX(0), 400); } else setX(0); }, [onComplete]);
  const move = (clientX: number) => { const r = track.current?.getBoundingClientRect(); if (r) setX(Math.min(max(), Math.max(0, clientX - r.left - HANDLE / 2))); };
  return (
    <div ref={track} className={`relative h-[60px] select-none overflow-hidden rounded-full border border-red-500/40 bg-red-500/10 ${disabled ? "opacity-40" : ""}`} aria-disabled={disabled}>
      <div className="absolute inset-0 flex items-center justify-center pl-12 text-sm font-semibold text-red-600">{label}</div>
      <button
        type="button" disabled={disabled} aria-label={`${label}. Drag to the right, or press the right arrow key to slide.`}
        className="absolute left-1 top-1 flex touch-none items-center justify-center rounded-full bg-red-600 text-white shadow disabled:cursor-not-allowed"
        style={{ width: HANDLE, height: HANDLE, transform: `translateX(${x}px)`, transition: drag ? "none" : "transform .25s ease" }}
        onPointerDown={(e) => { if (disabled) return; (e.target as HTMLElement).setPointerCapture(e.pointerId); setDrag(true); }}
        onPointerMove={(e) => { if (drag) move(e.clientX); }}
        onPointerUp={() => { setDrag(false); finish(x); }}
        onPointerCancel={() => { setDrag(false); setX(0); }}
        onKeyDown={(e) => { if (disabled) return; if (e.key === "ArrowRight") { const n = Math.min(max(), x + max() / 5); setX(n); if (n >= max() * 0.92) finish(n); } if (e.key === "ArrowLeft") setX(Math.max(0, x - max() / 5)); }}
      >
        <ChevronRight size={22} aria-hidden="true" />
      </button>
    </div>
  );
}

export function DeleteAccountPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [proofs, setProofs] = useState<Proofs>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState(""); const [password, setPassword] = useState(""); const [code, setCode] = useState("");
  const [phone, setPhone] = useState(""); const [phoneCode, setPhoneCode] = useState(""); const [challenge, setChallenge] = useState<{ token: string; sentTo: string } | null>(null);
  const [puzzle, setPuzzle] = useState<{ prompt: string; token: string } | null>(null); const [answer, setAnswer] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { api.get<Status>("/api/account/deletion/status").then(setStatus).catch(() => setStatus(null)); }, []);

  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(msg(e, "That didn't work. Please try again.")); } finally { setBusy(false); } };
  // Only the checks this account actually has are asked for (the server decides which).
  const req = status?.required;
  const all = Boolean(req) && (!req!.pin || proofs.pin) && (!req!.password || proofs.password) && (!req!.twofa || proofs.twofa) && (!req!.phone || proofs.phone);

  if (done) {
    return (
      <section className="rounded-xl border border-red-500/40 p-4" role="status">
        <h3 className="text-base font-bold text-pp-text">Account deletion scheduled</h3>
        <p className="mt-1 text-sm text-pp-text-dim">Your account is scheduled for permanent deletion on {new Date(done).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} (in 30 days).</p>
        <p className="mt-1 text-sm text-pp-text-dim">You can reactivate your account before the deletion date from the sign-in page. You have been signed out.</p>
        <a href="/login" className={`${btn} mt-3`}>Go to sign in</a>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-red-500/30 p-4" aria-labelledby="del-title">
      <h3 id="del-title" className="flex items-center gap-2 text-base font-bold text-pp-text"><Trash2 size={18} aria-hidden="true" className="text-red-600" /> Delete your account</h3>
      <p className="mt-1 text-sm text-pp-text-dim">This starts a 30-day account deletion period. Your data is kept for 30 days so you can reactivate; after that it is permanently deleted. Files in your own Google Drive are not touched.</p>
      {!status ? <Loader2 className="mt-3 h-4 w-4 animate-spin" aria-label="Loading" /> : (
        <ol className="mt-3 space-y-2 p-0" style={{ listStyle: "none" }}>
          {status.required.pin && <Step done={Boolean(proofs.pin)} title="PIN">
            {<>
              <input className={input} inputMode="numeric" type="password" maxLength={4} autoComplete="off" placeholder="4-digit PIN" aria-label="PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
              <button type="button" className={btn} disabled={busy || pin.length !== 4} onClick={() => run(async () => { const r = await api.post<{ proof: string }>("/api/account/deletion/pin", { pin }); setProofs((p) => ({ ...p, pin: r.proof })); setPin(""); })}>Verify PIN</button>
            </>}
          </Step>}
          {status.required.password && <Step done={Boolean(proofs.password)} title="Password">
            <input className={input} type="password" autoComplete="current-password" placeholder="Current password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className={btn} disabled={busy || !password} onClick={() => run(async () => { const r = await api.post<{ proof: string }>("/api/account/deletion/password", { password }); setProofs((p) => ({ ...p, password: r.proof })); setPassword(""); })}>Verify password</button>
          </Step>}
          {status.required.twofa && <Step done={Boolean(proofs.twofa)} title="Two-factor authentication">
            {<>
              <input className={input} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code or backup code" aria-label="Two-factor code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button type="button" className={btn} disabled={busy || !code.trim()} onClick={() => run(async () => { const r = await api.post<{ proof: string }>("/api/account/deletion/2fa", { code: code.trim() }); setProofs((p) => ({ ...p, twofa: r.proof })); setCode(""); })}>Verify code</button>
            </>}
          </Step>}
          {status.required.phone && <Step done={Boolean(proofs.phone)} title={status.hasPhone ? "Phone number" : "Email confirmation"}>
            {!challenge ? <>
              {status.hasPhone && <input className={input} inputMode="tel" autoComplete="tel" placeholder="Your registered phone number" aria-label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />}
              <p className="text-xs text-pp-text-dim">{status.hasPhone ? "We confirm it matches your account, then email a code to your registered email address." : "We will email a code to your registered email address to confirm it is you."}</p>
              <button type="button" className={btn} disabled={busy || (status.hasPhone && phone.replace(/\D/g, "").length < 6)} onClick={() => run(async () => { const r = await api.post<{ challenge: string; sentTo: string }>("/api/account/deletion/phone/send", { phone }); setChallenge({ token: r.challenge, sentTo: r.sentTo }); })}>Send code</button>
            </> : <>
              <p className="text-xs text-pp-text-dim">Enter the 6-digit code we sent to {challenge.sentTo}.</p>
              <input className={input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" aria-label="Phone confirmation code" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))} />
              <button type="button" className={btn} disabled={busy || phoneCode.length !== 6} onClick={() => run(async () => { const r = await api.post<{ proof: string }>("/api/account/deletion/phone/verify", { challenge: challenge.token, code: phoneCode }); setProofs((p) => ({ ...p, phone: r.proof })); setPhoneCode(""); })}>Verify {status.hasPhone ? "phone number" : "code"}</button>
            </>}
          </Step>}
        </ol>
      )}
      {err && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{err}</p>}

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-pp-text-dim"><ShieldAlert size={14} aria-hidden="true" /> {all ? "All checks are complete." : "Complete the checks above to unlock the slider."}</p>
        <SlideToConfirm label="Slide to schedule account deletion" disabled={!all || busy}
          onComplete={() => run(async () => { const r = await api.post<{ prompt: string; puzzleToken: string }>("/api/account/deletion/puzzle", { proofs }); setPuzzle({ prompt: r.prompt, token: r.puzzleToken }); setAnswer(""); })} />
      </div>

      {puzzle && (
        <div role="dialog" aria-modal="true" aria-labelledby="del-puzzle" className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-pp-surface p-5 shadow-xl">
            <h4 id="del-puzzle" className="text-base font-bold text-pp-text">One last check</h4>
            <p className="mt-2 text-sm text-pp-text-dim">{puzzle.prompt}</p>
            <input className={`${input} mt-3`} inputMode="numeric" autoFocus placeholder="Your answer" aria-label="Puzzle answer" value={answer} onChange={(e) => setAnswer(e.target.value.replace(/[^\d-]/g, ""))} />
            {err && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{err}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" className="min-h-[44px] flex-1 rounded-lg border border-pp-border text-sm font-medium text-pp-text" onClick={() => { setPuzzle(null); setErr(null); }} disabled={busy}>Cancel</button>
              <button type="button" className="min-h-[44px] flex-1 rounded-lg bg-red-600 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !answer}
                onClick={() => run(async () => { const r = await api.post<{ scheduledDeletionAt: string }>("/api/account/deletion/schedule", { proofs, puzzleToken: puzzle.token, answer }); setPuzzle(null); setProofs({}); setDone(r.scheduledDeletionAt); })}>
                Schedule deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
