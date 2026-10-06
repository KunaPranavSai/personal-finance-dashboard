"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, MousePointerClick, X, type LucideIcon } from "lucide-react";

export interface TourAction { label: string; href?: string; restart?: boolean }
export interface TourStep {
  title: string;
  body: string;
  icon?: LucideIcon;
  bullets?: string[];
  /** CSS selectors for the element to spotlight; the first one that is visible wins. No match: a centred card is shown. */
  target?: string[];
  /** Page to open for this step (the tour keeps running across pages). */
  route?: string;
  /** The user must click the highlighted element; the tour continues by itself when they do. */
  interactive?: boolean;
  /** Buttons for the final step (replace the normal Finish button). */
  actions?: TourAction[];
}

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;
const CARD_W = 340;

function findVisible(selectors: string[] | undefined): HTMLElement | null {
  for (const sel of selectors ?? []) {
    let list: NodeListOf<HTMLElement>;
    try { list = document.querySelectorAll<HTMLElement>(sel); } catch { continue; }
    for (const el of Array.from(list)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
    }
  }
  return null;
}

/**
 * Guided tour engine: spotlight + tooltip + progress, Next/Back/Skip, automatic page navigation, interactive
 * "click the highlighted button" steps, and a centred-card fallback so a missing element can never leave the tour stuck.
 * It only draws overlays; it never changes the data on a page. Used for both the public Welcome tour (no user data)
 * and the signed-in Onboarding tour.
 */
export function Tour({ steps, open, onClose, onRestart }: { steps: TourStep[]; open: boolean; onClose: (reason: "done" | "skipped") => void; onRestart?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) setI(0); }, [open]);

  const next = useCallback(() => { if (i >= steps.length - 1) onClose("done"); else setI((n) => n + 1); }, [i, steps.length, onClose]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  // Open the page a step belongs to.
  useEffect(() => {
    if (!open || !step?.route) return;
    if (pathname !== step.route.split("?")[0]) router.push(step.route);
  }, [open, step, pathname, router]);

  // Find, scroll to and follow the target (it may appear late, move, or never exist).
  useEffect(() => {
    if (!open) return;
    setRect(null); setMissing(false);
    if (!step?.target) return;
    const started = Date.now();
    let scrolled = false;
    let cleanup: (() => void) | null = null;
    const tick = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      const el = findVisible(step.target);
      if (!el) { if (Date.now() - started > 3000) setMissing(true); setRect(null); return; }
      setMissing(false);
      if (!scrolled) { scrolled = true; el.scrollIntoView({ block: "center", behavior: "smooth" }); }
      const r = el.getBoundingClientRect();
      setRect((p) => (p && Math.abs(p.top - r.top) < 0.5 && Math.abs(p.left - r.left) < 0.5 && Math.abs(p.width - r.width) < 0.5 && Math.abs(p.height - r.height) < 0.5 ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
      if (step.interactive && !cleanup) {
        const onClick = () => { setTimeout(next, 350); };
        el.addEventListener("click", onClick, { capture: true, once: true });
        cleanup = () => el.removeEventListener("click", onClick, { capture: true });
      }
    };
    tick();
    const id = window.setInterval(tick, 160);
    return () => { window.clearInterval(id); cleanup?.(); };
  }, [open, step, next]);

  // Keyboard: Escape skips, arrows move.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose("skipped");
      else if (e.key === "ArrowRight" && !step?.interactive) next();
      else if (e.key === "ArrowLeft") back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, step, next, back, onClose]);
  useEffect(() => { if (open) cardRef.current?.focus(); }, [open, i]);

  if (!mounted || !open || !step) return null;

  const spot = Boolean(step.target) && rect !== null && !missing;
  const hole = rect ? { top: Math.max(0, rect.top - PAD), left: Math.max(0, rect.left - PAD), width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;
  const narrow = vp.w > 0 && vp.w < 640;
  let cardStyle: React.CSSProperties = {};
  if (spot && hole) {
    if (narrow) {
      const targetLow = hole.top + hole.height / 2 > vp.h / 2;
      cardStyle = { position: "fixed", left: 12, right: 12, ...(targetLow ? { top: "calc(env(safe-area-inset-top, 0px) + 12px)" } : { bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }) };
    } else {
      const below = vp.h - (hole.top + hole.height) > 280;
      const left = Math.min(Math.max(12, hole.left), vp.w - CARD_W - 12);
      cardStyle = { position: "fixed", left, width: CARD_W, ...(below ? { top: hole.top + hole.height + 14 } : { top: Math.max(12, hole.top - 14 - 260) }) };
    }
  }
  const Icon = step.icon;
  const pct = ((i + 1) / steps.length) * 100;

  const card = (
    <motion.div
      key={i} ref={cardRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-live="polite"
      initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
      className="z-[10002] w-full max-w-[340px] rounded-2xl border border-white/20 bg-white p-5 text-left text-slate-900 shadow-2xl outline-none dark:bg-slate-900 dark:text-white"
      style={spot ? { ...cardStyle, maxWidth: narrow ? "none" : CARD_W } : undefined}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/15" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1} aria-label="Tour progress">
          <div className="h-full rounded-full bg-teal-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-white/60">{i + 1} of {steps.length}</span>
        <button type="button" onClick={() => onClose("skipped")} aria-label="Close tour" className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/10"><X size={16} aria-hidden="true" /></button>
      </div>
      {Icon && !spot && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-400 text-white shadow-lg"><Icon size={24} aria-hidden="true" /></div>}
      <h2 id="tour-title" className="text-lg font-extrabold leading-tight">{step.title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-white/70">{step.body}</p>
      {step.bullets && <ul className="mt-3 grid list-none gap-1.5 p-0">{step.bullets.map((b) => <li key={b} className="flex items-start gap-2 text-sm text-slate-700 dark:text-white/80"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />{b}</li>)}</ul>}
      {step.interactive && spot && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300"><MousePointerClick size={14} aria-hidden="true" /> Tap the highlighted button to continue</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {last && step.actions ? step.actions.map((a, k) => a.href
          ? <Link key={a.label} href={a.href} onClick={() => onClose("done")} className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ${k === 0 ? "bg-teal-600 text-white" : "border border-slate-300 dark:border-white/20"}`}>{a.label}</Link>
          : <button key={a.label} type="button" onClick={() => { if (a.restart) { setI(0); onRestart?.(); } }} className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold dark:border-white/20">{a.label}</button>)
          : (<>
            {i > 0 && <button type="button" onClick={back} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-semibold dark:border-white/20"><ArrowLeft size={16} aria-hidden="true" />Back</button>}
            <button type="button" onClick={next} className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white">
              {step.interactive && spot ? "Skip this step" : last ? "Finish" : "Next"}{!last && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </>)}
      </div>
      {!(last && step.actions) && <button type="button" onClick={() => onClose("skipped")} className="mt-2 min-h-[36px] w-full text-center text-xs font-medium text-slate-500 underline dark:text-white/50">Skip tour</button>}
    </motion.div>
  );

  return createPortal(
    <div className="pp-tour" style={{ position: "fixed", inset: 0, zIndex: 10001 }}>
      <style>{`@keyframes pp-tour-pulse{0%,100%{box-shadow:0 0 0 9999px rgba(6,18,16,.7),0 0 0 3px #2dd4bf}50%{box-shadow:0 0 0 9999px rgba(6,18,16,.7),0 0 0 7px rgba(45,212,191,.35)}}@media (prefers-reduced-motion:reduce){.pp-tour *{animation:none!important;transition:none!important}}`}</style>
      {spot && hole ? (
        <>
          {/* four blockers around the hole keep the page behind inert; the hole itself is open only for click steps */}
          <div style={{ position: "fixed", left: 0, right: 0, top: 0, height: hole.top }} />
          <div style={{ position: "fixed", left: 0, right: 0, top: hole.top + hole.height, bottom: 0 }} />
          <div style={{ position: "fixed", left: 0, width: hole.left, top: hole.top, height: hole.height }} />
          <div style={{ position: "fixed", left: hole.left + hole.width, right: 0, top: hole.top, height: hole.height }} />
          {!step.interactive && <div style={{ position: "fixed", ...hole }} />}
          <div aria-hidden="true" style={{ position: "fixed", ...hole, borderRadius: 14, pointerEvents: "none", transition: "all .3s cubic-bezier(.4,0,.2,1)", animation: "pp-tour-pulse 2s ease-in-out infinite" }} />
          <AnimatePresence mode="wait">{card}</AnimatePresence>
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(6,18,16,.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <AnimatePresence mode="wait">{card}</AnimatePresence>
        </div>
      )}
    </div>,
    document.body,
  );
}
