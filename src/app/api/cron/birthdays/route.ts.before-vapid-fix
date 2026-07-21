import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendBirthdayEmail } from "@/lib/email";

webpush.setVapidDetails(
  "mailto:ceiba-app@noreply.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Load all members with birth_date
  const { data: members, error } = await supabase
    .from("family_members")
    .select("id, first_name, last_name, birth_date, added_by")
    .not("birth_date", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todayBirthdays = (members || []).filter(
    (m) => m.birth_date && (m.birth_date as string).slice(5) === mmdd
  );

  if (todayBirthdays.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No birthdays today" });
  }

  // Group by owner
  const byOwner = todayBirthdays.reduce((acc, m) => {
    if (!acc[m.added_by]) acc[m.added_by] = [];
    acc[m.added_by].push(m);
    return acc;
  }, {} as Record<string, typeof todayBirthdays>);

  let pushSent = 0;
  let emailSent = 0;

  for (const [ownerId, birthdayMembers] of Object.entries(byOwner)) {
    // Get owner profile (for email)
    const { data: owner } = await supabase
      .from("profiles")
      .select("first_name, email")
      .eq("id", ownerId)
      .single();

    // 1. Push notification
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", ownerId);

    if (subs && subs.length > 0) {
      const names = birthdayMembers.map((m) => m.first_name).join(", ");
      const body =
        birthdayMembers.length === 1
          ? `¡Hoy es el cumpleaños de ${birthdayMembers[0].first_name} ${birthdayMembers[0].last_name || ""}! 🎂`
          : `¡Hoy cumplen años ${names}! 🎂`;

      const payload = JSON.stringify({
        title: "🎂 Cumpleaños familiar",
        body,
        icon: "/icons/icon-192.png",
        url: "/feed",
      });

      const results = await Promise.allSettled(
        subs.map((sub) =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
        )
      );
      pushSent += results.filter((r) => r.status === "fulfilled").length;
    }

    // 2. Email notification
    if (owner?.email) {
      try {
        await sendBirthdayEmail(owner.email, owner.first_name, birthdayMembers as any);
        emailSent++;
      } catch (e) {
        console.error("Birthday email failed for", ownerId, e);
      }
    }
  }

  return NextResponse.json({ ok: true, pushSent, emailSent, checked: todayBirthdays.length });
}
