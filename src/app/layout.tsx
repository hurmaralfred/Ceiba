import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/react";
import InstallPrompt from "@/components/InstallPrompt";
import PushRegistrar from "@/components/PushRegistrar";
import NotificationBanner from "@/components/NotificationBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LuminousFrame from "@/components/LuminousFrame";
import { FamilyPresenceProvider } from "@/contexts/FamilyPresenceContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "Ceiba – Conecta tu familia",
  description: "Descubre y conecta con tus familiares, cerca o lejos, conocidos o por conocer.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ceiba",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#030208",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Ceiba" />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-cream-100 text-ceiba-900 min-h-screen`}>
        <Toaster position="top-center" />
        <LuminousFrame />
        <FamilyPresenceProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </FamilyPresenceProvider>
        <InstallPrompt />
        <PushRegistrar />
        <NotificationBanner />
        <Analytics />
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                // Desregistrar cualquier SW ajeno (firebase-messaging-sw.js, etc.)
                // que compita por el scope '/' e interfiera con los push VAPID.
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  regs.forEach(function(reg) {
                    var sw = reg.active || reg.installing || reg.waiting;
                    if (sw && sw.scriptURL && !sw.scriptURL.endsWith('/sw.js')) {
                      reg.unregister();
                    }
                  });
                });
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
