import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendBirthdayEmail } from "@/lib/email";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // 1. Find all persons with today's birthday (month-day match on persons table)
  const { data: birthdayPersons, error: personsError } = await supabase
    .from("persons")
    .select("id, first_name, first_surname, birth_date")
    .not("birth_date", "is", null)
    .filter("birth_date", "ilike", `%-${mmdd}`);

  if (personsError) return NextResponse.json({ error: personsError.message }, { status: 500 });
  if (!birthdayPersons || birthdayPersons.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No birthdays today" });
  }

  const bpIds = (birthdayPersons as any[]).map((p) => p.id as string);

  // 2. Get family spaces for birthday persons
  const { data: bpMemberships } = await supabase
    .from("space_memberships")
    .select("person_id, space_id")
    .in("person_id", bpIds);

  if (!bpMemberships || bpMemberships.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "Birthday persons not in any space" });
  }

  // person_id → space_ids (for birthday persons)
  const personSpaces = new Map<string, string[]>();
  for (const m of bpMemberships as any[]) {
    if (!personSpaces.has(m.person_id)) personSpaces.set(m.person_id, []);
    personSpaces.get(m.person_id)!.push(m.space_id);
  }

  // 3. Get all persons in those spaces
  const allSpaceIds = [...new Set((bpMemberships as any[]).map((m) => m.space_id as string))];
  const { data: allSpaceMembers } = await supabase
    .from("space_memberships")
    .select("person_id, space_id")
    .in("space_id", allSpaceIds);

  // space_id → person_ids (everyone in each space)
  const spacePersons = new Map<string, string[]>();
  for (const m of (allSpaceMembers ?? []) as any[]) {
    if (!spacePersons.has(m.space_id)) spacePersons.set(m.space_id, []);
    spacePersons.get(m.space_id)!.push(m.person_id);
  }

  // 4. Get user_ids for all family persons via approved person_claims
  const allPersonIds = [...new Set((allSpaceMembers ?? []).map((m: any) => m.person_id as string))];
  const { data: claims } = await supabase
    .from("person_claims")
    .select("user_id, person_id")
    .in("person_id", allPersonIds)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const personToUser = new Map<string, string>();
  for (const c of (claims ?? []) as any[]) {
    personToUser.set(c.person_id, c.user_id);
  }

  // 5. Build notify map: userId → birthday persons in their family space
  const notifyMap = new Map<string, typeof birthdayPersons>();
  for (const bp of birthdayPersons as any[]) {
    const spaces = personSpaces.get(bp.id) ?? [];
    for (const spaceId of spaces) {
      const familyPersonIds = spacePersons.get(spaceId) ?? [];
      for (const personId of familyPersonIds) {
        const userId = personToUser.get(personId);
        if (!userId) continue;
        if (!notifyMap.has(userId)) notifyMap.set(userId, []);
        const existing = notifyMap.get(userId)!;
        if (!(existing as any[]).find((e: any) => e.id === bp.id)) existing.push(bp);
      }
    }
  }

  // 6. Send push notification + email to each user
  const vapidPublicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidConfigured = !!(vapidPublicKey && vapidPrivateKey);
  if (!vapidConfigured) {
    console.warn("[birthday-cron] VAPID keys not configured — push notifications will be skipped");
  } else {
    webpush.setVapidDetails("mailto:ceiba-app@noreply.com", vapidPublicKey!, vapidPrivateKey!);
  }

  let pushSent = 0, emailSent = 0;
  const deadEndpoints: string[] = [];

  for (const [userId, persons] of notifyMap) {
    const bpList = persons as any[];
    const names = bpList.map((p) => p.first_name).join(", ");
    const pushBody =
      bpList.length === 1
        ? `¡Hoy es el cumpleaños de ${bpList[0].first_name} ${bpList[0].first_surname || ""}! 🎂`
        : `¡Hoy cumplen años ${names}! 🎂`;

    // Push
    if (vapidConfigured) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);

      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: "🎂 Cumpleaños familiar",
          body: pushBody,
          icon: "/icons/icon-192.png",
          url: "/feed",
        });
        const results = await Promise.allSettled(
          (subs as any[]).map((sub) =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
              .then(() => ({ ok: true, endpoint: sub.endpoint as string }))
              .catch((err: any) => ({ ok: false, endpoint: sub.endpoint as string, status: err?.statusCode as number | undefined }))
          )
        );
        pushSent += results.filter(
          (r): r is PromiseFulfilledResult<{ ok: boolean; endpoint: string }> =>
            r.status === "fulfilled" && r.value.ok
        ).length;
        // Collect dead subscriptions (410 Gone or 404 Not Found) for cleanup
        deadEndpoints.push(
          ...results
            .filter((r): r is PromiseFulfilledResult<{ ok: boolean; endpoint: string; status?: number }> => r.status === "fulfilled")
            .filter((r) => !r.value.ok && (r.value.status === 410 || r.value.status === 404))
            .map((r) => r.value.endpoint)
        );
      }
    }

    // Email (via auth.admin to get verified email)
    try {
      const { data: authData } = await supabase.auth.admin.getUserById(userId);
      const email = authData?.user?.email;
      const displayName =
        authData?.user?.user_metadata?.full_name ||
        authData?.user?.user_metadata?.name ||
        "familiar";
      if (email) {
        await sendBirthdayEmail(
          email,
          displayName,
          bpList.map((p) => ({
            first_name: p.first_name,
            last_name: p.first_surname || "",
            birth_date: p.birth_date,
          }))
        );
        emailSent++;
      }
    } catch (e) {
      console.error("Birthday email failed for", userId, e);
    }
  }

  // Clean up expired/invalid push subscriptions (410 Gone or 404 Not Found)
  if (deadEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
    console.log(`[birthday-cron] Removed ${deadEndpoints.length} dead push subscription(s)`);
  }

  return NextResponse.json({ ok: true, pushSent, emailSent, birthdayCount: birthdayPersons.length });
}
