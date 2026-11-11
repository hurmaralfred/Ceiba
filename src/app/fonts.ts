import localFont from "next/font/local";
import { Fraunces } from "next/font/google";

/**
 * Fraunces 600 only. Do not request the 100–900 variable range.
 * Latin subset covers Spanish (á, é, í, ó, ú, ñ, ü).
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "600",
  display: "swap",
  variable: "--font-fraunces",
});

/**
 * Atkinson Hyperlegible Next 400 / 600 / 700.
 * Next 14.2.5 does not export Atkinson_Hyperlegible_Next from next/font/google,
 * so these are the official Google Fonts latin woff2 instances (Spanish included).
 * License: src/fonts/atkinson/OFL.txt
 */
export const atkinson = localFont({
  src: [
    {
      path: "../fonts/atkinson/AtkinsonHyperlegibleNext-latin-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/atkinson/AtkinsonHyperlegibleNext-latin-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/atkinson/AtkinsonHyperlegibleNext-latin-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-atkinson",
  fallback: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
});
