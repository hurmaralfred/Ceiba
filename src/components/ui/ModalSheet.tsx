"use client";
import { useEffect, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  variant?: "light" | "dark";
  fullHeight?: boolean;
  className?: string;
}

export function ModalSheet({
  open,
  onClose,
  children,
  title,
  variant = "light",
  fullHeight = false,
  className,
}: ModalSheetProps) {
  const isDark = variant === "dark";

  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 rounded-t-3xl overflow-hidden",
          "animate-in slide-in-from-bottom duration-300",
          isDark
            ? "glass-dark"
            : "bg-cream-100 border-t border-cream-400",
          fullHeight ? "h-[92dvh]" : "max-h-[92dvh]",
          "overflow-y-auto overscroll-contain",
          className,
        )}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex flex-col items-center pt-3 pb-2 gap-2">
          <div
            className={cn(
              "w-10 h-1 rounded-full",
              isDark ? "bg-white/25" : "bg-cream-400",
            )}
          />
          {(title || true) && (
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className={cn(
                "absolute right-4 top-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                isDark
                  ? "bg-white/10 hover:bg-white/20 text-white/80"
                  : "bg-cream-200 hover:bg-cream-300 text-brown-500",
              )}
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          )}
          {title && (
            <p
              className={cn(
                "text-caption font-semibold tracking-wide",
                isDark ? "text-white/60" : "text-brown-400",
              )}
            >
              {title}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
