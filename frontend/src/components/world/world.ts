/**
 * Shared, non-reactive state for the landing "world". GSAP / ScrollTrigger / DOM
 * listeners write here; the R3F scene reads it inside useFrame. Never put this in
 * React state: it changes every frame.
 */
export const world = {
  /** 0..1 camera arrival (GSAP) */
  intro: 0,
  /** 0..1 particles gathered into the Penny Pilot mark (GSAP) */
  form: 0,
  /** 0..1 hero-exit progress used by the mark dissolve (0 under reduced motion) */
  scroll: 0,
  /** raw page scroll progress 0..1 (always tracked, drives the HUD) */
  progress: 0,
  /** 0..1 camera journey, tweened by the master timeline (stays 0 under reduced motion) */
  travel: 0,
  /** fractional scene index: i + eased progress toward i+1 */
  scene: 0,
  sceneIndex: 0,
  /** 0..1 how far the hero has been left (from raw progress) */
  heroExit: 0,
  /** canvas opacity multiplier; the floor lifts as stage sections take over */
  veil: 1,
  /** scene anchors as scroll progress; rebuilt from [data-scene] elements on refresh */
  anchors: [0, 0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88, 1] as number[],
  /** pointer in NDC (-1..1); y up */
  px: 0,
  py: 0,
  hasPointer: false,
  /** income source highlighted from the DOM table (index) or -1 */
  focusSrc: -1,
  dark: true,
  reduced: false,
};

export type WorldTier = "full" | "lite" | "none";

/** Decide how much 3D this device gets. "none" means DOM + static poster only. */
export function detectTier(): WorldTier {
  if (typeof window === "undefined") return "none";
  try {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return "none";
  } catch {
    return "none";
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const small = window.matchMedia("(max-width: 767px)").matches;
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  return small || weak ? "lite" : "full";
}
