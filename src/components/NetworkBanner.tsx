"use client";
import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";

interface Props {
  totalMembers: number;
  joinedMembers: number;
}

export default function NetworkBanner({ totalMembers, joinedMembers }: Props) {
  if (totalMembers === 0) return null;

  const pct = totalMembers > 0 ? Math.round((joinedMembers / totalMembers) * 100) : 0;
  const remaining = totalMembers - joinedMembers;

  // Message based on progress
  let message = "";
  if (joinedMembers === 0) {
    message = "Invita a tu familia para conectar el árbol";
  } else if (pct < 30) {
    message = `${remaining} familiar${remaining !== 1 ? "es" : ""} aún no ha entrado`;
  } else if (pct < 70) {
    message = "Tu familia está creciendo en Ceiba";
  } else {
    message = "¡Casi toda tu familia está conectada!";
  }

  return (
    <Link href="/invite">
      <div className="rounded-2xl bg-gradient-to-r from-ceiba-800 to-ceiba-600 px-4 py-3 mb-3 flex items-center gap-3 active:scale-[0.98] transition-transform shadow-sm">
        {/* Icon */}
        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Users size={18} className="text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-white/90">{message}</span>
            <span className="text-xs font-bold text-white ml-2 shrink-0">
              {joinedMembers}/{totalMembers}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
        </div>

        <ChevronRight size={16} className="text-white/60 shrink-0" />
      </div>
    </Link>
  );
}
