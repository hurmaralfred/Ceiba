import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolvePersonsByUserIds } from "@/lib/server/family";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * La pertenencia a la sala es la única puerta de acceso: tanto los grupos
 * (por family_space) como los directos tienen membresías reales en
 * chat_room_members. No hay salas globales de acceso implícito.
 */
async function assertMember(service: ReturnType<typeof getServiceClient>, roomId: string, userId: string) {
  const { data } = await service
    .from("chat_room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** GET /api/chat/rooms/[roomId]/messages — mensajes + remitente resuelto vía person_claims. */
export async function GET(_req: NextRequest, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const isMember = await assertMember(service, params.roomId, user.id);
  if (!isMember) return NextResponse.json({ error: "No perteneces a esta sala" }, { status: 403 });

  const { data: messages, error } = await service
    .from("chat_messages")
    .select("id, room_id, sender_user_id, body, media_url, created_at")
    .eq("room_id", params.roomId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const senderIds = [...new Set((messages ?? []).map((m) => m.sender_user_id as string))];
  const people = await resolvePersonsByUserIds(service, senderIds);

  const now = new Date().toISOString();
  await service
    .from("chat_room_members")
    .update({ last_read_at: now })
    .eq("room_id", params.roomId)
    .eq("user_id", user.id);

  // Partner's last_read_at (for read receipts on my own messages)
  const { data: partnerRow } = await service
    .from("chat_room_members")
    .select("last_read_at")
    .eq("room_id", params.roomId)
    .neq("user_id", user.id)
    .order("last_read_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const partnerLastReadAt: string | null = (partnerRow as any)?.last_read_at ?? null;

  // Reactions (graceful if table not yet created)
  const messageIds = (messages ?? []).map((m) => m.id as string);
  let reactionRows: any[] = [];
  if (messageIds.length > 0) {
    const { data: rx } = await service
      .from("chat_message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", messageIds);
    reactionRows = rx ?? [];
  }
  const reactionsByMessage: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
  for (const r of reactionRows) {
    const key = r.message_id as string;
    if (!reactionsByMessage[key]) reactionsByMessage[key] = [];
    const existing = reactionsByMessage[key].find((x) => x.emoji === r.emoji);
    if (existing) {
      existing.count++;
      if (r.user_id === user.id) existing.mine = true;
    } else {
      reactionsByMessage[key].push({ emoji: r.emoji, count: 1, mine: r.user_id === user.id });
    }
  }

  const enriched = (messages ?? []).map((m) => ({
    ...m,
    sender: people.get(m.sender_user_id) ?? null,
    reactions: reactionsByMessage[m.id as string] ?? [],
  })).reverse();

  return NextResponse.json({ messages: enriched, partnerLastReadAt });
}

/** POST /api/chat/rooms/[roomId]/messages — Body: { body: string } */
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!checkRateLimit(`chat-send:${user.id}`, 20, 60_000)) return rateLimitResponse();

  const { body } = await req.json();
  if (!body || !body.trim()) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const service = getServiceClient();
  const isMember = await assertMember(service, params.roomId, user.id);
  if (!isMember) return NextResponse.json({ error: "No perteneces a esta sala" }, { status: 403 });

  const { data: message, error } = await service
    .from("chat_messages")
    .insert({ room_id: params.roomId, sender_user_id: user.id, body: body.trim() })
    .select("id, room_id, sender_user_id, body, media_url, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve sender info once — used for both Realtime broadcast and push notification
  const { senderName, senderPhoto, otherIds } =
    await resolveSenderAndRecipients(service, params.roomId, user.id);

  // 1. Realtime broadcast — instant in-app delivery (fire-and-forget)
  broadcastNewMessage(params.roomId, otherIds, senderName, senderPhoto, body.trim()).catch(() => {});

  // 2. VAPID push — for locked-screen / background delivery (fire-and-forget)
  pushChatNotification(service, params.roomId, user.id, body.trim(), senderName, otherIds).catch(() => {});

  return NextResponse.json({ message });
}

/**
 * Broadcasts to:
 * 1. chat:{roomId}              — wakes the active chat-room page (payload empty, just a signal)
 * 2. ceiba-user-{recipientId}  — personal channel for each recipient; carries full message so
 *    FamilyPresenceContext can show the in-app shooting-star notification without extra fetches.
 */
async function broadcastNewMessage(
  roomId: string,
  recipientIds: string[],
  senderName: string,
  senderPhoto: string | null,
  body: string,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey || !anonKey) return;

  const messages: { topic: string; event: string; payload: object }[] = [
    // Room channel — keeps the active chat page in sync
    { topic: `chat:${roomId}`, event: "new_message", payload: {} },
    // Personal channels — one per recipient for the global notification
    ...recipientIds.map(uid => ({
      topic:   `ceiba-user-${uid}`,
      event:   "chat_message",
      payload: { senderName, senderPhoto, body, roomId },
    })),
  ];

  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey":        anonKey,
    },
    body: JSON.stringify({ messages }),
  });
}

// ── Shared resolver — called once per POST, results passed to both helpers ──────

async function resolveSenderAndRecipients(
  service: ReturnType<typeof getServiceClient>,
  roomId: string,
  senderUserId: string,
): Promise<{ senderName: string; senderPhoto: string | null; otherIds: string[] }> {
  const [memberships, senderClaim] = await Promise.all([
    service.from("chat_room_members").select("user_id").eq("room_id", roomId).neq("user_id", senderUserId),
    service.from("person_claims").select("person_id")
      .eq("user_id", senderUserId).eq("claim_status", "approved")
      .is("revoked_at", null).maybeSingle(),
  ]);

  const otherIds = ((memberships.data ?? []) as any[]).map(m => m.user_id as string);

  let senderName  = "Familiar";
  let senderPhoto: string | null = null;

  if (senderClaim.data?.person_id) {
    const { data: p } = await service
      .from("persons")
      .select("first_name, photo_path")
      .eq("id", senderClaim.data.person_id)
      .maybeSingle();
    if (p?.first_name) senderName  = p.first_name;
    if (p?.photo_path) senderPhoto = p.photo_path;
  }

  return { senderName, senderPhoto, otherIds };
}

// ── VAPID push — for locked screen / background tabs ─────────────────────────

async function pushChatNotification(
  service: ReturnType<typeof getServiceClient>,
  roomId: string,
  senderUserId: string,
  messageBody: string,
  senderName: string,
  otherIds: string[],
) {
  if (otherIds.length === 0) return;

  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;

  const { data: room } = await service.from("chat_rooms").select("type").eq("id", roomId).maybeSingle();
  const isGroup = (room as any)?.type === "group";

  const title   = isGroup ? `💬 ${senderName} (familia)` : `💬 ${senderName}`;
  const body    = messageBody.length > 120 ? messageBody.slice(0, 117) + "…" : messageBody;
  const payload = JSON.stringify({
    title, body,
    icon: "/icons/icon-192.png",
    url: `/chat/${roomId}`,
    badge: 1,
    type: "chat",
    roomId,
  });

  // VAPID — iOS PWA + Android Chrome + desktop
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", otherIds);

  if (subs && subs.length > 0) {
    webpush.setVapidDetails("mailto:ceiba-app@noreply.com", publicKey, privateKey);
    const results = await Promise.allSettled(
      (subs as any[]).map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ).then(() => ({ ok: true,  endpoint: sub.endpoint }))
         .catch((err: any) => ({ ok: false, endpoint: sub.endpoint, status: err?.statusCode }))
      )
    );
    const deadEndpoints = results
      .filter((r): r is PromiseFulfilledResult<{ ok: boolean; endpoint: string; status?: number }> => r.status === "fulfilled")
      .filter(r => !r.value.ok && (r.value.status === 410 || r.value.status === 404))
      .map(r => r.value.endpoint);
    if (deadEndpoints.length > 0) {
      await service.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
    }
  }

  // FCM — optional fallback when FIREBASE_SERVICE_ACCOUNT_JSON is configured
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const { data: tokenRows } = await service.from("push_tokens").select("token").in("user_id", otherIds);
      if (tokenRows && tokenRows.length > 0) {
        const sa = JSON.parse(serviceAccountJson);
        const now = Math.floor(Date.now() / 1000);
        const header   = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
        const claimset = Buffer.from(JSON.stringify({
          iss: sa.client_email,
          scope: "https://www.googleapis.com/auth/firebase.messaging",
          aud: "https://oauth2.googleapis.com/token",
          exp: now + 3600, iat: now,
        })).toString("base64url");

        const { createSign } = await import("crypto");
        const sign = createSign("RSA-SHA256");
        sign.update(`${header}.${claimset}`);
        const sig = sign.sign(sa.private_key, "base64url");
        const jwt = `${header}.${claimset}.${sig}`;

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
        });
        const { access_token } = await tokenRes.json();

        await Promise.allSettled(
          (tokenRows as any[]).map(row =>
            fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` },
              body: JSON.stringify({
                message: {
                  token: row.token,
                  notification: { title, body },
                  webpush: { fcm_options: { link: "/chat" } },
                },
              }),
            })
          )
        );
      }
    } catch { /* FCM is optional */ }
  }
}
