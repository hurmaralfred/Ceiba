import { cn } from "@/lib/cn";

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  ring?: boolean;
  ringColor?: "terra" | "gold" | "green";
  className?: string;
}

const sizes: Record<NonNullable<AvatarProps["size"]>, { container: string; text: string }> = {
  xs:  { container: "w-6   h-6",   text: "text-[9px]"  },
  sm:  { container: "w-8   h-8",   text: "text-xs"     },
  md:  { container: "w-11  h-11",  text: "text-sm"     },
  lg:  { container: "w-14  h-14",  text: "text-base"   },
  xl:  { container: "w-20  h-20",  text: "text-xl"     },
  "2xl": { container: "w-28 h-28", text: "text-3xl"    },
};

const rings: Record<NonNullable<AvatarProps["ringColor"]>, string> = {
  terra: "ring-2 ring-earth-500 ring-offset-2 ring-offset-[var(--color-bg)]",
  gold:  "ring-2 ring-gold-500  ring-offset-2 ring-offset-[var(--color-bg)]",
  green: "ring-2 ring-ceiba-600 ring-offset-2 ring-offset-[var(--color-bg)]",
};

function initials(name?: string) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  src,
  name,
  size = "md",
  ring = false,
  ringColor = "terra",
  className,
}: AvatarProps) {
  const { container, text } = sizes[size];

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden bg-cream-300 flex items-center justify-center select-none",
        container,
        ring && rings[ringColor],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? "avatar"}
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <span className={cn("font-semibold text-brown-600 leading-none", text)}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}
