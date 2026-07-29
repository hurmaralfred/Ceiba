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
          50:  "#fffdf8",
          100: "#fdf8f1",
          200: "#f7edd9",
          300: "#eedfc6",
          400: "#e3ceb0",
          500: "#d4b890",
        },
        // Dorado — árbol oscuro, insignias, anillos destacados
        gold: {
          100: "#fbf0d8",
          200: "#f5e0b0",
          300: "#edcf88",
          400: "#e0b855",
          500: "#c4922a",
          600: "#a87821",
          700: "#8c5f18",
          800: "#734b10",
          900: "#5c3808",
        },
        // Marrón cálido — superficies oscuras (modal perfil, árbol nocturno)
        brown: {
          50:  "#f5ede3",
          100: "#e8d5bf",
          200: "#d4b090",
          300: "#c08d65",
          400: "#a06b40",
          500: "#7a5030",
          600: "#5c3c22",
          700: "#3d2b1a",
          800: "#2e1c0e",
          900: "#1a0f05",
          950: "#0d0805",
        },
      },
      fontFamily: {
        sans:    ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      fontSize: {
        "display-xl": ["4rem",     { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display":    ["3rem",     { lineHeight: "1.1",  letterSpacing: "-0.02em" }],
        "heading":    ["2rem",     { lineHeight: "1.2",  letterSpacing: "-0.01em" }],
        "title-lg":   ["1.375rem", { lineHeight: "1.35" }],
        "title":      ["1.125rem", { lineHeight: "1.4"  }],
        "body-lg":    ["1rem",     { lineHeight: "1.65" }],
        "body":       ["0.9375rem",{ lineHeight: "1.6"  }],
        "caption":    ["0.8125rem",{ lineHeight: "1.5"  }],
        "tiny":       ["0.6875rem",{ lineHeight: "1.4"  }],
      },
      boxShadow: {
        "warm-xs": "0 1px 2px rgba(193,96,58,0.08)",
        "warm-sm": "0 1px 4px rgba(193,96,58,0.10), 0 1px 2px rgba(193,96,58,0.06)",
        "warm":    "0 4px 12px rgba(193,96,58,0.12), 0 2px 4px rgba(193,96,58,0.08)",
        "warm-md": "0 6px 18px rgba(193,96,58,0.14), 0 3px 6px rgba(193,96,58,0.08)",
        "warm-lg": "0 10px 28px rgba(193,96,58,0.16), 0 4px 8px rgba(193,96,58,0.10)",
        "warm-xl": "0 20px 48px rgba(193,96,58,0.20), 0 8px 16px rgba(193,96,58,0.12)",
        "gold-glow":  "0 0 0 3px rgba(196,146,42,0.35), 0 0 18px rgba(196,146,42,0.25)",
        "terra-glow": "0 0 0 3px rgba(193,96,58,0.35), 0 0 18px rgba(193,96,58,0.20)",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      backgroundImage: {
        "gradient-warm":  "linear-gradient(180deg, #f7edd9 0%, #f0e0c5 100%)",
        "gradient-terra": "linear-gradient(135deg, #c1603a 0%, #a84f2f 100%)",
        "gradient-gold":  "linear-gradient(135deg, #e0b855 0%, #c4922a 100%)",
        "gradient-dark":  "linear-gradient(180deg, #1a0f05 0%, #2e1c0e 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
