import * as THREE from "three";

/**
 * Camera journey. One waypoint per scene (same order as SCENES). The camera never
 * cuts: it rides a centripetal Catmull-Rom spline through `pos`, aiming along `look`.
 * Waypoints are a first pass; each story stage tunes its own.
 */
type WP = { pos: [number, number, number]; look: [number, number, number]; fov: number };

const WAYPOINTS: WP[] = [
  { pos: [0, 5.2, 8], look: [0, 1.5, -14], fov: 50 }, // hero: arrival
  { pos: [-2, 7, 5], look: [0, 3, -16], fov: 48 }, // income: high, looking at the dawn line
  { pos: [0, 6.8, 9], look: [0, 0, -18], fov: 54 }, // flow: behind the merge, river runs to the horizon
  { pos: [3, 4.6, 4], look: [-2, 0.5, -15], fov: 52 }, // expenses: bank to the side of the branches
  { pos: [0, 3.8, 3], look: [0, 0.6, -14], fov: 46 }, // budget: tight, frontal on the gates
  { pos: [-3, 4.2, 2], look: [0, 0, -10], fov: 50 }, // savings: over the basin
  { pos: [2, 6, 1], look: [0, 2, -16], fov: 50 }, // investments: climbing the terraces
  { pos: [0, 7.5, 0], look: [0, 4, -32], fov: 44 }, // goals: long view to the horizon
  { pos: [0, 16, -4], look: [0, 0, -14], fov: 56 }, // intelligence: altitude, the whole map
  { pos: [0, 3.2, 6], look: [0, 1, -22], fov: 48 }, // cta: final approach
];

const curve = (pick: (w: WP) => [number, number, number]) =>
  new THREE.CatmullRomCurve3(WAYPOINTS.map((w) => new THREE.Vector3(...pick(w))), false, "centripetal");

let posCurve: THREE.CatmullRomCurve3 | null = null;
let lookCurve: THREE.CatmullRomCurve3 | null = null;

/** sceneIndex is fractional (i + eased progress to i+1). Writes into the given vectors. */
export function cameraAt(sceneIndex: number, outPos: THREE.Vector3, outLook: THREE.Vector3): number {
  posCurve ??= curve((w) => w.pos);
  lookCurve ??= curve((w) => w.look);
  const n = WAYPOINTS.length - 1;
  const s = Math.min(n, Math.max(0, sceneIndex));
  const t = s / n;
  posCurve.getPoint(t, outPos);
  lookCurve.getPoint(t, outLook);
  const i = Math.min(n - 1, Math.floor(s));
  const f = s - i;
  return WAYPOINTS[i].fov + (WAYPOINTS[i + 1].fov - WAYPOINTS[i].fov) * f;
}
