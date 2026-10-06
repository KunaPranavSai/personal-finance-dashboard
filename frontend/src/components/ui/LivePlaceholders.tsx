"use client";

import { useEffect } from "react";

/**
 * Live placeholders for the whole app: every text-like input/textarea with a placeholder types it out, holds, clears,
 * then switches to the next example topic. Mounted once (providers.tsx); a MutationObserver picks up fields that
 * appear later (sheets, dialogs, route changes).
 *  - Add data-placeholders="First|Second|Third" to a field for its own topics.
 *  - Otherwise topics come from the placeholder/label wording (TOPICS below); no match = just types the original.
 *  - Opt out with data-static-placeholder. Passwords, PINs, one-time codes and numeric-only samples stay static,
 *    as do users with reduced-motion.
 */
const TOPICS: [RegExp, string[]][] = [
  [/search|find/i, ["Try “groceries”…", "Try “rent this month”…", "Try “salary”…", "Try “₹500”…"]],
  [/e-?mail/i, ["you@example.com", "name@company.com"]],
  [/amount|price|cost|₹|value/i, ["e.g. 450", "e.g. 1,200.50", "e.g. 25,000"]],
  [/description|note|memo|details/i, ["e.g. Weekly groceries", "e.g. Cab to office", "e.g. Netflix subscription", "e.g. Dinner with friends"]],
  [/name|title|label/i, ["e.g. Emergency fund", "e.g. Vacation", "e.g. Home loan", "e.g. Side income"]],
  [/category/i, ["e.g. Food & Dining", "e.g. Travel", "e.g. Utilities", "e.g. Health"]],
];
const TYPE = 55, ERASE = 22, HOLD = 1700, GAP = 350;
const SKIP_TYPES = new Set(["password", "date", "time", "datetime-local", "month", "week", "file", "checkbox", "radio", "range", "color", "hidden"]);

interface State { phrases: string[]; i: number; n: number; phase: "type" | "hold" | "erase" | "gap"; wait: number; last: string }

function eligible(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  const orig = el.getAttribute("placeholder");
  if (!orig || el.disabled || el.readOnly || el.hasAttribute("data-static-placeholder")) return false;
  if (el instanceof HTMLInputElement && SKIP_TYPES.has(el.type)) return false;
  if (el.autocomplete === "one-time-code" || /^[\d\s•*.,-]+$/.test(orig)) return false;
  if (/\b(pin|otp|code|password)\b/i.test(`${el.getAttribute("aria-label") ?? ""} ${orig}`)) return false;
  return true;
}

function phrasesFor(el: HTMLInputElement | HTMLTextAreaElement, orig: string): string[] {
  const own = el.dataset.placeholders;
  if (own) return own.split("|").map((p) => p.trim()).filter(Boolean);
  const hint = `${orig} ${el.getAttribute("aria-label") ?? ""} ${el.name}`;
  const topic = TOPICS.find(([re]) => re.test(hint));
  return topic ? [orig, ...topic[1].filter((p) => p !== orig)] : [orig];
}

export function LivePlaceholders() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fields = new Map<HTMLInputElement | HTMLTextAreaElement, State>();

    const scan = (root: ParentNode) => {
      root.querySelectorAll("input[placeholder], textarea[placeholder]").forEach((el) => {
        if (!fields.has(el as HTMLInputElement) && eligible(el)) {
          const f = el as HTMLInputElement | HTMLTextAreaElement;
          const orig = f.getAttribute("placeholder")!;
          fields.set(f, { phrases: phrasesFor(f, orig), i: 0, n: 0, phase: "type", wait: Math.random() * 600, last: orig });
        }
      });
    };
    scan(document);
    const mo = new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n instanceof Element) { if (n.matches("input,textarea")) scan(n.parentElement ?? document); else scan(n); } })));
    mo.observe(document.body, { childList: true, subtree: true });

    const tick = window.setInterval(() => {
      fields.forEach((st, el) => {
        if (!el.isConnected) { fields.delete(el); return; }
        // The app changed the placeholder itself (new prop): adopt it as the new original.
        const now = el.getAttribute("placeholder") ?? "";
        if (now !== st.last) { st.phrases = phrasesFor(el, now); st.i = 0; st.n = now.length; st.phase = "hold"; st.wait = HOLD; st.last = now; return; }
        if (el.value || el.offsetParent === null) return; // typing, or not on screen
        if ((st.wait -= 40) > 0) return;
        const full = st.phrases[st.i];
        if (st.phase === "type") {
          st.n = Math.min(full.length, st.n + 1);
          if (st.n >= full.length) { st.phase = "hold"; st.wait = HOLD; } else st.wait = TYPE;
        } else if (st.phase === "hold") {
          st.phase = "erase"; st.wait = ERASE;
        } else if (st.phase === "erase") {
          st.n = Math.max(0, st.n - 1);
          if (st.n === 0) { st.phase = "gap"; st.wait = GAP; } else st.wait = ERASE;
        } else {
          st.i = (st.i + 1) % st.phrases.length; st.phase = "type"; st.n = 0; st.wait = TYPE;
        }
        const text = st.phrases[st.i].slice(0, st.n) || " ";
        st.last = text;
        el.setAttribute("placeholder", text);
      });
    }, 40);

    return () => { window.clearInterval(tick); mo.disconnect(); };
  }, []);
  return null;
}
