"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Tracks which user IDs in `familyUserIds` are currently online via
 * Supabase Realtime presence. The current user is automatically broadcast
 * as online while this hook is mounted.
 */
export function useFamilyPresence(myUserId: string | null, familyUserIds: string[]): Set<string> {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!myUserId) return;

    const supabase = createClient();
    const channel = supabase.channel("ceiba-family-presence", {
      config: { presence: { key: myUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string }>();
        const ids = new Set(
          Object.values(state)
            .flat()
            .map((p) => p.user_id)
            .filter(Boolean)
        );
        setOnlineIds(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: myUserId });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUserId]);

  return onlineIds;
}
