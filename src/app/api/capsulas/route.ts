import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolveFamilySpaceMemberIds } from "@/lib/server/family";

// GET /api/capsulas
// Returns all capsulas visible to this family (metadata only — no content)
// plus the list of claimable family members for the compose picker.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();

  // Find the caller's person_id via their approved claim
  const { data: myClaim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", user.id)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  // Get all future_messages (metadata only — no content column)
  const { data: rows, error } = await service
    .from("future_messages")
    .select("id, sender_user_id, recipient_person_id, unlock_date, created_at, opened_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const capsulas = rows ?? [];

  // Collect all unique user/person ids to resolve names
  const senderUserIds = [...new Set(capsulas.map((r: any) => r.sender_user_id as string))];
  const recipientPersonIds = [...new Set(capsulas.map((r: any) => r.recipient_person_id as string))];

  // Resolve sender names via person_claims → persons
  const { data: senderClaims } = await service
    .from("person_claims")
    .select("user_id, person_id")
    .in("user_id", senderUserIds)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const senderPersonIds = (senderClaims ?? []).map((c: any) => c.person_id as string);
  const allPersonIds = [...new Set([...senderPersonIds, ...recipientPersonIds])];

  const { data: persons } = await service
    .from("persons")
    .select("id, first_name, first_surname, second_surname, photo_path")
    .in("id", allPersonIds);

  const personMap = new Map((persons ?? []).map((p: any) => [p.id as string, p]));
  const claimByUser = new Map((senderClaims ?? []).map((c: any) => [c.user_id as string, c.person_id as string]));

  const today = new Date().toISOString().slice(0, 10);

  const enriched = capsulas.map((r: any) => {
    const senderPersonId = claimByUser.get(r.sender_user_id);
    const senderPerson = senderPersonId ? personMap.get(senderPersonId) : null;
    const recipientPerson = personMap.get(r.recipient_person_id);
    const isMyCapsula = r.sender_user_id === user.id;
    const isMyRecipient = myClaim?.person_id === r.recipient_person_id;
    const unlocked = r.unlock_date <= today;

    return {
      id: r.id,
      sender_name: senderPerson
        ? `${senderPerson.first_name} ${senderPerson.first_surname ?? ""}`.trim()
        : "Familiar",
      sender_photo: senderPerson?.photo_path ?? null,
      recipient_name: recipientPerson
        ? `${recipientPerson.first_name} ${recipientPerson.first_surname ?? ""}`.trim()
        : "Familiar",
      recipient_photo: recipientPerson?.photo_path ?? null,
      unlock_date: r.unlock_date,
      created_at: r.created_at,
      opened_at: r.opened_at,
      is_mine: isMyCapsula,
      is_recipient: isMyRecipient,
      can_open: isMyRecipient && unlocked,
      unlocked,
    };
  });

  // Family members for compose picker — only persons in my family space (same tree)
  const myFamilyPersonIds = myClaim?.person_id
    ? await resolveFamilySpaceMemberIds(service, myClaim.person_id)
    : [];

  const { data: familyPersons } = myFamilyPersonIds.length > 0
    ? await service
        .from("persons")
        .select("id, first_name, first_surname, second_surname, photo_path")
        .in("id", myFamilyPersonIds)
    : { data: [] as any[] };

  const familyMembers = (familyPersons ?? []).map((p: any) => ({
    person_id: p.id,
    name: `${p.first_name} ${p.first_surname ?? ""}`.trim(),
    photo: p.photo_path ?? null,
  }));

  return NextResponse.json({ capsulas: enriched, familyMembers, myPersonId: myClaim?.person_id ?? null });
}

// POST /api/capsulas
// Body: { recipient_person_id, unlock_date, content }
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { recipient_person_id, unlock_date, content } = body;

  if (!recipient_person_id || typeof recipient_person_id !== "string")
    return NextResponse.json({ error: "Destinatario requerido" }, { status: 400 });
  if (!unlock_date || typeof unlock_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(unlock_date))
    return NextResponse.json({ error: "Fecha de apertura inválida" }, { status: 400 });
  if (!content || typeof content !== "string" || content.trim().length < 1)
    return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 });
  if (content.length > 2000)
    return NextResponse.json({ error: "El mensaje supera los 2000 caracteres" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  if (unlock_date <= today)
    return NextResponse.json({ error: "La fecha debe ser en el futuro" }, { status: 400 });

  const service = getServiceClient();

  // Verify recipient_person_id exists and has an approved claim (is an active family member)
  const { data: recipientClaim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("person_id", recipient_person_id)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (!recipientClaim)
    return NextResponse.json({ error: "Destinatario no encontrado" }, { status: 404 });

  const { data: newRow, error } = await service
    .from("future_messages")
    .insert({
      sender_user_id: user.id,
      recipient_person_id,
      unlock_date,
      content: content.trim(),
    })
    .select("id, unlock_date, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the recipient via push — fire and forget
  notifyRecipient(service, recipient_person_id, newRow.unlock_date).catch(() => {});

  return NextResponse.json({ capsula: newRow }, { status: 201 });
}

async function notifyRecipient(
  service: ReturnType<typeof getServiceClient>,
  recipientPersonId: string,
  unlockDate: string,
) {
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;

  // Get recipient's user_id
  const { data: claim } = await service
    .from("person_claims")
    .select("user_id")
    .eq("person_id", recipientPersonId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();
  if (!claim?.user_id) return;

  // Get their push subscriptions
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", claim.user_id);
  if (!subs || subs.length === 0) return;

  const unlock = new Date(unlockDate).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
  const payload = JSON.stringify({
    title: "📦 Te enviaron una cápsula del tiempo",
    body: `Alguien de tu familia te escribió un mensaje que se abrirá el ${unlock}.`,
    icon: "/icons/icon-192.png",
    url: "/capsulas",
    badge: 1,
  });

  webpush.setVapidDetails("mailto:ceiba-app@noreply.com", publicKey, privateKey);
  await Promise.allSettled(
    (subs as any[]).map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    )
  );
}
