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
        ceiba: {
          50:  "#f2f7ee",
          100: "#e4eed9",
          200: "#c6ddb2",
          300: "#a3c484",
          400: "#8aad7e",
          500: "#6e9464",
          600: "#5c7a52",
          700: "#4a6342",
          800: "#3d5235",
          900: "#2c3c26",
          950: "#1a2417",
        },
        earth: {
          50:  "#fdf5f0",
          100: "#fae5d8",
          200: "#f5c9b0",
          300: "#eda380",
          400: "#e07a52",
          500: "#c1603a",
          600: "#a84f2f",
          700: "#8c3f24",
          800: "#73321b",
          900: "#5d2814",
        },
        cream: {
          50:  "#fffcf7",
          100: "#fdf8f1",
          200: "#f7efe4",
          300: "#ede5d8",
          400: "#ddd0bf",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      }
    },
  },
  plugins: [],
};

export default config;
