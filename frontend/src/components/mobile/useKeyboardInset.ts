"use client";

import { useEffect, useState } from "react";

/**
 * Tracks how much of the layout viewport is currently covered by the
 * on-screen keyboard, using the VisualViewport API. iOS/Android Safari and
 * Chrome resize `window.visualViewport` (not the layout viewport) when the
 * keyboard opens, which is what causes `position: fixed` elements (our
 * bottom nav, bottom sheets) to visually "jump" or float above the real
 * bottom of the screen — they stay pinned to the *layout* viewport's edge,
 * not the visible one. Returns the pixel gap to add as `bottom` offset so
 * fixed elements track the real visible bottom edge instead.
 *
 * Falls back to 0 (no-op) in browsers without visualViewport support —
 * the elements simply keep their normal `bottom: 0` positioning, exactly
 * as before this hook existed.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    if (!vv) return;

    const update = () => {
      // How far the visual viewport's bottom edge sits above the layout
      // viewport's bottom edge — i.e. how much the keyboard (or browser
      // chrome) is currently covering.
      const gap = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(gap)));
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
