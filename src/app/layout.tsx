import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "Ceiba – Conecta tu familia",
  description: "Descubre y conecta con tus familiares, cerca o lejos, conocidos o por conocer.",
  manifest: "/manifest.json",
  themeColor: "#15803d",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-gray-50 text-gray-900 min-h-screen`}>
        <Toaster position="top-center" />
        {children}
      </body>
    </html>
  );
}
