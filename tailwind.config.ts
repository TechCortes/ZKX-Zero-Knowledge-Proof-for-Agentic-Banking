import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        zkx: {
          bg: "#0a0a0f",
          panel: "#12121a",
          border: "#1e1e2e",
          accent: "#7c3aed",
          green: "#22c55e",
          yellow: "#eab308",
          red: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
