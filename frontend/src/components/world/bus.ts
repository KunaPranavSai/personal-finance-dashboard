/**
 * Tiny typed event bus. The sound layer (muted, off by default, never autoplays)
 * will subscribe to these later; nothing here touches AudioContext.
 */
export type WorldEvents = {
  scene: { id: string; index: number; dir: 1 | -1 };
  /** user-driven interactions (hover a channel, drag a slider, ...) */
  cue: { name: string; value?: number };
};

type Handler<K extends keyof WorldEvents> = (e: WorldEvents[K]) => void;
const handlers = new Map<string, Set<(e: never) => void>>();

export const sound = { enabled: false };

export const bus = {
  on<K extends keyof WorldEvents>(name: K, fn: Handler<K>) {
    const set = handlers.get(name) ?? new Set();
    handlers.set(name, set);
    set.add(fn as (e: never) => void);
    return () => void set.delete(fn as (e: never) => void);
  },
  emit<K extends keyof WorldEvents>(name: K, e: WorldEvents[K]) {
    handlers.get(name)?.forEach((fn) => (fn as Handler<K>)(e));
  },
};
