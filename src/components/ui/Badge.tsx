import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export interface BadgeProps {
  variant?: "terra" | "gold" | "green" | "cream" | "blood" | "affinity" | "dark";
  size?: "sm" | "md";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  terra:    "bg-earth-100   text-earth-700   border border-earth-200",
  gold:     "bg-gold-100    text-gold-700    border border-gold-200",
  green:    "bg-ceiba-100   text-ceiba-800   border border-ceiba-200",
  cream:    "bg-cream-200   text-brown-700   border border-cream-400",
  blood:    "bg-ceiba-100   text-ceiba-800",
  affinity: "bg-earth-100   text-earth-700",
  dark:     "bg-white/10    text-white/90    border border-white/15",
};

const sizes: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-2   py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-1   text-xs     gap-1.5",
};

export function Badge({
  variant = "cream",
  size = "md",
  icon,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
