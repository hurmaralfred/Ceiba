"use client";
import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed before
    if (localStorage.getItem("ceiba-install-dismissed")) {
      setDismissed(true);
      return;
    }

    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Chrome / Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstallEvent(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("ceiba-install-dismissed", "1");
  };

  // Already installed or dismissed
  if (isInstalled || dismissed) return null;

  // iOS: show manual instructions
  if (isIOS) {
    return (
      <div className="mx-4 mb-4 bg-ceiba-50 border border-ceiba-200 rounded-2xl p-4 flex items-start gap-3">
        <Share size={20} className="text-ceiba-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ceiba-800">Instala Ceiba en tu iPhone</p>
          <p className="text-xs text-ceiba-700 mt-0.5">
            Toca <strong>Compartir</strong> <Share size={11} className="inline" /> → <strong>"Agregar a pantalla de inicio"</strong>
          </p>
        </div>
        <button onClick={handleDismiss} className="text-ceiba-400 hover:text-ceiba-600 flex-shrink-0">
          <X size={18} />
        </button>
      </div>
    );
  }

  // Chrome / Android: show install button
  if (installEvent) {
    return (
      <div className="mx-4 mb-4 bg-ceiba-700 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Download size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Instala Ceiba</p>
          <p className="text-xs text-ceiba-200">Úsala como app en tu teléfono</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-white text-ceiba-800 font-bold text-sm px-4 py-2 rounded-xl hover:bg-ceiba-50 transition-colors flex-shrink-0"
        >
          Instalar
        </button>
        <button onClick={handleDismiss} className="text-ceiba-300 hover:text-white flex-shrink-0">
          <X size={18} />
        </button>
      </div>
    );
  }

  // Fallback: browser doesn't support beforeinstallprompt (e.g. Firefox, desktop Safari)
  return null;
}
