"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake, UserPlus, Sparkles, X } from "lucide-react";

interface TodayItem {
  type: "birthday" | "joined" | "none";
  text: string;
  subtext?: string;
  dismissKey?: string;
}

export default function TodayWidget({ userId }: { userId: string }) {
  const [item, setItem] = useState<TodayItem | null>(null);

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (item?.dismissKey) localStorage.setItem(item.dismissKey, "1");
    setItem(null);
  };

  useEffect(() => {
    if (!userId) return;
    load();
  }, [userId]);

  async function load() {
    // Fuente canónica: /api/feed (persons + relationships + person_claims)
    let feed: any;
    try {
      const res = await fetch("/api/feed?birthdayDays=7");
      if (!res.ok) { setItem(null); return; }
      feed = await res.json();
    } catch {
      setItem(null);
      return;
    }

    const birthdays: any[] = (feed?.birthdays ?? []).filter((b: any) => !b.is_deceased);

    // Check birthdays first (today = priority)
    const todayBday = birthdays.find((b) => b.days_until === 0);
    if (todayBday) {
      setItem({
        type: "birthday",
        text: `🎂 Hoy cumple ${todayBday.first_name}`,
        subtext: todayBday.relation_label ?? undefined,
      });
      return;
    }

    // Check recent joins
    const recentJoin = (feed?.recentJoins ?? [])[0];
    if (recentJoin) {
      const dismissKey = `tw_join_${recentJoin.first_name}_${recentJoin.joined_at}`;
      if (typeof window !== "undefined" && localStorage.getItem(dismissKey)) return; // dismissed
      setItem({
        type: "joined",
        text: `${recentJoin.first_name} se unió a la galaxia`,
        subtext: recentJoin.relation_label ? `Tu ${String(recentJoin.relation_label).toLowerCase()}` : undefined,
        dismissKey,
      });
      return;
    }

    // Soon birthday
    const soonBday = birthdays.find((b) => b.days_until > 0 && b.days_until <= 7);
    if (soonBday) {
      setItem({
        type: "birthday",
        text: `🎂 En ${soonBday.days_until} días cumple ${soonBday.first_name}`,
        subtext: soonBday.relation_label ?? undefined,
      });
      return;
    }

    setItem(null);
  }

  if (!item) return null;

  const colors = item.type === "birthday"
    ? "bg-amber-50 border-amber-200"
    : "bg-green-50 border-green-200";
  const Icon = item.type === "birthday" ? Cake : UserPlus;
  const iconColor = item.type === "birthday" ? "text-amber-600" : "text-green-600";

  return (
    <Link href="/feed">
      <div className={`rounded-2xl border ${colors} px-4 py-3 flex items-center gap-3 mb-3 active:scale-[0.98] transition-transform`}>
        <div className={`w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{item.text}</p>
          {item.subtext && <p className="text-xs text-gray-500 mt-0.5">{item.subtext}</p>}
        </div>
        {item.dismissKey ? (
          <button
            onClick={dismiss}
            className="p-1 rounded-full hover:bg-black/10 transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={14} className="text-gray-400" />
          </button>
        ) : (
          <Sparkles size={14} className="text-gray-300 shrink-0" />
        )}
      </div>
    </Link>
  );
}
