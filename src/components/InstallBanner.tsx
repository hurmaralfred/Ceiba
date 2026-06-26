"use client";
import { useEffect, useState } from "react";
import { Download, X, Share, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

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

  if (isInstalled) return null;

  // iOS: button that shows instructions
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSInstructions(true)}
          className="flex items-center gap-2 bg-ceiba-50 border border-ceiba-200 text-ceiba-800 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-ceiba-100 transition-colors"
        >
          <Smartphone size={16} /> Instalar app
        </button>

        {showIOSInstructions && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">Instalar Ceiba en iPhone</h3>
                <button onClick={() => setShowIOSInstructions(false)}>
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-ceiba-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  Toca el botón <Share size={16} className="inline mx-1 text-blue-500" /> <strong>Compartir</strong> en Safari
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-ceiba-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  Desplázate y toca <strong>"Agregar a pantalla de inicio"</strong>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-ceiba-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  Toca <strong>"Agregar"</strong> para confirmar
                </li>
              </ol>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="mt-5 w-full bg-ceiba-700 text-white font-bold py-3 rounded-xl"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Android / Chrome: direct install button
  if (installEvent) {
    return (
      <button
        onClick={handleInstall}
        className="flex items-center gap-2 bg-ceiba-700 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-ceiba-800 transition-colors"
      >
        <Download size={16} /> Instalar app
      </button>
    );
  }

  return null;
}
