import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";
import webpush from "web-push";

const ALLOWED_EMOJIS = ["❤️", "😭", "✨", "😄"];

function configureWebPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails("mailto:ceiba-app@noreply.com", pub, priv);
  }
}

/** GET /api/hoy/reactions?memoryId=… — counts + my reaction */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const memoryId = req.nextUrl.searchParams.get("memoryId");
  if (!memoryId) return NextResponse.json({ error: "memoryId requerido" }, { status: 400 });

  const service = getServiceClient();
  const { data: rows } = await service
    .from("memory_reactions")
    .select("emoji, user_id")
    .eq("memory_id", memoryId);

  const counts: Record<string, number> = {};
  let myEmoji: string | null = null;
  for (const r of (rows ?? []) as any[]) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    if (r.user_id === user.id) myEmoji = r.emoji;
  }

  return NextResponse.json({ counts, myEmoji });
}

/** POST /api/hoy/reactions — toggle or switch emoji */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { memoryId, emoji } = await req.json();
  if (!memoryId || !ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const service = getServiceClient();

  // Check existing reaction
  const { data: existing } = await service
    .from("memory_reactions")
    .select("id, emoji")
    .eq("memory_id", memoryId)
    .eq("user_id", user.id)
    .maybeSingle();

  let action: "added" | "removed" | "changed" = "added";

  if (existing) {
    if ((existing as any).emoji === emoji) {
      // Same emoji → remove (toggle off)
      const { error: delErr } = await service.from("memory_reactions").delete().eq("id", (existing as any).id);
      if (delErr) return NextResponse.json({ error: "DB error" }, { status: 500 });
      action = "removed";
    } else {
      // Different emoji → update
      const { error: updErr } = await service.from("memory_reactions").update({ emoji }).eq("id", (existing as any).id);
      if (updErr) return NextResponse.json({ error: "DB error" }, { status: 500 });
      action = "changed";
    }
  } else {
    // New reaction
    const { error: insErr } = await service.from("memory_reactions").insert({ memory_id: memoryId, user_id: user.id, emoji });
    if (insErr) return NextResponse.json({ error: "DB error" }, { status: 500 });
    action = "added";
  }

  // Notify memory author (only on add/change, not remove)
  if (action !== "removed") {
    try {
      const { data: memory } = await service
        .from("family_memories")
        .select("author_user_id, body")
        .eq("id", memoryId)
        .maybeSingle();

      const authorId = (memory as any)?.author_user_id;
      if (authorId && authorId !== user.id) {
        // Get reactor name
        const { data: claims } = await service
          .from("person_claims")
          .select("person_id")
          .eq("user_id", user.id)
          .eq("claim_status", "approved")
          .is("revoked_at", null)
          .limit(1);
        const personId = (claims as any[])?.[0]?.person_id;
        let reactorName = "Alguien";
        if (personId) {
          const { data: person } = await service
            .from("persons")
            .select("first_name")
            .eq("id", personId)
            .maybeSingle();
          if ((person as any)?.first_name) reactorName = (person as any).first_name;
        }

        const { data: subs } = await service
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", authorId);

        if (subs && subs.length > 0) {
          configureWebPush();
          const preview = (memory as any)?.body?.slice(0, 60) ?? "tu recuerdo";
          const payload = JSON.stringify({
            title: `${emoji} ${reactorName} reaccionó a tu recuerdo`,
            body: preview,
            icon: "/icons/icon-192.png",
            url: "/hoy",
          });
          await Promise.allSettled(
            (subs as any[]).map((sub) =>
              webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              )
            )
          );
        }
      }
    } catch {
      // Non-critical — don't fail the reaction
    }
  }

  // Return updated counts
  const { data: rows } = await service
    .from("memory_reactions")
    .select("emoji, user_id")
    .eq("memory_id", memoryId);

  const counts: Record<string, number> = {};
  let myEmoji: string | null = null;
  for (const r of (rows ?? []) as any[]) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    if (r.user_id === user.id) myEmoji = r.emoji;
  }

  return NextResponse.json({ counts, myEmoji, action });
}
