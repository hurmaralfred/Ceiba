import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getServiceClient } from "@/lib/server/family";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-service-key") !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { userId, title, body, roomId } = await req.json();
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  const privateKey = process.env.VAPID_PRIVATE_KEY!;
  webpush.setVapidDetails("mailto:admin@ceibapp.com", publicKey, privateKey);

  const service = getServiceClient();
  const { data: subs } = await service.from("push_subscriptions")
    .select("endpoint,p256dh,auth").eq("user_id", userId);

  if (!subs?.length) return NextResponse.json({ error: "No subs", count: 0 });

  const payload = JSON.stringify({
    title, body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: roomId ? `/chat/${roomId}` : "/home",
    type: "chat", roomId,
  });

  const results = await Promise.allSettled(
    subs.map(s => webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload
    ).then(() => ({ ok: true, ep: s.endpoint.slice(-20) }))
     .catch((e: any) => ({ ok: false, ep: s.endpoint.slice(-20), status: e?.statusCode, body: e?.body })))
  );

  return NextResponse.json({ results: results.map(r => r.status === "fulfilled" ? r.value : r.reason) });
}
