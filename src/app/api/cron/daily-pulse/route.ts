import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function configureWebPush() {
  webpush.setVapidDetails(
    "mailto:ceiba-app@noreply.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

/** GET /api/cron/daily-pulse
 *  Runs at 9am UTC daily. For each user who has "on this day" memories
 *  from past years, sends one push notification. Birthday notifications
 *  are handled separately by /api/cron/birthdays (8am).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  configureWebPush();
  const supabase = getServiceClient();

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // 1. Get all memories (any year, same month+day) that have a family_space_id
  const { data: allMemories, error } = await supabase
    .from("family_memories")
    .select("id, family_space_id, author_user_id, body, memory_date, photo_path")
    .not("memory_date", "is", null)
    .not("family_space_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todayMemories = (allMemories ?? []).filter((m: any) => {
    const d = new Date(m.memory_date);
    return d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
  });

  if (todayMemories.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No memories for today" });
  }

  // 2. Get unique space_ids that have memories today
  const spaceIds = [...new Set(todayMemories.map((m: any) => m.family_space_id as string))];

  // 3. Get all members of those spaces
  const { data: memberships } = await supabase
    .from("space_memberships")
    .select("person_id, space_id")
    .in("space_id", spaceIds);

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // 4. Resolve person_id → user_id
  const personIds = [...new Set((memberships as any[]).map((m) => m.person_id as string))];
  const { data: claims } = await supabase
    .from("person_claims")
    .select("user_id, person_id")
    .in("person_id", personIds)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const personToUser = new Map<string, string>();
  for (const c of (claims ?? []) as any[]) {
    personToUser.set(c.person_id, c.user_id);
  }

  // space_id → [user_ids]
  const spaceUsers = new Map<string, string[]>();
  for (const m of (memberships as any[])) {
    const uid = personToUser.get(m.person_id);
    if (!uid) continue;
    if (!spaceUsers.has(m.space_id)) spaceUsers.set(m.space_id, []);
    if (!spaceUsers.get(m.space_id)!.includes(uid)) {
      spaceUsers.get(m.space_id)!.push(uid);
    }
  }

  // 5. Build per-user notification (pick best memory in their space)
  const userMemory = new Map<string, { body: string; yearsAgo: number }>();
  for (const mem of todayMemories as any[]) {
    const uids = spaceUsers.get(mem.family_space_id) ?? [];
    const yearsAgo = today.getFullYear() - new Date(mem.memory_date).getFullYear();
    if (yearsAgo < 1) continue; // skip memories from this year
    for (const uid of uids) {
      if (!userMemory.has(uid)) {
        userMemory.set(uid, { body: mem.body, yearsAgo });
      }
    }
  }

  if (userMemory.size === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "All memories are from this year" });
  }

  // 6. Get push subscriptions for those users
  const targetUserIds = [...userMemory.keys()];
  const { data: allSubs } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", targetUserIds);

  if (!allSubs || allSubs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No push subscriptions" });
  }

  // 7. Send one notification per user
  let sent = 0;
  const deadEndpoints: string[] = [];

  for (const [userId, { body, yearsAgo }] of userMemory) {
    const subs = (allSubs as any[]).filter((s) => s.user_id === userId);
    if (subs.length === 0) continue;

    const preview = body.length > 80 ? body.slice(0, 77) + "…" : body;
    const yearLabel = yearsAgo === 1 ? "hace 1 año" : `hace ${yearsAgo} años`;
    const payload = JSON.stringify({
      title: `✨ Un día como hoy, ${yearLabel}`,
      body: preview,
      icon: "/icons/icon-192.png",
      url: "/hoy",
    });

    const results = await Promise.allSettled(
      subs.map((sub: any) =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
          .then(() => ({ ok: true, endpoint: sub.endpoint as string }))
          .catch((err: any) => ({
            ok: false,
            endpoint: sub.endpoint as string,
            status: err?.statusCode as number | undefined,
          }))
      )
    );

    const successes = results.filter(
      (r): r is PromiseFulfilledResult<{ ok: boolean; endpoint: string }> =>
        r.status === "fulfilled" && r.value.ok
    ).length;
    sent += successes;

    deadEndpoints.push(
      ...(results as any[])
        .filter((r) => r.status === "fulfilled" && !r.value.ok && (r.value.status === 410 || r.value.status === 404))
        .map((r) => r.value.endpoint as string)
    );
  }

  if (deadEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }

  return NextResponse.json({ ok: true, sent, usersTargeted: userMemory.size });
}
