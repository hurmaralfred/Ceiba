"use client";
import { useEffect, useState } from "react";
import { Download, X, Share, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Capture the event globally so it's never missed regardless of when the component mounts
let globalInstallEvent: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalInstallEvent = e as BeforeInstallPromptEvent;
  });
}

export default function InstallBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Use globally captured event
    if (globalInstallEvent) {
      setInstallEvent(globalInstallEvent);
    }

    // Also listen in case it fires after mount
    const handler = (e: Event) => {
      e.preventDefault();
      globalInstallEvent = e as BeforeInstallPromptEvent;
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        globalInstallEvent = null;
      }
      setInstallEvent(null);
    } else {
      // Fallback: show instructions
      setShowInstructions(true);
    }
  };

  if (isInstalled) return null;

  const Instructions = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900">Instalar Ceiba</h3>
          <button onClick={() => setShowInstructions(false)}>
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        {isIOS ? (
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 bg-ceiba-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              Toca <Share size={16} className="inline mx-1 text-blue-500" /> <strong>Compartir</strong> en Safari
            </li>
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 bg-ceiba-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              Toca <strong>"Agregar a pantalla de inicio"</strong>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 bg-ceiba-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              Toca <strong>"Agregar"</strong>
            </li>
          </ol>
        ) : (
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 bg-ceiba-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              Abre esta página en <strong>Chrome</strong> en tu teléfono
            </li>
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 bg-ceiba-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              Toca el menú <strong>⋮</strong> arriba a la derecha
            </li>
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 bg-ceiba-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              Toca <strong>"Agregar a pantalla de inicio"</strong>
            </li>
          </ol>
        )}
        <button
          onClick={() => setShowInstructions(false)}
          className="mt-5 w-full bg-ceiba-700 text-white font-bold py-3 rounded-xl"
        >
          Entendido
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={handleInstall}
        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
      >
        <Smartphone size={16} /> Instalar
      </button>
      {showInstructions && <Instructions />}
    </>
  );
}
