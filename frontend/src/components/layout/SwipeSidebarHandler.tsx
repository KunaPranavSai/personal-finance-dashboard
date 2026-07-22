"use client";

import { useEffect } from "react";
import { useUiStore } from "@/store/uiStore";

const EDGE_ZONE_PX = 32; // swipe must start within this distance of the left edge
const SWIPE_THRESHOLD_PX = 60; // minimum horizontal travel to count as a swipe
const MAX_VERTICAL_DRIFT_PX = 60; // ignore mostly-vertical gestures (scrolling)

/** Swiping right from the left edge of the screen opens the mobile sidebar. Renders nothing. */
export function SwipeSidebarHandler() {
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (sidebarOpen || window.innerWidth >= 1024) return;
      const touch = e.touches[0];
      if (touch.clientX > EDGE_ZONE_PX) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      if (dx > SWIPE_THRESHOLD_PX && dy < MAX_VERTICAL_DRIFT_PX) {
        setSidebarOpen(true);
        tracking = false;
      } else if (dy > MAX_VERTICAL_DRIFT_PX) {
        tracking = false; // vertical scroll, not a sidebar swipe
      }
    };

    const handleTouchEnd = () => {
      tracking = false;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [sidebarOpen, setSidebarOpen]);

  return null;
}
