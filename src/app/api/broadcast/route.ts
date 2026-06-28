import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:ceiba-app@noreply.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  if (message.trim().length > 300) return NextResponse.json({ error: "Máximo 300 caracteres" }, { status: 400 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Guardar el anuncio
  await service.from("announcements").insert({
    created_by: user.id,
    message: message.trim(),
  });

  // Nombre del remitente
  const { data: me } = await service
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();
  const senderName = me ? `${me.first_name} ${me.last_name || ""}`.trim() : "Un familiar";

  // Obtener todos los familiares conectados (con profile_id)
  const { data: members } = await service
    .from("family_members")
    .select("profile_id")
    .eq("added_by", user.id)
    .not("profile_id", "is", null);

  // También buscar quienes me tienen a mí como familiar (miembros inversos)
  const { data: reverseMembers } = await service
    .from("family_members")
    .select("added_by")
    .eq("profile_id", user.id);

  const directIds = (members || []).map(m => m.profile_id as string);
  const reverseIds = (reverseMembers || []).map(m => m.added_by as string);
  const recipientIds = [...new Set([...directIds, ...reverseIds])].filter(id => id !== user.id);

  if (recipientIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Push subscriptions de los destinatarios
  const { data: allSubs } = await service
    .from("push_subscriptions")
    .select("*")
    .in("user_id", recipientIds);

  const payload = JSON.stringify({
    title: `📢 ${senderName}`,
    body: message.trim(),
    icon: "/icons/icon-192.png",
    url: "/feed",
  });

  const results = await Promise.allSettled(
    (allSubs || []).map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  const sent = results.filter(r => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, sent, recipients: recipientIds.length });
}
