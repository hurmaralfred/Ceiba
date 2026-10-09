"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bell, Send, Camera, Settings } from "lucide-react";

const TABS = [
  { href: "/home",     icon: Home,      label: "Inicio",  cta: false },
  { href: "/feed",     icon: Bell,      label: "Feed",    cta: false },
  { href: "/invitar",  icon: Send,      label: "Invitar", cta: true  },
  { href: "/photos",   icon: Camera,    label: "Fotos",   cta: false },
  { href: "/settings", icon: Settings,  label: "Ajustes", cta: false },
];

const CACHE_KEY = "ceiba_birthday_today";

export default function BottomNav() {
  const pathname = usePathname();
  const [birthdayToday, setBirthdayToday] = useState(false);

  useEffect(() => {
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
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb"
      style={{
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {TABS.map(({ href, icon: Icon, label, cta }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const showBadge = href === "/feed" && birthdayToday && !active;

          if (cta) {
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-center gap-1 px-3 py-2 flex-1 min-w-0"
              >
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 active:scale-95"
                  style={{
                    background: active ? "var(--color-primary)" : "var(--color-honey)",
                    color: "#fff",
                    boxShadow: "0 2px 8px rgba(200,136,42,0.28)",
                  }}
                >
                  <Icon size={18} strokeWidth={2.2} />
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: active ? "var(--color-primary)" : "var(--color-honey)" }}
                >
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-1 px-3 py-2 flex-1 min-w-0 transition-colors"
            >
              {/* Active indicator — small honey dot at bottom */}
              {active && (
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: "var(--color-honey)" }}
                />
              )}
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.3 : 1.7}
                  style={{
                    color: active
                      ? "var(--color-primary)"
                      : "var(--color-text-muted)",
                    transition: "color 0.15s",
                  }}
                />
                {showBadge && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2"
                    style={{
                      background: "var(--color-honey)",
                      borderColor: "var(--color-surface)",
                    }}
                  />
                )}
              </div>
              <span
                className="text-[10px] font-medium truncate"
                style={{
                  color: active
                    ? "var(--color-primary)"
                    : "var(--color-text-muted)",
                  fontWeight: active ? 600 : 400,
                  transition: "color 0.15s",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
