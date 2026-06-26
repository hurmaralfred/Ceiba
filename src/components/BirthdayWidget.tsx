"use client";
import { useEffect, useState } from "react";
import { Cake } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS, RelationType } from "@/lib/types";

interface BirthdayEntry {
  name: string;
  relation: string;
  birth_date: string;
  daysUntil: number;
  age: number | null;
}

function getDaysUntilBirthday(birthDate: string): number {
  const today = new Date();
  const bd = new Date(birthDate);
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff === 365 ? 0 : diff;
}

function formatBirthday(birthDate: string): string {
  const bd = new Date(birthDate);
  return bd.toLocaleDateString("es", { day: "numeric", month: "long" });
}

export default function BirthdayWidget({ userId }: { userId: string }) {
  const supabase = createClient();
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);

  useEffect(() => { loadBirthdays(); }, [userId]);

  const loadBirthdays = async () => {
    // Get family members with birth_date
    const { data: members } = await supabase
      .from("family_members")
      .select("first_name, last_name, relation_type, birth_date")
      .eq("added_by", userId)
      .not("birth_date", "is", null);

    // Get my own birth_date
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("birth_date")
      .eq("id", userId)
      .single();

    const entries: BirthdayEntry[] = [];

    (members || []).forEach(m => {
      if (!m.birth_date) return;
      const daysUntil = getDaysUntilBirthday(m.birth_date);
      if (daysUntil > 30) return; // only show next 30 days
      const bd = new Date(m.birth_date);
      const age = bd.getFullYear() > 1900
        ? new Date().getFullYear() - bd.getFullYear() + (daysUntil === 0 ? 0 : 1)
        : null;
      entries.push({
        name: `${m.first_name} ${m.last_name || ""}`.trim(),
        relation: RELATION_LABELS[m.relation_type as RelationType] || m.relation_type,
        birth_date: m.birth_date,
        daysUntil,
        age,
      });
    });

    entries.sort((a, b) => a.daysUntil - b.daysUntil);
    setBirthdays(entries);
  };

  if (birthdays.length === 0) return null;

  return (
    <div className="card border-l-4 border-l-amber-400 bg-amber-50">
      <h3 className="font-bold text-amber-800 flex items-center gap-2 mb-3">
        <Cake size={18} /> Próximos cumpleaños
      </h3>
      <div className="space-y-2">
        {birthdays.map((b, i) => (
          <div key={i} className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-gray-900 text-sm">{b.name}</span>
              <span className="text-gray-500 text-xs ml-2">· {b.relation}</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600">{formatBirthday(b.birth_date)}{b.age ? ` · ${b.age} años` : ""}</div>
              <div className={`text-xs font-bold ${b.daysUntil === 0 ? "text-amber-600" : "text-amber-500"}`}>
                {b.daysUntil === 0 ? "🎉 Hoy!" : b.daysUntil === 1 ? "Mañana" : `En ${b.daysUntil} días`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
