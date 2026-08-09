"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trophy, Zap } from "lucide-react";
import type { Achievement, GamificationStats } from "@/app/api/gamification/route";

export default function GamificationWidget() {
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/gamification")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl h-36 animate-pulse"
        style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(227,206,176,0.6)" }} />
    );
  }

  if (!stats) return null;

  const earnedAchievements = stats.achievements.filter((a) => a.earned);
  const nextAchievement = stats.achievements.find((a) => !a.earned && (a.progress ?? 0) > 0);
  const displayAchievements = expanded ? stats.achievements : stats.achievements.slice(0, 4);

  return (
    <div className="space-y-3">
      {/* Tree completion card */}
      <div className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.75)",
          boxShadow: "0 1px 4px rgba(193,96,58,0.10)",
          border: "1px solid rgba(227,206,176,0.6)",
        }}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <Trophy size={15} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-brown-800">Completitud de la galaxia</p>
                <p className="text-[11px] text-brown-400">{stats.totalPersons} personas · {earnedAchievements.length}/{stats.achievements.length} logros</p>
              </div>
            </div>
            <span className="text-xl font-bold text-ceiba-700">{stats.treeCompletion}%</span>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-ceiba-600 rounded-full transition-all duration-700"
              style={{ width: `${stats.treeCompletion}%` }}
            />
          </div>
        </div>

        {/* Weekly challenge */}
        {stats.weeklyChallenge && (
          <Link href={stats.weeklyChallenge.href}>
            <div className="flex items-center gap-3 px-4 py-3 border-t hover:bg-cream-50 transition-colors"
              style={{ borderColor: "rgba(238,223,198,0.8)" }}>
              <div className="w-8 h-8 rounded-xl bg-ceiba-100 flex items-center justify-center shrink-0">
                <Zap size={14} className="text-ceiba-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-brown-400 font-medium uppercase" style={{ letterSpacing: "0.06em" }}>Desafío de la semana</p>
                <p className="text-sm font-semibold text-brown-800 leading-tight">{stats.weeklyChallenge.text}</p>
              </div>
              <ChevronRight size={14} className="text-brown-300 shrink-0" />
            </div>
          </Link>
        )}
      </div>

      {/* Achievements grid */}
      <div className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.75)",
          boxShadow: "0 1px 4px rgba(193,96,58,0.10)",
          border: "1px solid rgba(227,206,176,0.6)",
        }}>
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "rgba(238,223,198,0.8)" }}>
          <p className="text-sm font-bold text-brown-800">Logros</p>
          <button onClick={() => setExpanded(!expanded)} className="text-[11px] text-earth-500 font-medium hover:text-earth-600">
            {expanded ? "Ver menos" : "Ver todos"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-0">
          {displayAchievements.map((ach, i) => (
            <AchievementCard key={ach.id} achievement={ach} index={i} total={displayAchievements.length} />
          ))}
        </div>

        {/* Next achievement progress */}
        {nextAchievement && !expanded && (
          <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(238,223,198,0.8)" }}>
            <p className="text-[11px] text-brown-400 mb-1.5">Próximo logro: <span className="font-semibold text-brown-600">{nextAchievement.name}</span></p>
            <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${(nextAchievement.progress ?? 0) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-brown-300 mt-1">{nextAchievement.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AchievementCard({ achievement, index, total }: { achievement: Achievement; index: number; total: number }) {
  const isRight = index % 2 === 1;
  const isLastRow = index >= total - (total % 2 === 0 ? 2 : 1);
  return (
    <div
      className={`flex flex-col items-center text-center px-3 py-3.5 ${
        !achievement.earned ? "opacity-40" : ""
      }`}
      style={{
        borderRight: !isRight ? "1px solid rgba(238,223,198,0.8)" : undefined,
        borderBottom: !isLastRow ? "1px solid rgba(238,223,198,0.8)" : undefined,
      }}
    >
      <div className={`text-2xl mb-1.5 ${achievement.earned ? "" : "grayscale"}`}>
        {achievement.emoji}
      </div>
      <p className={`text-xs font-bold leading-tight mb-0.5 ${achievement.earned ? "text-brown-800" : "text-brown-400"}`}>
        {achievement.name}
      </p>
      <p className="text-[10px] text-brown-300 leading-tight">{achievement.description}</p>
      {achievement.earned && (
        <div className="mt-1.5 w-4 h-4 rounded-full bg-ceiba-600 flex items-center justify-center">
          <span className="text-white text-[8px]">✓</span>
        </div>
      )}
    </div>
  );
}
