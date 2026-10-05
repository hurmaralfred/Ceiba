import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolveFamilyUserIds, resolvePersonsByUserIds } from "@/lib/server/family";
import webpush from "web-push";

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey) {
    throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  }

  if (!privateKey) {
    throw new Error("Missing VAPID_PRIVATE_KEY");
  }

  webpush.setVapidDetails(
    "mailto:soporte@ceibapp.com",
    publicKey,
    privateKey,
  );
}

export async function POST(req: NextRequest) {
  configureWebPush();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, type = "broadcast", location } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  if (message.trim().length > 300) return NextResponse.json({ error: "Máximo 300 caracteres" }, { status: 400 });
  if (!["broadcast", "emergency"].includes(type)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });

  const service = getServiceClient();

  // Guardar el anuncio
  // TODO: la tabla `announcements` no existe en el esquema (el feed lee `broadcasts`);
  // el error se descarta, así que este insert hoy no persiste nada. Fuera del alcance
  // de la migración de family_members: decidir si se redirige a `broadcasts`.
  await service.from("announcements").insert({
    created_by: user.id,
    message: message.trim(),
    type,
    ...(location ? { location_lat: location.lat, location_lng: location.lng } : {}),
  });

  // Nombre del remitente (persons vía person_claims; profiles no tiene first_name/last_name)
  const senders = await resolvePersonsByUserIds(service, [user.id]);
  const me = senders.get(user.id);
  const senderName = me ? `${me.first_name} ${me.last_name}`.trim() || "Un familiar" : "Un familiar";

  // Destinatarios: mi family_space (modelo canónico persons/space_memberships/person_claims)
  const recipientIds = (await resolveFamilyUserIds(service, user.id)).filter(id => id !== user.id);

  if (recipientIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, recipients: 0 });
  }

  // Push subscriptions de los destinatarios
  const { data: allSubs } = await service
    .from("push_subscriptions")
    .select("*")
    .in("user_id", recipientIds);

  const isEmergency = type === "emergency";
  const locationText = location ? ` · Ver ubicación en el feed` : "";
  const payload = JSON.stringify({
    title: isEmergency ? `🚨 EMERGENCIA — ${senderName}` : `📢 ${senderName}`,
    body: isEmergency
      ? `${message.trim()}${locationText}`
      : message.trim(),
    icon: "/icons/icon-192.png",
    url: "/feed",
    requireInteraction: isEmergency,
    type: isEmergency ? "sos" : "announcement",
    senderName,
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
