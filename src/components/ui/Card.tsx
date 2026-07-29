import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "warm" | "glass" | "dark-glass" | "stat";
  padding?: "none" | "sm" | "md" | "lg";
}

const variants: Record<NonNullable<CardProps["variant"]>, string> = {
  default:
    "bg-cream-100 border border-cream-400 shadow-warm-sm",
  warm:
    "bg-[#f0e2cb] border border-[#d4b890] shadow-warm-sm",
  glass:
    "glass-warm border-0",
  "dark-glass":
    "glass-dark border-0",
  stat:
    "bg-white/80 border border-cream-300 shadow-warm-xs",
};

const paddings: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm:   "p-3",
  md:   "p-4",
  lg:   "p-6",
};

export function Card({
  variant = "default",
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden",
        variants[variant],
        paddings[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCard({ className, ...props }: CardProps) {
  return <Card variant="glass" className={className} {...props} />;
}
