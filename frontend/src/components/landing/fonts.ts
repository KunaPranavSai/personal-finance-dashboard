import { DM_Serif_Display } from "next/font/google";

/**
 * Display serif for landing-page headline moments only (Hero, Final CTA) —
 * self-hosted via next/font (no external request, no layout shift). Scoped
 * to the landing page; the rest of the app keeps its existing typography.
 */
export const displayFont = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-landing-display",
  display: "swap",
});
