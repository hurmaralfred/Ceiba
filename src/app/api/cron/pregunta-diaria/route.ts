import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { generateAndCacheQuestion, getDayTheme } from "@/lib/preguntaDiaria";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function configureWebPush() {
  webpush.setVapidDetails(
    "mailto:ceiba-app@noreply.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/** GET /api/cron/pregunta-diaria
 *  Runs at 7am UTC daily.
 *  1. Generates and caches the question of the day for every active family space.
 *  2. Sends a push notification to all members of each space with the question.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  configureWebPush();
  const supabase = getServiceClient();

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // "YYYY-MM-DD"
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000,
  );

  // 1. Get all active family spaces
  const { data: spaces, error: spacesErr } = await supabase
    .from("family_spaces")
    .select("id")
    .eq("status", "active");

  if (spacesErr) return NextResponse.json({ error: spacesErr.message }, { status: 500 });
  if (!spaces || spaces.length === 0) {
    return NextResponse.json({ ok: true, spaces: 0, sent: 0 });
  }

  const spaceIds = (spaces as any[]).map((s) => s.id as string);

  // 2. Generate and cache today's question for every space (in parallel, batched)
  const spaceQuestions = new Map<string, string>();
  const BATCH = 5; // avoid overwhelming the AI API
  for (let i = 0; i < spaceIds.length; i += BATCH) {
    const batch = spaceIds.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (spaceId) => {
        const q = await generateAndCacheQuestion(supabase, spaceId, todayStr, dayOfYear);
        return { spaceId, q };
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled") spaceQuestions.set(r.value.spaceId, r.value.q);
    }
  }

  // 3. Get all members of those spaces
  const { data: memberships } = await supabase
    .from("space_memberships")
    .select("person_id, space_id")
    .in("space_id", spaceIds);

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ ok: true, spaces: spaceIds.length, sent: 0, message: "No members" });
  }

  // 4. Resolve person_id → user_id via approved person_claims
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
  for (const m of memberships as any[]) {
    const uid = personToUser.get(m.person_id);
    if (!uid) continue;
    if (!spaceUsers.has(m.space_id)) spaceUsers.set(m.space_id, []);
    const arr = spaceUsers.get(m.space_id)!;
    if (!arr.includes(uid)) arr.push(uid);
  }

  // user_id → space_id (first one wins — they get one notification per day)
  const userSpace = new Map<string, string>();
  for (const [spaceId, userIds] of spaceUsers) {
    for (const uid of userIds) {
      if (!userSpace.has(uid)) userSpace.set(uid, spaceId);
    }
  }

  if (userSpace.size === 0) {
    return NextResponse.json({ ok: true, spaces: spaceIds.length, sent: 0, message: "No claimed users" });
  }

  // 5. Get push subscriptions for all target users
  const targetUserIds = [...userSpace.keys()];
  const { data: allSubs } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", targetUserIds);

  if (!allSubs || allSubs.length === 0) {
    return NextResponse.json({ ok: true, spaces: spaceIds.length, sent: 0, message: "No push subscriptions" });
  }

  // 6. Send one notification per user
  const themeLabel = getDayTheme(dayOfYear).theme;
  let sent = 0;
  const deadEndpoints: string[] = [];

  for (const [userId, spaceId] of userSpace) {
    const subs = (allSubs as any[]).filter((s) => s.user_id === userId);
    if (subs.length === 0) continue;

    const question = spaceQuestions.get(spaceId);
    if (!question) continue;

    const preview = question.length > 100 ? question.slice(0, 97) + "…" : question;
    const payload = JSON.stringify({
      title: "💬 Pregunta del día",
      body: preview,
      icon: "/icons/icon-192.png",
      url: "/muro",
      tag: `pregunta-${todayStr}`, // dedupes if multiple arrive
    });

    const results = await Promise.allSettled(
      subs.map((sub: any) =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
          .then(() => ({ ok: true, endpoint: sub.endpoint as string }))
          .catch((err: any) => ({
            ok: false,
            endpoint: sub.endpoint as string,
            status: err?.statusCode as number | undefined,
          })),
      ),
    );

    const successes = results.filter(
      (r): r is PromiseFulfilledResult<{ ok: boolean; endpoint: string }> =>
        r.status === "fulfilled" && r.value.ok,
    ).length;
    sent += successes;

    deadEndpoints.push(
      ...(results as any[])
        .filter(
          (r) =>
            r.status === "fulfilled" &&
            !r.value.ok &&
            (r.value.status === 410 || r.value.status === 404),
        )
        .map((r) => r.value.endpoint as string),
    );
  }

  if (deadEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }

  return NextResponse.json({
    ok: true,
    spaces: spaceIds.length,
    questionsGenerated: spaceQuestions.size,
    usersTargeted: userSpace.size,
    sent,
    theme: themeLabel,
    date: todayStr,
  });
}
