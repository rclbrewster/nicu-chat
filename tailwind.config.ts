import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-text)"],
      },
      colors: {
        action: "var(--action)",
        "action-focus": "var(--action-focus)",
        ink: "var(--ink)",
        "ink-80": "var(--ink-80)",
        "ink-48": "var(--ink-48)",
        canvas: "var(--canvas)",
        parchment: "var(--parchment)",
        pearl: "var(--pearl)",
        hairline: "var(--hairline)",
      },
      borderRadius: {
        sm: "8px",
        md: "11px",
        lg: "18px",
      },
      letterSpacing: {
        tight2: "-0.374px",
      },
    },
  },
  plugins: [],
};

export default config;
