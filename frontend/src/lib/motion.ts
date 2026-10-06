// One motion language for every public and pre-login screen. Exponential ease-out, short durations, nothing loops.
import type { Transition, Variants } from "framer-motion";

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Parent variant: reveals its `fadeUp` children one after another. */
export const stagger = (gap = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: EASE } },
};

/** Steps inside one card (forgot-password, signup code step): slide in from the right, out to the left. */
export const stepSlide: Variants = {
  hidden: { opacity: 0, x: 14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE } },
  exit: { opacity: 0, x: -14, transition: { duration: 0.18, ease: EASE } },
};

/** Spring used for button press feedback. */
export const pressSpring: Transition = { type: "spring", stiffness: 500, damping: 30 };

/** Scroll-reveal props for landing sections (once, slightly before the element is fully in view). */
export const reveal = {
  initial: "hidden",
  whileInView: "show",
  viewport: { once: true, margin: "-80px" },
} as const;
