"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TreePine, Bell, Send, Camera, Settings } from "lucide-react";

const TABS = [
  { href: "/tree",     icon: TreePine,  label: "Árbol",   pulse: false, highlight: false },
  { href: "/feed",     icon: Bell,      label: "Feed",    pulse: false, highlight: false },
  { href: "/invitar",  icon: Send,      label: "Invitar", pulse: false, highlight: true  },
  { href: "/photos",   icon: Camera,    label: "Fotos",   pulse: false, highlight: false },
  { href: "/settings", icon: Settings,  label: "Ajustes", pulse: false, highlight: false },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {TABS.map(({ href, icon: Icon, label, highlight }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 transition-colors min-w-0 flex-1 ${
                highlight && !active
                  ? "text-ceiba-600"
                  : active
                  ? "text-ceiba-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-ceiba-700 rounded-b-full" />
              )}
              <div className={`relative ${highlight && !active ? "bg-ceiba-100 rounded-full p-1.5 -my-0.5" : ""}`}>
                <Icon size={highlight && !active ? 20 : 22} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span className={`text-[10px] font-medium truncate ${
                active ? "text-ceiba-700 font-bold" : highlight ? "text-ceiba-600" : "text-gray-400"
              }`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
