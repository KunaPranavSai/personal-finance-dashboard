"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { world } from "./world";
import { SCENES } from "./scenes";
import { bus } from "./bus";
import { scrollToScene } from "./master";

/**
 * Scroll progress as part of the world: a flight-path rail, one waypoint per story
 * scene. Real navigation (buttons, keyboard); the fill is written straight to the
 * DOM from the GSAP ticker, React state changes only when the scene changes.
 */
export function FlightHud() {
  const fill = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const off = bus.on("scene", (e) => setCurrent(e.index));
    const tick = () => {
      if (fill.current) fill.current.style.transform = `scaleY(${world.scene / (SCENES.length - 1)})`;
    };
    gsap.ticker.add(tick);
    return () => {
      off();
      gsap.ticker.remove(tick);
    };
  }, []);

  return (
    <nav aria-label="Flight path" className="pp-gsap fixed right-3 top-1/2 z-40 -translate-y-1/2 sm:right-5">
      <ol className="relative flex flex-col gap-1">
        <span aria-hidden="true" className="absolute bottom-3 right-[9px] top-3 w-px bg-pp-border">
          <span ref={fill} className="absolute inset-0 origin-top bg-pp-accent" style={{ transform: "scaleY(0)" }} />
        </span>
        {SCENES.map((s, i) => {
          const active = i === current;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => scrollToScene(i)}
                aria-label={`${s.label}, stage ${i + 1} of ${SCENES.length}`}
                aria-current={active ? "step" : undefined}
                className="group flex h-6 w-full items-center justify-end gap-3 rounded-full pl-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent"
              >
                <span
                  className={`hidden font-mono text-[10px] uppercase tracking-[0.2em] text-pp-text-dim transition-opacity lg:block ${
                    active ? "pp-hudfade text-pp-text" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  }`}
                >
                  {String(i).padStart(2, "0")} {s.label}
                </span>
                <span
                  aria-hidden="true"
                  className={`relative z-10 mr-[5px] block rounded-full transition-[width,height,background-color] ${
                    active ? "h-2.5 w-2.5 bg-pp-accent" : "h-1.5 w-1.5 bg-pp-text-dim group-hover:bg-pp-accent"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
