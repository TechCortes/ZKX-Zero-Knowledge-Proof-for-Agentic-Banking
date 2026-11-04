import type { Config } from "tailwindcss";

/**
 * ZQUENT design tokens — "Sovereign": light, private-bank clarity, with a dark
 * navy reading mode. Cobalt (zq-accent) is the action colour; green (zq-success)
 * is reserved for verified / approved states. All text tokens pass WCAG AA on
 * zq-bg, zq-surface and zq-raise in both themes.
 *
 * Values live in src/app/globals.css as RGB channels (light on :root, dark on
 * [data-theme="dark"]), so opacity modifiers like `bg-zq-accent/10` still work.
 */
const token = (name: string) => `rgb(var(--zq-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        zq: {
          bg: token("bg"),
          surface: token("surface"),
          raise: token("raise"),
          line: token("line"),
          "line-strong": token("line-strong"),
          text: token("text"),
          soft: token("soft"),
          muted: token("muted"),
          faint: token("faint"),
          accent: token("accent"),
          "accent-strong": token("accent-strong"),
          "on-accent": token("on-accent"),
          success: token("success"),
          "success-bg": token("success-bg"),
          warn: token("warn"),
          "warn-bg": token("warn-bg"),
          danger: token("danger"),
          navy: token("navy"),
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
        card: "var(--zq-shadow-card)",
        float: "var(--zq-shadow-float)",
      },
      maxWidth: {
        page: "75rem",
      },
    },
  },
  plugins: [],
};

export default config;
