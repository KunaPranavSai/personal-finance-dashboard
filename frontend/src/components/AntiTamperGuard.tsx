"use client";

import { useEffect } from "react";

/**
 * Cosmetic, casual-user-only deterrents: blocked context menu, blocked common
 * DevTools shortcuts, and a soft DevTools-open heuristic that just logs.
 *
 * NONE OF THIS IS A SECURITY CONTROL. All of it is trivially bypassed from
 * DevTools itself (which anyone motivated can still open via the browser
 * menu) or by disabling JavaScript. Real protection for this app is enforced
 * entirely server-side: RBAC (backend/src/middleware/auth.ts), JWT + session
 * versioning, rate limiting and account lockout, and input validation on
 * every endpoint. Do not add logic here that anything sensitive depends on.
 */
export function AntiTamperGuard() {
  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isEditable(e.target)) return;
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const combo = (e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase());
      const isF12 = e.key === "F12";
      const isViewSource = (e.ctrlKey || e.metaKey) && e.key.toUpperCase() === "U";
      if (combo || isF12 || isViewSource) {
        e.preventDefault();
      }
    };

    let devtoolsWarned = false;
    const checkDevtoolsSize = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const likelyOpen = widthDiff > 200 || heightDiff > 200;
      if (likelyOpen && !devtoolsWarned) {
        devtoolsWarned = true;
        console.warn("[AntiTamperGuard] DevTools panel size detected — cosmetic notice only, not a security event.");
      } else if (!likelyOpen) {
        devtoolsWarned = false;
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    const interval = setInterval(checkDevtoolsSize, 2000);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      clearInterval(interval);
    };
  }, []);

  return null;
}
