"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake, UserPlus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS, RelationType } from "@/lib/types";

interface TodayItem {
  type: "birthday" | "joined" | "none";
  text: string;
  subtext?: string;
}

function getDaysUntil(birthDate: string): number {
  const today = new Date();
  const bd = new Date(birthDate);
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next.getTime() < today.setHours(0,0,0,0)) next.setFullYear(next.getFullYear() + 1);
  return Math.ceil((next.getTime() - Date.now()) / 86400000);
}

export default function TodayWidget({ userId }: { userId: string }) {
  const supabase = createClient();
  const [item, setItem] = useState<TodayItem | null>(null);

  useEffect(() => {
    if (!userId) return;
    load();
  }, [userId]);

  async function load() {
    const cutoff7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Check birthdays first (today = priority)
    const { data: members } = await supabase
      .from("family_members")
      .select("first_name, last_name, relation_type, birth_date")
      .eq("added_by", userId)
      .not("birth_date", "is", null);

    const today = new Date();
    let todayBday: typeof members extends null ? null : NonNullable<typeof members>[0] | undefined = undefined;
    let soonBday: typeof todayBday = undefined;
    let minDays = 99;

    (members || []).forEach(m => {
      if (!m.birth_date) return;
      const bd = new Date(m.birth_date);
      const isToday = bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
      if (isToday) { todayBday = m; return; }
      const days = getDaysUntil(m.birth_date);
      if (days <= 7 && days < minDays) { minDays = days; soonBday = m; }
    });

    if (todayBday) {
      const rel = RELATION_LABELS[(todayBday as any).relation_type as RelationType] || (todayBday as any).relation_type;
      setItem({
        type: "birthday",
        text: `🎂 Hoy cumple ${(todayBday as any).first_name}`,
        subtext: rel,
      });
      return;
    }

    // Check recent joins
    const { data: joined } = await supabase
      .from("family_members")
      .select("first_name, last_name, relation_type, profiles:profile_id(created_at)")
      .eq("added_by", userId)
      .not("profile_id", "is", null);

    const recentJoin = (joined || []).find((m: any) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return profile?.created_at && new Date(profile.created_at) > cutoff7;
    });

    if (recentJoin) {
      const rel = RELATION_LABELS[(recentJoin as any).relation_type as RelationType] || (recentJoin as any).relation_type;
      setItem({
        type: "joined",
        text: `${(recentJoin as any).first_name} se unió al árbol`,
        subtext: `Tu ${rel.toLowerCase()}`,
      });
      return;
    }

    // Soon birthday
    if (soonBday) {
      const rel = RELATION_LABELS[(soonBday as any).relation_type as RelationType] || (soonBday as any).relation_type;
      setItem({
        type: "birthday",
        text: `🎂 En ${minDays} días cumple ${(soonBday as any).first_name}`,
        subtext: rel,
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
        <div className={`w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{item.text}</p>
          {item.subtext && <p className="text-xs text-gray-500 mt-0.5">{item.subtext}</p>}
        </div>
        <Sparkles size={14} className="text-gray-300 shrink-0" />
      </div>
    </Link>
  );
}
