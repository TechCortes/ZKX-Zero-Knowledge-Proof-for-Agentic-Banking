import type { Config } from "tailwindcss";

/**
 * ZQUENT institutional design tokens.
 * One accent (zq-accent) is reserved for verified / approved states and the primary action.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        zq: {
          bg: "#0A0B0D",
          surface: "#111317",
          raise: "#16191E",
          line: "#1F2329",
          "line-strong": "#2C313A",
          text: "#EDEEF0",
          soft: "#B6BBC3",
          muted: "#8A9099",
          faint: "#646A74",
          accent: "#3DDC97",
          "accent-strong": "#5BE6A9",
          warn: "#F5B544",
          danger: "#F06A6A",
        },
      },
      fontFamily: {
        sans: ["'Inter Variable'", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Inter Tight Variable'", "'Inter Variable'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono Variable'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      maxWidth: {
        page: "75rem",
      },
    },
  },
  plugins: [],
};

export default config;
