import type { Config } from "tailwindcss";

/**
 * ZQUENT design tokens — "Sovereign": light, private-bank clarity.
 * Cobalt (zq-accent) is the action colour; green (zq-success) is reserved for
 * verified / approved states. All text tokens pass WCAG AA on zq-bg and zq-surface.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        zq: {
          bg: "#F5F7FA",
          surface: "#FFFFFF",
          raise: "#EEF2F7",
          line: "#D9DFE8",
          "line-strong": "#C3CCD8",
          text: "#0B1F3A",
          soft: "#33415A",
          muted: "#4A5668",
          faint: "#5A6678",
          accent: "#1F4FD8",
          "accent-strong": "#1A43B8",
          "on-accent": "#FFFFFF",
          success: "#0E8A5F",
          "success-bg": "#E3F4EC",
          warn: "#A15C07",
          danger: "#C62828",
          navy: "#0B1F3A",
        },
      },
      fontFamily: {
        sans: ["'Geist Variable'", "Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Geist Variable'", "Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'Geist Mono Variable'", "'Geist Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        md: "12px",
        lg: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,31,58,0.06), 0 12px 32px rgba(11,31,58,0.06)",
        float: "0 8px 24px rgba(11,31,58,0.14)",
      },
      maxWidth: {
        page: "75rem",
      },
    },
  },
  plugins: [],
};

export default config;
