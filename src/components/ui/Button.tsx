"use client";
import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "gold";
  size?: "sm" | "md" | "lg";
  pill?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-earth-500 hover:bg-earth-600 text-white shadow-warm-sm hover:shadow-warm focus-visible:ring-earth-400",
  secondary:
    "bg-cream-100 hover:bg-cream-200 text-brown-700 border border-cream-400 shadow-warm-xs hover:shadow-warm-sm focus-visible:ring-earth-300",
  ghost:
    "bg-transparent hover:bg-earth-50 text-earth-500 hover:text-earth-600 focus-visible:ring-earth-300",
  gold:
    "bg-gold-500 hover:bg-gold-600 text-white shadow-warm-sm hover:shadow-warm focus-visible:ring-gold-400",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9  px-4  text-sm   rounded-xl",
  md: "h-11 px-5  text-body rounded-xl",
  lg: "h-14 px-6  text-base rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  pill = false,
  fullWidth = false,
  loading = false,
  icon,
  iconRight,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        base,
        variants[variant],
        sizes[size],
        pill && "!rounded-full",
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin shrink-0" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span className="shrink-0">{iconRight}</span>
      )}
    </button>
  );
}
