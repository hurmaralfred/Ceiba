import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  dark?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  dark = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6 gap-3",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-1",
            dark ? "bg-white/10" : "bg-cream-200",
          )}
        >
          {icon}
        </div>
      )}
      <p
        className={cn(
          "font-semibold text-title",
          dark ? "text-white/90" : "text-brown-700",
        )}
      >
        {title}
      </p>
      {description && (
        <p className={cn("text-body max-w-xs", dark ? "text-white/55" : "text-brown-400")}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
