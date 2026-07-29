import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
  serif?: boolean;
  dark?: boolean;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  icon,
  serif = false,
  dark = false,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-2", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className={cn("shrink-0 opacity-80", dark ? "text-white/70" : "text-brown-500")}>
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2
            className={cn(
              "font-semibold leading-snug truncate",
              serif
                ? "font-display text-title-lg"
                : "text-title",
              dark ? "text-white/92" : "text-brown-800",
            )}
          >
            {title}
          </h2>
          {subtitle && (
            <p className={cn("text-caption mt-0.5", dark ? "text-white/55" : "text-brown-400")}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
