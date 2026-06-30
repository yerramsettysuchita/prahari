import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Single, disciplined palette. Do not add colors outside this set.
        ink: "var(--ink)", // page background
        surface: "var(--surface)", // cards
        line: "var(--line)", // 1px hairline borders
        primary: "var(--text-primary)", // warm off-white, never pure white
        muted: "var(--text-muted)",
        accent: "var(--accent)", // amber for alerts, escalation, one key metric
        positive: "var(--positive)", // resolved / positive only
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Keep corners minimal and consistent. lg is the ceiling.
        lg: "0.625rem",
      },
      boxShadow: {
        // The only shadow allowed: a single soft, subtle lift.
        soft: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.5)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.92)" },
        },
        "halo-soft": {
          "0%": { opacity: "0.5", transform: "scale(1)" },
          "70%, 100%": { opacity: "0", transform: "scale(2.2)" },
        },
      },
      animation: {
        // Live alert elements.
        "pulse-soft": "pulse-soft 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "halo-soft": "halo-soft 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      letterSpacing: {
        tightish: "-0.02em",
      },
    },
  },
  plugins: [],
};

export default config;
