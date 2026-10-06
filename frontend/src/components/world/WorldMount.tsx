"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { detectTier, world, type WorldTier } from "./world";
import { Poster } from "./Poster";
import { initMaster } from "./master";
import "lenis/dist/lenis.css";

// Chunk name matters: next.config excludes /world3d*.js from the service-worker precache.
const WorldCanvas = dynamic(() => import(/* webpackChunkName: "world3d" */ "./WorldCanvas"), { ssr: false });

/**
 * Fixed, persistent backdrop. DOM content paints first; the canvas mounts after idle.
 * tier "none" (no WebGL) keeps only the static poster.
 */
export function WorldMount() {
  const [tier, setTier] = useState<WorldTier | null>(null);

  useEffect(() => {
    world.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    const sync = () => {
      world.dark = root.classList.contains("dark");
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      world.px = (e.clientX / window.innerWidth) * 2 - 1;
      world.py = -((e.clientY / window.innerHeight) * 2 - 1);
      world.hasPointer = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const stopMaster = initMaster();

    const start = () => setTier(detectTier());
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 600 }) : window.setTimeout(start, 120);
    return () => {
      mo.disconnect();
      stopMaster();
      window.removeEventListener("pointermove", onMove);
      if (!w.requestIdleCallback) clearTimeout(id);
    };
  }, []);

  return (
    <div className="pp-gsap fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {(tier === null || tier === "none") && <Poster />}
      {tier && tier !== "none" && <WorldCanvas tier={tier} />}
    </div>
  );
}
