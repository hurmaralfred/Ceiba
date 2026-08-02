"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bell, Send, Camera, Settings } from "lucide-react";

const TABS = [
  { href: "/home",     icon: Home,      label: "Inicio",  pulse: false, highlight: false },
  { href: "/feed",     icon: Bell,      label: "Feed",    pulse: false, highlight: false },
  { href: "/invitar",  icon: Send,      label: "Invitar", pulse: false, highlight: true  },
  { href: "/photos",   icon: Camera,    label: "Fotos",   pulse: false, highlight: false },
  { href: "/settings", icon: Settings,  label: "Ajustes", pulse: false, highlight: false },
];

const CACHE_KEY = "ceiba_birthday_today";

export default function BottomNav() {
  const pathname = usePathname();
  const [birthdayToday, setBirthdayToday] = useState(false);

  useEffect(() => {
    // Read from sessionStorage first to avoid redundant fetches per session
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached !== null) {
      setBirthdayToday(cached === "1");
      return;
    }
    fetch("/api/feed")
      .then((r) => r.json())
      .then(({ birthdays }) => {
        const now = new Date();
        const hasToday = ((birthdays as any[]) ?? []).some((b: any) => {
          const bd = new Date(b.birth_date);
          const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
          const days = Math.round((next.getTime() - now.getTime()) / 86400000);
          return days <= 0 || days >= 365;
        });
        sessionStorage.setItem(CACHE_KEY, hasToday ? "1" : "0");
        setBirthdayToday(hasToday);
      })
      .catch(() => {});
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-cream-50 border-t border-cream-300 safe-area-pb">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {TABS.map(({ href, icon: Icon, label, highlight }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const showBadge = href === "/feed" && birthdayToday && !active;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 transition-colors min-w-0 flex-1 ${
                highlight && !active
                  ? "text-earth-500"
                  : active
                  ? "text-ceiba-700"
                  : "text-ceiba-400 hover:text-ceiba-600"
              }`}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-ceiba-700 rounded-b-full" />
              )}
              <div className={`relative ${highlight && !active ? "bg-earth-100 rounded-full p-1.5 -my-0.5" : ""}`}>
                <Icon size={highlight && !active ? 20 : 22} strokeWidth={active ? 2.5 : 1.8} />
                {showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-cream-50" />
                )}
              </div>
              <span className={`text-[10px] font-medium truncate ${
                active ? "text-ceiba-700 font-bold" : highlight ? "text-earth-500" : "text-ceiba-400"
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
