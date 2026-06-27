import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient as createServerClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  "mailto:ceiba-app@noreply.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Service-role client — bypasses RLS so we can read all rows
function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  // Protect with Vercel cron secret or internal secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Find all family members whose birthday is today (any year)
  // Using to_char to compare only month+day
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data: members, error } = await supabase
    .from("family_members")
    .select("id, first_name, last_name, birth_date, added_by")
    .not("birth_date", "is", null);

  if (error) {
    console.error("Birthday cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter in JS (avoids needing to_char RPC)
  const todayBirthdays = (members || []).filter((m) => {
    if (!m.birth_date) return false;
    const bd = m.birth_date as string; // "YYYY-MM-DD"
    return bd.slice(5) === mmdd; // "MM-DD"
  });

  if (todayBirthdays.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No birthdays today" });
  }

  // Group by added_by so we send one notification per owner per batch
  const byOwner = todayBirthdays.reduce((acc, m) => {
    if (!acc[m.added_by]) acc[m.added_by] = [];
    acc[m.added_by].push(m);
    return acc;
  }, {} as Record<string, typeof todayBirthdays>);

  let totalSent = 0;

  for (const [ownerId, birthdayMembers] of Object.entries(byOwner)) {
    // Get push subscriptions for this owner
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", ownerId);

    if (!subs || subs.length === 0) continue;

    // Build notification message
    const names = birthdayMembers.map((m) => m.first_name).join(", ");
    const count = birthdayMembers.length;
    const body =
      count === 1
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

    totalSent += results.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({ ok: true, sent: totalSent, checked: todayBirthdays.length });
}
