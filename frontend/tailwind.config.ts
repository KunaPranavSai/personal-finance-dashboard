import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#1F2A44", dark: "#141B2E" },
        teal: { DEFAULT: "#0EA5A5", light: "#CFF3F0" },
        surface: { DEFAULT: "#F7F8FA", dark: "#0F1420" },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
