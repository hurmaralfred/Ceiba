"use client";
import { useEffect, useState } from "react";
import { Cake } from "lucide-react";

interface BirthdayEntry {
  name: string;
  birth_date: string;
  daysUntil: number;
  age: number | null;
}

function parseBDParts(s: string): [number, number] {
  // YYYY-MM-DD parses as UTC midnight → wrong local date in UTC-5 (Colombia)
  const parts = s.split("-");
  return [+parts[1] - 1, +parts[2]];
}

function getDaysUntil(birthDate: string): number {
  const now = new Date();
  const [bm, bd] = parseBDParts(birthDate);
  const next = new Date(now.getFullYear(), bm, bd);
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  const diff = Math.round((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 365 ? 0 : diff;
}

function fmtDate(birthDate: string) {
  const [bm, bd] = parseBDParts(birthDate);
  return new Date(new Date().getFullYear(), bm, bd).toLocaleDateString("es", { day: "numeric", month: "long" });
}

export default function BirthdayWidget({ userId: _userId }: { userId: string }) {
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);

  useEffect(() => {
    fetch("/api/feed?birthdayDays=30")
      .then((r) => r.json())
      .then(({ birthdays: raw }) => {
        const now = new Date();
        const entries: BirthdayEntry[] = ((raw as any[]) ?? []).map((p) => {
          const daysUntil = getDaysUntil(p.birth_date);
          const year = parseInt(p.birth_date.split("-")[0]);
          const age = year > 1900 ? now.getFullYear() - year + (daysUntil === 0 ? 0 : 0) : null;
          return {
            name: `${p.first_name} ${p.last_name || ""}`.trim(),
            birth_date: p.birth_date,
            daysUntil,
            age,
          };
        });
        entries.sort((a, b) => a.daysUntil - b.daysUntil);
        setBirthdays(entries);
      })
      .catch(() => {});
  }, []);

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
              {b.age !== null && <span className="text-gray-500 text-xs ml-1.5">· {b.age} años</span>}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">{fmtDate(b.birth_date)}</div>
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
