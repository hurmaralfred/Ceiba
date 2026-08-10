import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * POST /api/profile/confirm-data
 * Guarda los datos corregidos del usuario en su nodo de la galaxia y
 * marca data_confirmed_at para no volver a mostrar la pantalla.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();

  const { data: claim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", user.id)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (!claim?.person_id) {
    return NextResponse.json({ error: "Sin claim aprobado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { first_name, middle_name, first_surname, second_surname, birth_date, birth_city, birth_country } =
    body as Record<string, string>;

  if (!first_name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const [updateResult, claimResult] = await Promise.all([
    service
      .from("persons")
      .update({
        first_name:     first_name.trim(),
        middle_name:    middle_name?.trim() || null,
        first_surname:  first_surname?.trim() || null,
        second_surname: second_surname?.trim() || null,
        birth_date:     birth_date || null,
        birth_city:     birth_city?.trim() || null,
        birth_country:  birth_country?.trim() || null,
        updated_at:     now,
      })
      .eq("id", claim.person_id),
    service
      .from("person_claims")
      .update({ data_confirmed_at: now })
      .eq("person_id", claim.person_id)
      .eq("user_id", user.id),
  ]);

  if (updateResult.error) {
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }

  if (claimResult.error) {
    return NextResponse.json({ error: "Error al confirmar" }, { status: 500 });
  }

  await service.from("audit_logs").insert({
    actor_user_id: user.id,
    action: "confirm_own_data",
    entity_type: "persons",
    entity_id: claim.person_id,
    metadata: { fields: ["first_name","middle_name","first_surname","second_surname","birth_date","birth_city","birth_country"] },
  });

  // Notify the space owner that a family member joined (fire-and-forget, never blocks response)
  notifySpaceOwnerOnJoin(service, user.id, claim.person_id, first_name?.trim(), first_surname?.trim()).catch(() => {});

  return NextResponse.json({ ok: true });
}

async function notifySpaceOwnerOnJoin(
  service: ReturnType<typeof getServiceClient>,
  joinerUserId: string,
  joinerPersonId: string,
  firstName: string,
  firstSurname: string,
) {
  // Find the space this person belongs to
  const { data: membership } = await service
    .from("space_memberships")
    .select("space_id")
    .eq("person_id", joinerPersonId)
    .limit(1)
    .maybeSingle();
  if (!membership?.space_id) return;

  // Get all users in this space who have accounts (excluding the joiner)
  const { data: allMembers } = await service
    .from("space_memberships")
    .select("persons!inner(profile_id)")
    .eq("space_id", membership.space_id)
    .not("persons.profile_id", "is", null);

  const memberUserIds = (allMembers ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => m.persons?.profile_id as string)
    .filter((id): id is string => !!id && id !== joinerUserId);

  if (memberUserIds.length === 0) return;

  // Get push subscriptions for all family members
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", memberUserIds);
  if (!subs || subs.length === 0) return;

  const vapidPublic  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return;

  webpush.setVapidDetails("mailto:ceiba-app@noreply.com", vapidPublic, vapidPrivate);

  const joinerName = `${firstName} ${firstSurname}`.trim();
  const payload = JSON.stringify({
    title: "🌳 Nuevo familiar en Ceiba",
    body: `${joinerName} se unió a la familia. ¡Ya puedes verlo en tu galaxia!`,
    icon: "/icons/icon-192.png",
    url: "/tree",
  });

  await Promise.allSettled(
    (subs as any[]).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    )
  );
}
