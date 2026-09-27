import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        panel: "var(--color-panel)",
        "panel-2": "var(--color-panel-2)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
        subtle: "var(--color-subtle)",
        accent: "var(--color-accent)",
        "accent-strong": "var(--color-accent-strong)",
        border: "var(--color-border)",
        "border-hover": "var(--color-border-hover)",
        danger: "var(--color-danger)",
        success: "var(--color-success)",
      },
      boxShadow: {
        glow: "var(--shadow-glow)",
        modal: "var(--shadow-modal)",
      },
    },
  },
  plugins: [],
};

export default config;
