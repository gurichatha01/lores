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
        ink: "#0a0a0a",
        surface: "#f3f3ef",
        card: "#ffffff",
        hairline: "#cfcfc8",
        pink: "#ff2d78",
        acid: "#ccff00",
        sweetheart: "#f0568a",
        "ride-or-die": "#ff5c1a",
        group: "#2b2bef",
        family: "#e8940c",
        work: "#0f8f8f",
        roast: "#e11400",
        "share-dark": "#0b0b0c",
        "roast-dark": "#120a08",
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "Arial", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      boxShadow: {
        editorial: "0 26px 54px -24px rgba(0, 0, 0, 0.4)",
        sweetheart: "0 8px 22px -14px rgba(240, 86, 138, 0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
