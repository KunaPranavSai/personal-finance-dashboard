"use client";

import { useEffect } from "react";
import { useUiStore } from "@/store/uiStore";

const SWIPE_THRESHOLD_PX = 50; // minimum horizontal travel to count as a swipe
const DIRECTION_RATIO = 1.5; // horizontal travel must exceed vertical travel by this much

/**
 * Swiping right, starting anywhere in the left third of the screen, opens the
 * mobile sidebar. The zone is intentionally wide (not just the literal bezel
 * edge) because on real devices the browser/OS itself intercepts touches that
 * start right at the physical edge for its own back-navigation gesture,
 * before the page's JS ever sees them — so requiring a pixel-perfect
 * edge-start makes the gesture unreliable in practice. Renders nothing.
 */
export function SwipeSidebarHandler() {
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let handled = false;

    const startZonePx = () => Math.min(140, window.innerWidth * 0.35);

    const handleTouchStart = (e: TouchEvent) => {
      if (sidebarOpen || window.innerWidth >= 1024) return;
      const touch = e.touches[0];
      if (touch.clientX > startZonePx()) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      handled = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking || handled) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      if (dx < SWIPE_THRESHOLD_PX) return;
      if (dx > dy * DIRECTION_RATIO) {
        setSidebarOpen(true);
        handled = true;
        tracking = false;
      }
    };

    const handleTouchEnd = () => {
      tracking = false;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [sidebarOpen, setSidebarOpen]);

  return null;
}
