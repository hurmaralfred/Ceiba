import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolveFamilyUserIds, resolvePersonsByUserIds } from "@/lib/server/family";
import webpush from "web-push";
import { sendNewContentEmail } from "@/lib/email";

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

  const { type, title, caption } = await req.json();
  if (!["photo", "event", "historia"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  // Service role to read other users' persons/claims and push subs
  const service = getServiceClient();

  // Uploader's name (persons vía person_claims)
  const uploaders = await resolvePersonsByUserIds(service, [user.id]);
  const up = uploaders.get(user.id);
  const uploaderName = up ? `${up.first_name} ${up.last_name}`.trim() || "Un familiar" : "Un familiar";

  // Recipients: my family_space (canonical model), excluding self
  const profileIds = (await resolveFamilyUserIds(service, user.id)).filter(id => id !== user.id);
  if (profileIds.length === 0) return NextResponse.json({ ok: true, pushSent: 0, emailSent: 0 });

  // Names + emails: name from persons, email from auth.users (profiles has no email column)
  const recipientPersons = await resolvePersonsByUserIds(service, profileIds);
  const profiles = (
    await Promise.all(
      profileIds.map(async (id) => {
        const { data } = await service.auth.admin.getUserById(id);
        return { id, email: data?.user?.email ?? null, first_name: recipientPersons.get(id)?.first_name ?? "" };
      })
    )
  );

  // Get all push subscriptions for those users
  const { data: allSubs } = await service
    .from("push_subscriptions")
    .select("*")
    .in("user_id", profileIds);

  const contentTitle = type === "event" ? (title || "") : (caption || "");

  // Push
  const pushPayload = JSON.stringify({
    title: type === "photo"
      ? `📸 Nueva foto de ${uploaderName}`
      : type === "historia"
        ? `✨ Nueva historia de ${uploaderName}`
        : `📅 Nuevo recuerdo de ${uploaderName}`,
    body: type === "photo"
      ? (contentTitle ? `"${contentTitle}"` : "Compartió una foto en la galaxia familiar")
      : type === "historia"
        ? (contentTitle || "Compartió una historia con la familia")
        : (contentTitle || "Registró un nuevo recuerdo familiar"),
    icon: "/icons/icon-192.png",
    url: type === "photo" ? "/photos" : type === "historia" ? "/historias" : "/events",
  });

  const pushResults = await Promise.allSettled(
    (allSubs || []).map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        pushPayload
      )
    )
  );

  // Emails
  const emailResults = await Promise.allSettled(
    (profiles || [])
      .filter(p => p.email)
      .map(p =>
        sendNewContentEmail(
          p.email!,
          p.first_name || "",
          uploaderName,
          type as "photo" | "event" | "historia",
          contentTitle || undefined
        )
      )
  );

  const pushSent = pushResults.filter(r => r.status === "fulfilled").length;
  const emailSent = emailResults.filter(r => r.status === "fulfilled").length;

  return NextResponse.json({ ok: true, pushSent, emailSent });
}
