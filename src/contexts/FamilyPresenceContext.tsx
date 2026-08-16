"use client";
import {
  createContext, useContext, useEffect, useState,
  useRef, ReactNode, useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { SOSOverlay } from "@/components/SOSOverlay";
import { ChatBubbleNotification } from "@/components/ChatBubbleNotification";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AlertPayload {
  sender_id: string;
  sender_name: string;
  message: string;
  type: "sos" | "announcement";
  timestamp: number;
}

interface ActiveSOS {
  senderName: string;
  timestamp: number;
}

interface ChatNotification {
  senderName: string;
  senderPhoto: string | null;
  message: string;
  roomId: string;
}

interface FamilyPresenceContextValue {
  onlineIds: Set<string>;
  broadcastAlert: (opts: { message: string; type?: "sos" | "announcement" }) => Promise<void>;
  setActiveChatRoom: (roomId: string | null) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SOS_STORAGE_KEY = "ceiba-sos-alert";
const SOS_TTL_MS = 5 * 60 * 1000;
const GRACE_MS   = 3 * 60 * 1000; // Keep recently-left users in online set 3 min
const DEDUP_MS   = 6_000;         // Suppress duplicate chat notifs within 6 s

// ── Context ───────────────────────────────────────────────────────────────────

const FamilyPresenceCtx = createContext<FamilyPresenceContextValue>({
  onlineIds: new Set(),
  broadcastAlert: async () => {},
  setActiveChatRoom: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function FamilyPresenceProvider({ children }: { children: ReactNode }) {
  const [myUserId,  setMyUserId]  = useState<string | null>(null);
  const [myName,    setMyName]    = useState("Tu familiar");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [activeSOS, setActiveSOS] = useState<ActiveSOS | null>(null);
  const [chatNotif, setChatNotif] = useState<ChatNotification | null>(null);

  const channelRef        = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const activeChatRoomRef = useRef<string | null>(null);
  const supabaseRef       = useRef(createClient());
  const graceRef          = useRef<Map<string, number>>(new Map());
  // Deduplication: track last notif key so Realtime + SW don't double-fire
  const lastChatKeyRef    = useRef<{ key: string; at: number } | null>(null);

  // ── Restore missed SOS on app open ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SOS_STORAGE_KEY);
      if (!raw) return;
      const parsed: ActiveSOS = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < SOS_TTL_MS) setActiveSOS(parsed);
      else localStorage.removeItem(SOS_STORAGE_KEY);
    } catch { localStorage.removeItem(SOS_STORAGE_KEY); }
  }, []);

  // ── Auth + sender name ─────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = supabaseRef.current;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setMyUserId(data.user.id);
      supabase.from("profiles").select("first_name").eq("id", data.user.id).single()
        .then(({ data: p }) => { if (p?.first_name) setMyName(p.first_name); });
    });
  }, []);

  // ── SOS helpers ────────────────────────────────────────────────────────────
  const showSOS = useCallback((sos: ActiveSOS) => {
    setActiveSOS(sos);
    try { localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(sos)); } catch {}
  }, []);

  const dismissSOS = useCallback(() => {
    setActiveSOS(null);
    try { localStorage.removeItem(SOS_STORAGE_KEY); } catch {}
  }, []);

  // ── Chat notification with deduplication ───────────────────────────────────
  const showChatNotif = useCallback((notif: ChatNotification) => {
    if (activeChatRoomRef.current === notif.roomId) return; // in that room already
    // Dedup: same room+message within DEDUP_MS window = skip
    const key = `${notif.roomId}:${notif.message.slice(0, 30)}`;
    const now = Date.now();
    if (lastChatKeyRef.current?.key === key && now - lastChatKeyRef.current.at < DEDUP_MS) return;
    lastChatKeyRef.current = { key, at: now };
    setChatNotif(notif);
  }, []);

  // ── Presence + family-alert channel ────────────────────────────────────────
  useEffect(() => {
    if (!myUserId) return;
    const supabase = supabaseRef.current;
    const channel  = supabase.channel("ceiba-family-presence", {
      config: { presence: { key: myUserId } },
    });

    const rebuildOnlineIds = () => {
      const state   = channel.presenceState<{ user_id: string }>();
      const liveIds = new Set(
        Object.values(state).flat().map(p => p.user_id).filter(Boolean),
      );
      const now = Date.now();
      for (const [uid, leaveAt] of [...graceRef.current.entries()]) {
        if (now - leaveAt > GRACE_MS) graceRef.current.delete(uid);
        else liveIds.add(uid);
      }
      setOnlineIds(liveIds);
    };

    channel
      .on("presence", { event: "sync" }, rebuildOnlineIds)
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const now = Date.now();
        for (const p of leftPresences as any[]) {
          if (p.user_id && p.user_id !== myUserId) graceRef.current.set(p.user_id, now);
        }
        rebuildOnlineIds();
      })
      .on("broadcast", { event: "family-alert" }, ({ payload }: { payload: AlertPayload }) => {
        if (payload.sender_id === myUserId) return;
        if (payload.type === "sos") {
          showSOS({ senderName: payload.sender_name, timestamp: payload.timestamp });
        } else {
          toast(`📢 ${payload.sender_name}: ${payload.message}`, {
            duration: 7000,
            style: { background: "#12082a", color: "#fff", fontSize: 14 },
          });
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ user_id: myUserId });
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [myUserId, showSOS]);

  // ── Personal channel — server-side SOS + chat delivery ────────────────────
  // Server broadcasts to ceiba-user-{myUserId} via the Supabase REST API.
  // This works independently of whether the shared presence channel is active.
  useEffect(() => {
    if (!myUserId) return;
    const supabase = supabaseRef.current;

    const ch = supabase
      .channel(`ceiba-user-${myUserId}`)
      .on("broadcast", { event: "sos_alert" }, ({ payload }: {
        payload: { senderName: string; timestamp: number };
      }) => {
        showSOS({ senderName: payload.senderName, timestamp: payload.timestamp });
      })
      .on("broadcast", { event: "chat_message" }, ({ payload }: {
        payload: { senderName: string; senderPhoto: string | null; body: string; roomId: string; };
      }) => {
        showChatNotif({
          senderName:  payload.senderName,
          senderPhoto: payload.senderPhoto,
          message:     payload.body,
          roomId:      payload.roomId,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [myUserId, showSOS, showChatNotif]);

  // ── Service Worker push → in-app fallback ─────────────────────────────────
  // VAPID push arrives when the phone is locked or app is backgrounded.
  // The SW forwards the payload here so we can show the in-app overlay/notif
  // even when the user returns to the app. Deduplication prevents double-fire
  // if Realtime already handled the same message.
  useEffect(() => {
    if (!myUserId || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "ceiba-push") return;
      const d = event.data.payload as {
        title: string; body: string; url?: string;
        type?: string; roomId?: string; senderName?: string;
      };

      if (d.type === "sos") {
        const name = d.senderName ?? d.title?.split("—")?.[1]?.trim() ?? "Tu familiar";
        showSOS({ senderName: name, timestamp: Date.now() });
        return;
      }

      if (d.type === "chat") {
        // Extract sender name from title: "💬 Alfredo" → "Alfredo"
        const raw  = d.title ?? "";
        const name = raw.replace(/^💬\s*/, "").replace(/\s*\(familia\)$/, "").trim() || "Familiar";
        showChatNotif({
          senderName:  name,
          senderPhoto: null,          // VAPID payload doesn't carry photos
          message:     d.body ?? "",
          roomId:      d.roomId ?? "",
        });
        return;
      }

      // Announcements and other push types
      toast(
        () => (
          <div onClick={() => { if (d.url) window.location.href = d.url; }}
            style={{ cursor: d.url ? "pointer" : "default" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{d.title}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{d.body}</div>
          </div>
        ),
        { duration: 6000, style: { background: "#1a1040", color: "#fff", padding: "10px 14px" } },
      );
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [myUserId, showSOS, showChatNotif]);

  // ── broadcastAlert (announcements from tree page) ──────────────────────────
  const broadcastAlert = useCallback(
    async ({ message, type = "announcement" }: { message: string; type?: "sos" | "announcement" }) => {
      if (!channelRef.current || !myUserId) return;
      await channelRef.current.send({
        type: "broadcast",
        event: "family-alert",
        payload: {
          sender_id: myUserId, sender_name: myName,
          message, type, timestamp: Date.now(),
        } satisfies AlertPayload,
      });
    },
    [myUserId, myName],
  );

  // ── setActiveChatRoom ──────────────────────────────────────────────────────
  const setActiveChatRoom = useCallback((roomId: string | null) => {
    activeChatRoomRef.current = roomId;
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <FamilyPresenceCtx.Provider value={{ onlineIds, broadcastAlert, setActiveChatRoom }}>
      {children}

      {activeSOS && (
        <SOSOverlay
          senderName={activeSOS.senderName}
          timestamp={activeSOS.timestamp}
          onDismiss={dismissSOS}
        />
      )}

      {chatNotif && (
        <ChatBubbleNotification
          key={`${chatNotif.roomId}-${chatNotif.message.slice(0, 20)}`}
          senderName={chatNotif.senderName}
          senderPhoto={chatNotif.senderPhoto}
          message={chatNotif.message}
          roomId={chatNotif.roomId}
          onDismiss={() => setChatNotif(null)}
        />
      )}
    </FamilyPresenceCtx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFamilyPresenceContext() {
  return useContext(FamilyPresenceCtx);
}
