import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

webpush.setVapidDetails(
  "mailto:ceiba-app@noreply.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  // Validate internal secret so only our app can call this
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { invitedBy, joinerName, relationLabel } = await req.json();
  if (!invitedBy) return NextResponse.json({ error: "Missing invitedBy" }, { status: 400 });

  const supabase = createClient();

  // Get all push subscriptions for the inviter
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", invitedBy);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const payload = JSON.stringify({
    title: "¡Familiar se unió a Ceiba! 🌳",
    body: `${joinerName} (${relationLabel}) aceptó tu invitación y ya está en tu árbol.`,
    icon: "/icons/icon-192.png",
    url: "/tree",
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, sent });
}
