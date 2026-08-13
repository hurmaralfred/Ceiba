"use client";
import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface AlertPayload {
  sender_id: string;
  sender_name: string;
  message: string;
  type: "sos" | "announcement";
  timestamp: number;
}

interface FamilyPresenceContextValue {
  onlineIds: Set<string>;
  broadcastAlert: (opts: { message: string; type?: "sos" | "announcement" }) => Promise<void>;
}

const FamilyPresenceCtx = createContext<FamilyPresenceContextValue>({
  onlineIds: new Set(),
  broadcastAlert: async () => {},
});

export function FamilyPresenceProvider({ children }: { children: ReactNode }) {
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState("Tu familiar");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const supabase = supabaseRef.current;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setMyUserId(data.user.id);
      supabase
        .from("profiles")
        .select("first_name")
        .eq("id", data.user.id)
        .single()
        .then(({ data: p }) => {
          if (p?.first_name) setMyName(p.first_name);
        });
    });
  }, []);

  useEffect(() => {
    if (!myUserId) return;
    const supabase = supabaseRef.current;

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
            .filter(Boolean),
        );
        setOnlineIds(ids);
      })
      .on("broadcast", { event: "family-alert" }, ({ payload }: { payload: AlertPayload }) => {
        if (payload.sender_id === myUserId) return;
        const isSOS = payload.type === "sos";
        toast(
          isSOS
            ? `🚨 ${payload.sender_name} activó una alerta SOS`
            : `📢 ${payload.sender_name}: ${payload.message}`,
          {
            duration: isSOS ? 12000 : 7000,
            style: isSOS
              ? { background: "#7f1d1d", color: "#fff", fontWeight: 600, fontSize: 14 }
              : { background: "#12082a", color: "#fff", fontSize: 14 },
          },
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: myUserId });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [myUserId]);

  // ── In-app toast from service worker push events ──────────────────────────
  // The SW always shows the system notification AND forwards the payload here.
  // We show a toast so the user sees it even while using the app.
  useEffect(() => {
    if (!myUserId || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "ceiba-push") return;
      const d = event.data.payload as {
        title: string; body: string; url?: string;
        type?: string; roomId?: string;
      };

      const isSOS  = d.type === "sos";
      const isChat = d.type === "chat";

      // Don't re-toast Realtime SOS alerts we already showed via broadcastAlert
      if (isSOS) return;

      toast(
        () => (
          <div
            onClick={() => { if (d.url) window.location.href = d.url; }}
            style={{ cursor: d.url ? "pointer" : "default" }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{d.title}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{d.body}</div>
          </div>
        ),
        {
          duration: isChat ? 8000 : 6000,
          style: isChat
            ? { background: "#12082a", color: "#fff", padding: "10px 14px" }
            : { background: "#1a1040", color: "#fff", padding: "10px 14px" },
        },
      );
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [myUserId]);

  const broadcastAlert = useCallback(
    async ({ message, type = "announcement" }: { message: string; type?: "sos" | "announcement" }) => {
      if (!channelRef.current || !myUserId) return;
      await channelRef.current.send({
        type: "broadcast",
        event: "family-alert",
        payload: {
          sender_id: myUserId,
          sender_name: myName,
          message,
          type,
          timestamp: Date.now(),
        } satisfies AlertPayload,
      });
    },
    [myUserId, myName],
  );

  return (
    <FamilyPresenceCtx.Provider value={{ onlineIds, broadcastAlert }}>
      {children}
    </FamilyPresenceCtx.Provider>
  );
}

export function useFamilyPresenceContext() {
  return useContext(FamilyPresenceCtx);
}
