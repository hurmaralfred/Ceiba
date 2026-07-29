"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { ElementType } from "react";

export interface NavItem {
  href: string;
  icon: ElementType;
  label: string;
  center?: boolean;
}

export interface BottomNavigationProps {
  items: NavItem[];
  variant?: "light" | "dark";
}

export function BottomNavigation({ items, variant = "light" }: BottomNavigationProps) {
  const pathname = usePathname();
  const isDark = variant === "dark";

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 safe-area-pb",
        isDark
          ? "bg-transparent"
          : "bg-cream-100/95 border-t border-cream-400",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-around max-w-lg mx-auto",
          isDark && "mx-4 mb-3 rounded-full px-2 py-1",
          isDark && "bg-brown-900/90 backdrop-blur-lg border border-white/10",
        )}
      >
        {items.map(({ href, icon: Icon, label, center }) => {
          const active = pathname === href || pathname.startsWith(href + "/");

          if (center) {
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 flex-1"
                aria-label={label}
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center -mt-5 shadow-warm-md transition-all duration-200",
                    active
                      ? isDark
                        ? "bg-gold-500 shadow-gold-glow"
                        : "bg-earth-500 shadow-terra-glow"
                      : isDark
                      ? "bg-brown-700"
                      : "bg-earth-500",
                  )}
                >
                  <Icon
                    size={22}
                    strokeWidth={2}
                    className={cn(
                      isDark ? (active ? "text-white" : "text-gold-300") : "text-white",
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-tiny font-medium",
                    isDark
                      ? active ? "text-gold-400" : "text-white/50"
                      : active ? "text-earth-600" : "text-brown-400",
                  )}
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
              className="relative flex flex-col items-center gap-0.5 px-3 py-2 flex-1 transition-colors"
              aria-label={label}
            >
              {!isDark && active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-earth-500 rounded-b-full" />
              )}
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                className={cn(
                  "transition-colors",
                  isDark
                    ? active ? "text-gold-400" : "text-white/45"
                    : active ? "text-earth-600" : "text-brown-300",
                )}
              />
              <span
                className={cn(
                  "text-tiny font-medium",
                  isDark
                    ? active ? "text-gold-400" : "text-white/45"
                    : active ? "text-earth-600 font-semibold" : "text-brown-300",
                )}
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
