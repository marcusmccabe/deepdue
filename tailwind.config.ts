import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4f46e5",
        body: "#0f172a",
        subtext: "#475569",
        muted: "#94a3b8",
        success: "#059669",
        warning: "#d97706",
        danger: "#dc2626",
      },
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "Instrument Serif", "serif"],
        sans: ["var(--font-plus-jakarta-sans)", "Plus Jakarta Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
