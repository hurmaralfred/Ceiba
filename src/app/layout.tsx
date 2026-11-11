import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/react";
import InstallPrompt from "@/components/InstallPrompt";
import AmplitudeInit from "@/components/AmplitudeInit";
import PendingInviteRedirect from "@/components/PendingInviteRedirect";
import PushRegistrar from "@/components/PushRegistrar";
import NotificationBanner from "@/components/NotificationBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LuminousFrame from "@/components/LuminousFrame";
import { FamilyPresenceProvider } from "@/contexts/FamilyPresenceContext";
import { atkinson, fraunces } from "./fonts";
import { shareMetadata } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  ...shareMetadata("/"),
  manifest: "/manifest.json",
  applicationName: "Ceiba",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ceiba",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/logo/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF6EE",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${atkinson.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Ceiba" />
      </head>
      <body className={`${fraunces.variable} ${atkinson.variable} font-sans min-h-screen`}>
        <Toaster position="top-center" />
        <LuminousFrame />
        <FamilyPresenceProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </FamilyPresenceProvider>
        <InstallPrompt />
        <PushRegistrar />
        <NotificationBanner />
        <Analytics />
        <AmplitudeInit />
        <PendingInviteRedirect />
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
