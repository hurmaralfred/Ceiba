"use client";
import { useEffect, useState, useCallback } from "react";

const EMOJIS = ["❤️", "😭", "✨", "😄"] as const;

interface Props {
  memoryId: string;
}

export default function MemoryReactions({ memoryId }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myEmoji, setMyEmoji] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/hoy/reactions?memoryId=${memoryId}`);
      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts ?? {});
        setMyEmoji(data.myEmoji ?? null);
      }
    } catch {}
  }, [memoryId]);

  useEffect(() => { load(); }, [load]);

  const react = async (emoji: string) => {
    if (loading) return;
    setLoading(true);

    // Optimistic update
    const prevCounts = { ...counts };
    const prevMy = myEmoji;
    const newCounts = { ...counts };

    if (myEmoji) {
      newCounts[myEmoji] = Math.max(0, (newCounts[myEmoji] ?? 1) - 1);
      if (newCounts[myEmoji] === 0) delete newCounts[myEmoji];
    }
    if (myEmoji !== emoji) {
      newCounts[emoji] = (newCounts[emoji] ?? 0) + 1;
      setMyEmoji(emoji);
    } else {
      setMyEmoji(null);
    }
    setCounts(newCounts);

    try {
      const res = await fetch("/api/hoy/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId, emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setCounts(data.counts ?? {});
        setMyEmoji(data.myEmoji ?? null);
      } else {
        // Rollback on error
        setCounts(prevCounts);
        setMyEmoji(prevMy);
      }
    } catch {
      setCounts(prevCounts);
      setMyEmoji(prevMy);
    } finally {
      setLoading(false);
    }
  };

  const hasAny = EMOJIS.some((e) => (counts[e] ?? 0) > 0);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      marginTop: 14, flexWrap: "wrap",
    }}>
      {EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const isMe = myEmoji === emoji;
        return (
          <button
            key={emoji}
            onClick={() => react(emoji)}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: count > 0 ? "5px 10px" : "5px 8px",
              borderRadius: 100,
              border: isMe
                ? "1.5px solid rgba(212,175,55,0.7)"
                : "1px solid rgba(255,255,255,0.1)",
              background: isMe
                ? "rgba(212,175,55,0.12)"
                : "rgba(255,255,255,0.04)",
              cursor: loading ? "default" : "pointer",
              fontSize: 16,
              lineHeight: 1,
              transition: "all 0.15s ease",
              transform: isMe ? "scale(1.08)" : "scale(1)",
            }}
          >
            <span>{emoji}</span>
            {count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: isMe ? "#d4af37" : "rgba(255,255,255,0.45)",
                lineHeight: 1,
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
      {!hasAny && (
        <span style={{
          fontSize: 10, color: "rgba(255,255,255,0.2)",
          letterSpacing: "0.04em", marginLeft: 2,
        }}>
          Sé el primero en reaccionar
        </span>
      )}
    </div>
  );
}
