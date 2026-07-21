import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:ceiba-app@noreply.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

/**
 * POST /api/presence
 * Body: { lat?, lng?, checkin?: boolean, pause?: boolean }
 *
 * - Siempre actualiza last_seen_at
 * - Si lat/lng presentes y location_sharing=true: actualiza live_lat/lng/location_at
 * - Si checkin=true: además envía push notification "Llegué bien" a toda la familia
 * - Si pause=true: desactiva location_sharing
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lat, lng, checkin = false, pause = false } = await req.json();

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  // Build update payload
  const update: Record<string, any> = { last_seen_at: now };
  if (pause) {
    update.location_sharing = false;
  } else if (lat != null && lng != null) {
    update.live_lat = lat;
    update.live_lng = lng;
    update.live_location_at = now;
    update.location_sharing = true;
  }

  await service.from("profiles").update(update).eq("id", user.id);

  // If checkin: send push to all family
  if (checkin && lat != null && lng != null) {
    const { data: me } = await service
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();
    const name = me ? `${me.first_name} ${me.last_name || ""}`.trim() : "Un familiar";

    // Get all connected family members
    const { data: direct } = await service
      .from("family_members")
      .select("profile_id")
      .eq("added_by", user.id)
      .not("profile_id", "is", null);

    const { data: reverse } = await service
      .from("family_members")
      .select("added_by")
      .eq("profile_id", user.id);

    const directIds = (direct || []).map(m => m.profile_id as string);
    const reverseIds = (reverse || []).map(m => m.added_by as string);
    const recipientIds = [...new Set([...directIds, ...reverseIds])].filter(id => id !== user.id);

    if (recipientIds.length > 0) {
      const { data: subs } = await service
        .from("push_subscriptions")
        .select("*")
        .in("user_id", recipientIds);

      const payload = JSON.stringify({
        title: `✅ ${name} llegó bien`,
        body: "Ver su ubicación en el mapa familiar",
        icon: "/icons/icon-192.png",
        url: "/live",
      });

      await Promise.allSettled(
        (subs || []).map(sub =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
        )
      );
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/presence
 * Returns last_seen, live location, location_sharing for all connected family members
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all connected family profile IDs
  const { data: direct } = await service
    .from("family_members")
    .select("profile_id, first_name, last_name, relation_type")
    .eq("added_by", user.id)
    .not("profile_id", "is", null);

  const { data: reverse } = await service
    .from("family_members")
    .select("added_by, first_name, last_name, relation_type")
    .eq("profile_id", user.id);

  const directIds = (direct || []).map(m => m.profile_id as string);
  const reverseIds = (reverse || []).map(m => m.added_by as string);
  const allIds = [...new Set([...directIds, ...reverseIds])].filter(id => id !== user.id);

  if (allIds.length === 0) return NextResponse.json({ members: [] });

  const { data: profiles } = await service
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, last_seen_at, live_lat, live_lng, live_location_at, location_sharing")
    .in("id", allIds);

  // Merge relation info
  const relationMap: Record<string, string> = {};
  for (const m of direct || []) {
    if (m.profile_id) relationMap[m.profile_id] = m.relation_type;
  }
  for (const m of reverse || []) {
    if (m.added_by && !relationMap[m.added_by]) relationMap[m.added_by] = m.relation_type;
  }

  const members = (profiles || []).map(p => ({
    ...p,
    relation_type: relationMap[p.id] ?? "family",
  }));

  return NextResponse.json({ members });
}
