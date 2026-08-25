import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { resolveApprovedPersonId, resolveFamilySpaceMemberIds } from "@/lib/server/presence";

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

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/presence
 * Body: { lat?, lng?, checkin?: boolean, pause?: boolean }
 *
 * - pause=true: deja de compartir ubicación (borra la fila en person_locations)
 * - lat/lng presentes: guarda/actualiza mi ubicación en person_locations
 * - checkin=true: además envía push "llegué bien" a la familia de mi(s) espacio(s)
 *
 * person_locations no tiene columna de "compartir sí/no": la existencia de la
 * fila ES la señal de que estoy compartiendo ubicación.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { lat, lng, checkin = false, pause = false } = await req.json();

  const service = getServiceClient();
  const personId = await resolveApprovedPersonId(service, user.id);
  if (!personId) {
    return NextResponse.json(
      { error: "No tienes una identidad reclamada en la galaxia familiar todavía." },
      { status: 400 }
    );
  }

  if (pause) {
    const { error } = await service.from("person_locations").delete().eq("person_id", personId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, sharing: false });
  }

  if (lat == null || lng == null) {
    return NextResponse.json({ error: "Falta lat/lng" }, { status: 400 });
  }

  // city/country son NOT NULL en person_locations sin default. Solo tenemos
  // coordenadas del navegador (no un nombre de ciudad), así que se guardan
  // como cadena vacía en vez de inventar un valor — nunca se muestran ni se
  // usan para nada, son puro relleno del constraint.
  const { error: upsertError } = await service
    .from("person_locations")
    .upsert(
      { person_id: personId, city: "", country: "", lat_city: lat, lon_city: lng, updated_at: new Date().toISOString() },
      { onConflict: "person_id" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  if (checkin) {
    try {
      configureWebPush();
    } catch (e: any) {
      return NextResponse.json({ ok: true, sharing: true, pushError: e.message });
    }

    const { data: me } = await service
      .from("persons")
      .select("first_name, first_surname")
      .eq("id", personId)
      .maybeSingle();
    const name = me ? `${me.first_name ?? ""} ${me.first_surname ?? ""}`.trim() : "Un familiar";

    const familyPersonIds = await resolveFamilySpaceMemberIds(service, personId);

    if (familyPersonIds.length > 0) {
      const { data: recipientClaims } = await service
        .from("person_claims")
        .select("user_id")
        .in("person_id", familyPersonIds)
        .eq("claim_status", "approved")
        .is("revoked_at", null);

      const recipientUserIds = [...new Set((recipientClaims ?? []).map((c) => c.user_id as string))];

      if (recipientUserIds.length > 0) {
        const { data: subs } = await service
          .from("push_subscriptions")
          .select("*")
          .in("user_id", recipientUserIds);

        const payload = JSON.stringify({
          title: `✅ ${name} llegó bien`,
          body: "Ver su ubicación en el mapa familiar",
          icon: "/icons/icon-192.png",
          url: "/map",
        });

        await Promise.allSettled(
          (subs ?? []).map((sub) =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
          )
        );
      }
    }
  }

  return NextResponse.json({ ok: true, sharing: true });
}

/**
 * GET /api/presence
 * Devuelve la ubicación de las personas que comparten al menos un
 * family_space conmigo (space_memberships) y que tienen fila en
 * person_locations (= están compartiendo ubicación).
 */
export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const personId = await resolveApprovedPersonId(service, user.id);
  if (!personId) {
    return NextResponse.json({ members: [], sharing: false });
  }

  const familyPersonIds = await resolveFamilySpaceMemberIds(service, personId);

  const { data: myLocation } = await service
    .from("person_locations")
    .select("lat_city, lon_city, updated_at")
    .eq("person_id", personId)
    .maybeSingle();

  if (familyPersonIds.length === 0) {
    return NextResponse.json({
      members: [],
      sharing: !!myLocation,
      myLocation: myLocation
        ? { lat: myLocation.lat_city, lng: myLocation.lon_city, updatedAt: myLocation.updated_at }
        : null,
    });
  }

  const [{ data: locations }, { data: persons }] = await Promise.all([
    service
      .from("person_locations")
      .select("person_id, lat_city, lon_city, updated_at")
      .in("person_id", familyPersonIds),
    service
      .from("persons")
      .select("id, first_name, first_surname, photo_path")
      .in("id", familyPersonIds),
  ]);

  const personMap = new Map((persons ?? []).map((p) => [p.id, p]));

  const members = (locations ?? [])
    .map((loc) => {
      const p = personMap.get(loc.person_id);
      if (!p) return null;
      return {
        id: loc.person_id as string,
        first_name: p.first_name ?? "",
        last_name: p.first_surname ?? "",
        avatar_url: p.photo_path ?? null,
        last_seen_at: loc.updated_at,
        live_lat: loc.lat_city,
        live_lng: loc.lon_city,
        live_location_at: loc.updated_at,
        location_sharing: true,
        relation_type: "family",
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return NextResponse.json({
    members,
    sharing: !!myLocation,
    myLocation: myLocation
      ? { lat: myLocation.lat_city, lng: myLocation.lon_city, updatedAt: myLocation.updated_at }
      : null,
  });
}
