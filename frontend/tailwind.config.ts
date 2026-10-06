import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy "Midnight Cockpit" tokens — kept as-is. The Admin/Super
        // Admin panel (frontend/src/app/(admin)/*, components/admin/*) still
        // uses these directly and must stay visually untouched.
        navy: { DEFAULT: "#1F2A44", dark: "#0F172A" },
        teal: { DEFAULT: "#0EA5A5", light: "#CFF3F0" },
        surface: { DEFAULT: "#F7F8FA", dark: "#070A12" },
        // Approved Penny Pilot palette — the single source of truth for
        // every USER-FACING page (mirrors src/styles/mobile.css's --ppm-*
        // raw values exactly). New/rebuilt desktop UI uses these, never the
        // legacy tokens above.
        cypress: "#004741",
        sand: "#F0EDE4",
        milky: "#FFFDF1",
        noturno: "#001621",
        tiffany: "#21F1A8",
        mantis: "#59C749",
        turmeric: "#FFBE0B",
        vulcanico: "#FF4103",
        // Semantic, theme-aware aliases — resolve via the --pp-* CSS
        // variables (globals.css), so e.g. `bg-pp-surface` is Milky in
        // light mode and #171717 in dark mode automatically, with no
        // `dark:` prefix needed. This is what rebuilt desktop UI should
        // reach for by default.
        "pp-bg": "color-mix(in srgb, var(--pp-bg) calc(<alpha-value> * 100%), transparent)",
        "pp-surface": "color-mix(in srgb, var(--pp-surface) calc(<alpha-value> * 100%), transparent)",
        "pp-surface-2": "color-mix(in srgb, var(--pp-surface-2) calc(<alpha-value> * 100%), transparent)",
        "pp-accent": "color-mix(in srgb, var(--pp-accent) calc(<alpha-value> * 100%), transparent)",
        "pp-accent-ink": "color-mix(in srgb, var(--pp-accent-ink) calc(<alpha-value> * 100%), transparent)",
        "pp-text": "color-mix(in srgb, var(--pp-text) calc(<alpha-value> * 100%), transparent)",
        "pp-text-dim": "color-mix(in srgb, var(--pp-text-dim) calc(<alpha-value> * 100%), transparent)",
        "pp-border": "color-mix(in srgb, var(--pp-border) calc(<alpha-value> * 100%), transparent)",
        "pp-positive": "color-mix(in srgb, var(--pp-positive) calc(<alpha-value> * 100%), transparent)",
        "pp-warning": "color-mix(in srgb, var(--pp-warning) calc(<alpha-value> * 100%), transparent)",
        "pp-critical": "color-mix(in srgb, var(--pp-critical) calc(<alpha-value> * 100%), transparent)",
        "pp-chip-bg": "color-mix(in srgb, var(--pp-chip-bg) calc(<alpha-value> * 100%), transparent)",
      },
      borderRadius: {
        xl2: "1.25rem",
        pp: "18px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08)",
        pp: "var(--pp-shadow)",
      },
    },
  },
  plugins: [],
};
export default config;
