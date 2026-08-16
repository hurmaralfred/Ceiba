import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolveFamilyUserIds, resolveOrCreateFamilyGroupRoom } from "@/lib/server/family";
import webpush from "web-push";

/**
 * POST /api/sos
 * Body: { lat?: number; lon?: number }
 *
 * Complete server-side SOS delivery:
 * 1. Inserts into sos_alerts (existing DB trigger for FCM remains)
 * 2. Broadcasts to every family member's personal Realtime channel
 *    (ceiba-user-{recipientId}) so the in-app overlay fires even when
 *    the client channel is not connected to the shared presence channel
 * 3. Sends VAPID push to every registered subscription (locked-screen delivery)
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lat: number | null = body.lat ?? null;
  const lon: number | null = body.lon ?? null;

  const service = getServiceClient();

  // ── 1. Insert alert into DB (existing trigger fires FCM as bonus) ───────────
  const { error: rpcError } = await service
    .from("sos_alerts")
    .insert({
      triggered_by: user.id,
      status: "active",
      ...(lat != null && lon != null ? { location: `POINT(${lon} ${lat})` } : {}),
    });

  if (rpcError && rpcError.code !== "23505") {
    // 23505 = duplicate / cooldown — treat as non-fatal but still broadcast
    console.error("sos_alerts insert:", rpcError.message);
  }

  // ── 2. Resolve sender info ──────────────────────────────────────────────────
  const { data: senderClaim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", user.id)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  let senderName = "Tu familiar";
  if (senderClaim?.person_id) {
    const { data: p } = await service
      .from("persons")
      .select("first_name, last_name")
      .eq("id", senderClaim.person_id)
      .maybeSingle();
    if (p?.first_name) {
      senderName = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    }
  }
  if (!senderName || senderName === "Tu familiar") {
    const { data: prof } = await service
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    if (prof?.first_name) {
      senderName = [prof.first_name, prof.last_name].filter(Boolean).join(" ").trim();
    }
  }

  // ── 3. Resolve all family member user IDs (excluding sender) + group room ───
  const [allFamilyIds, groupRoomId] = await Promise.all([
    resolveFamilyUserIds(service, user.id),
    resolveOrCreateFamilyGroupRoom(service, user.id),
  ]);
  const recipientIds = allFamilyIds.filter(id => id !== user.id);

  if (recipientIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "Sin familiares registrados" });
  }

  const timestamp = Date.now();

  // ── 4. Server-side Realtime broadcast to each personal channel ──────────────
  await broadcastSOS(recipientIds, senderName, user.id, timestamp, lat, lon, groupRoomId);

  // ── 5. VAPID push — for locked screens and background tabs ─────────────────
  const vapidSent = await pushSOS(service, recipientIds, senderName, groupRoomId);

  return NextResponse.json({ ok: true, sent: vapidSent, recipients: recipientIds.length });
}

// ── Supabase REST broadcast ───────────────────────────────────────────────────

async function broadcastSOS(
  recipientIds: string[],
  senderName: string,
  senderUserId: string,
  timestamp: number,
  lat: number | null,
  lon: number | null,
  roomId: string | null,
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey || !anonKey) return;

  const messages = recipientIds.map(uid => ({
    topic:   `ceiba-user-${uid}`,
    event:   "sos_alert",
    payload: { senderName, senderUserId, timestamp, lat, lon, roomId },
  }));

  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey":        anonKey,
    },
    body: JSON.stringify({ messages }),
  }).catch(e => console.error("SOS broadcast failed:", e));
}

// ── VAPID push ────────────────────────────────────────────────────────────────

async function pushSOS(
  service: ReturnType<typeof getServiceClient>,
  recipientIds: string[],
  senderName: string,
  roomId: string | null,
): Promise<number> {
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return 0;

  const { data: subs } = await service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", recipientIds);

  if (!subs || subs.length === 0) return 0;

  webpush.setVapidDetails("mailto:ceiba-app@noreply.com", publicKey, privateKey);

  const payload = JSON.stringify({
    title: `🚨 ${senderName} — EMERGENCIA`,
    body:  "Activó una alerta SOS. Toca para ver en el mapa.",
    icon:  "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url:   "/mapa",
    type:  "sos",
    senderName,
    roomId,
    requireInteraction: true,
    vibrate: [500, 100, 500, 100, 500],
  });

  const results = await Promise.allSettled(
    (subs as any[]).map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    )
  );

  // Clean up expired subscriptions
  const deadEndpoints = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value?.statusCode >= 400)
    .map((_, i) => (subs as any[])[i]?.endpoint)
    .filter(Boolean);
  if (deadEndpoints.length > 0) {
    await service.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }

  return results.filter(r => r.status === "fulfilled").length;
}
