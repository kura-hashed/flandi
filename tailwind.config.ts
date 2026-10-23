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
        flandi: {
          bg: "#FFF9F8",
          cream: "#FFF3F0",
          pink: "#FFD6D1",
          salmon: "#F48B7E",
          coral: "#E86F5F",
          rose: "#F9B5AC",
          dark: "#4A2E2B",
          muted: "#8C6560",
          mint: "#D8F3DC",
          caramel: "#D97724",
        },
      },
      fontFamily: {
        display: ["var(--font-fredoka)", "var(--font-quicksand)", "sans-serif"],
        sans: ["var(--font-quicksand)", "sans-serif"],
      },
      boxShadow: {
        cute: "0 8px 25px -5px rgba(244, 139, 126, 0.25)",
        "cute-lg": "0 14px 35px -8px rgba(244, 139, 126, 0.35)",
        sticker: "0 4px 0px #E86F5F",
      },
    },
  },
  plugins: [],
};
export default config;
