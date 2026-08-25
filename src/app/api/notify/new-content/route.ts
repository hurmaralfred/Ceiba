import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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

  // Service role to read other users' profiles and push subs
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get uploader's name
  const { data: myProfile } = await service
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();
  const uploaderName = myProfile
    ? `${myProfile.first_name} ${myProfile.last_name || ""}`.trim()
    : "Un familiar";

  // Get family members who have joined (profile_id set), excluding self
  const { data: members } = await service
    .from("family_members")
    .select("profile_id")
    .eq("added_by", user.id)
    .not("profile_id", "is", null);

  if (!members || members.length === 0) {
    return NextResponse.json({ ok: true, pushSent: 0, emailSent: 0 });
  }

  const profileIds = [...new Set(members.map(m => m.profile_id as string))].filter(id => id !== user.id);
  if (profileIds.length === 0) return NextResponse.json({ ok: true, pushSent: 0, emailSent: 0 });

  // Get profiles for name + email
  const { data: profiles } = await service
    .from("profiles")
    .select("id, first_name, email")
    .in("id", profileIds);

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
