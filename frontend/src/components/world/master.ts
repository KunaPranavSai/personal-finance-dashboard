import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { world } from "./world";
import { SCENES, SCENE_COUNT, OWNED_UNTIL } from "./scenes";
import { bus } from "./bus";

gsap.registerPlugin(ScrollTrigger);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (u: number) => u * u * (3 - 2 * u);

let lenis: Lenis | null = null;

/** Scroll the page to a scene's anchor (Lenis when active, native otherwise). */
export function scrollToScene(index: number) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const y = (world.anchors[index] ?? index / (SCENE_COUNT - 1)) * max;
  if (lenis) lenis.scrollTo(y, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: y, behavior: world.reduced ? "auto" : "smooth" });
}

/**
 * Scene anchors as scroll progress (0..1). A scene's anchor comes from a
 * `[data-scene="<id>"]` element's top when present; scenes without DOM yet are
 * interpolated between their neighbours. Rebuilt on every ScrollTrigger refresh,
 * so stage sections can be added without touching this file.
 */
function measure() {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const known: (number | null)[] = SCENES.map((s) => {
    const el = document.querySelector<HTMLElement>(`[data-scene="${s.id}"]`);
    if (!el) return null;
    return clamp01((el.getBoundingClientRect().top + window.scrollY) / max);
  });
  known[0] = 0;
  known[SCENE_COUNT - 1] = known[SCENE_COUNT - 1] ?? 1;
  const out: number[] = [];
  for (let i = 0; i < SCENE_COUNT; i++) {
    if (known[i] !== null) {
      out[i] = known[i]!;
      continue;
    }
    let a = i - 1;
    let b = i + 1;
    while (known[b] === null) b++;
    out[i] = out[a] + ((known[b]! - out[a]) * (i - a)) / (b - a);
  }
  for (let i = 1; i < SCENE_COUNT; i++) out[i] = Math.max(out[i], out[i - 1] + 0.005); // strictly increasing
  world.anchors = out;
}

/** progress -> fractional scene index (eased inside each segment so the camera dwells at waypoints) */
function derive(progress: number) {
  const a = world.anchors;
  let i = 0;
  while (i < SCENE_COUNT - 2 && progress >= a[i + 1]) i++;
  const u = clamp01((progress - a[i]) / (a[i + 1] - a[i]));
  const scene = i + ease(u);
  world.progress = progress;
  world.scene = scene;
  world.heroExit = clamp01(progress / a[1]);
  // Dim the world past the last built stage (the floor lifts as stages land).
  world.veil = 1 - 0.62 * ease(clamp01((scene - OWNED_UNTIL - 0.3) / 0.7));
  world.scroll = world.reduced ? 0 : world.heroExit;
  const idx = Math.round(scene);
  if (idx !== world.sceneIndex) {
    const dir = idx > world.sceneIndex ? 1 : -1;
    world.sceneIndex = idx;
    bus.emit("scene", { id: SCENES[idx].id, index: idx, dir });
  }
}

/**
 * Master architecture: Lenis smooth scroll -> ScrollTrigger over the whole page ->
 * one GSAP timeline whose single tween drives `world.travel` (the camera's journey).
 * Everything downstream (camera spline, terrain flight, HUD, sound bus) reads `world`.
 * Reduced motion: native scroll, camera frozen at the hero pose, HUD still tracks.
 */
export function initMaster() {
  measure();
  const cleanups: (() => void)[] = [];

  if (!world.reduced) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis?.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // modals lock body scroll with overflow:hidden; honour that
    const lock = () => (document.body.style.overflow === "hidden" ? lenis?.stop() : lenis?.start());
    const mo = new MutationObserver(lock);
    mo.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    cleanups.push(() => {
      gsap.ticker.remove(tick);
      mo.disconnect();
      lenis?.destroy();
      lenis = null;
    });
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: document.documentElement,
      start: 0,
      end: "max",
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => derive(self.progress),
    },
  });
  if (!world.reduced) tl.to(world, { travel: 1, ease: "none", duration: 1 }, 0);
  SCENES.forEach((s, i) => tl.addLabel(s.id, (world.anchors[i] ?? 0) * 1));
  cleanups.push(() => {
    tl.scrollTrigger?.kill();
    tl.kill();
  });

  const onRefresh = () => {
    measure();
    derive(world.progress);
  };
  ScrollTrigger.addEventListener("refresh", onRefresh);
  cleanups.push(() => ScrollTrigger.removeEventListener("refresh", onRefresh));

  // content height changes (fonts, images, accordions): refresh, debounced
  let t = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(t);
    t = window.setTimeout(() => ScrollTrigger.refresh(), 150);
  });
  ro.observe(document.body);
  window.addEventListener("load", onRefresh);
  cleanups.push(() => {
    ro.disconnect();
    clearTimeout(t);
    window.removeEventListener("load", onRefresh);
  });

  derive(0);
  return () => cleanups.forEach((fn) => fn());
}
