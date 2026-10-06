/**
 * Story spine + motion-layer budget. Pure data (no three): safe for the main bundle.
 *
 * The 16 motion layers; each scene activates 2-4, never all (see CLAUDE.md).
 */
export const LAYERS = {
  1: "typography",
  2: "micro-interactions",
  3: "cursor tracking",
  4: "magnetic interactions",
  5: "parallax",
  6: "depth",
  7: "3D objects",
  8: "particles",
  9: "lighting",
  10: "camera movement",
  11: "scroll choreography",
  12: "spatial transitions",
  13: "data visualization",
  14: "sound-ready architecture",
  15: "responsive transformation",
  16: "user-driven exploration",
} as const;

export type Scene = {
  id: string;
  /** HUD label */
  label: string;
  /** what the visual means (the rule: no animation without product meaning) */
  meaning: string;
  /** active motion layers for this scene (2-4) */
  layers: number[];
};

export const SCENES: Scene[] = [
  { id: "hero", label: "Arrival", meaning: "Income gathers into the Penny Pilot mark", layers: [1, 8, 3, 10] },
  { id: "income", label: "Income", meaning: "Light falls in from above: inflow, thread width = amount", layers: [8, 10, 6] },
  { id: "flow", label: "Money flow", meaning: "Threads merge into one river down the valley", layers: [8, 11, 6] },
  { id: "expenses", label: "Expenses", meaning: "The river branches into category channels", layers: [8, 12, 13] },
  { id: "budget", label: "Budget", meaning: "Gates cap each channel; overflow visibly spills", layers: [7, 6, 9] },
  { id: "savings", label: "Savings", meaning: "Light pools in a basin; level = savings rate", layers: [8, 16, 9] },
  { id: "investments", label: "Investments", meaning: "Pool feeds terraces; particles compound per step", layers: [8, 13, 10] },
  { id: "goals", label: "Goals", meaning: "Fixed beacons on the horizon; progress arcs toward them", layers: [7, 10, 12] },
  { id: "intelligence", label: "Intelligence", meaning: "Altitude gain: the whole map, trends as constellations", layers: [13, 10, 12, 6] },
  { id: "cta", label: "Landing", meaning: "Runway lights lead to Get Started", layers: [9, 10, 4] },
];

export const SCENE_COUNT = SCENES.length;

/** Index of the last scene whose stage is built; the world dims past it until the next stage lands. */
export const OWNED_UNTIL = 2;
