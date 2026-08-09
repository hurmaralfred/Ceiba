import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getServiceClient,
  resolveApprovedPersonId,
  resolveFamilySpaceMemberIds,
} from "@/lib/server/family";

export async function GET(
  _req: NextRequest,
  { params }: { params: { personId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const { personId } = params;

  // Authorization: viewer must be in same family space as the person
  const myPersonId = await resolveApprovedPersonId(service, user.id);
  const familyPersonIds = myPersonId
    ? await resolveFamilySpaceMemberIds(service, myPersonId)
    : [];
  const allPersonIds = myPersonId ? [myPersonId, ...familyPersonIds] : [];

  if (myPersonId && !allPersonIds.includes(personId)) {
    const { data: selfClaim } = await service
      .from("person_claims")
      .select("person_id")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .maybeSingle();
    if (!selfClaim) {
      return NextResponse.json({ error: "Persona no encontrada en tu familia" }, { status: 403 });
    }
  }

  // Get person data
  const { data: person } = await service
    .from("persons")
    .select("id, first_name, middle_name, first_surname, second_surname, birth_date, birth_city, birth_country, photo_path, created_by")
    .eq("id", personId)
    .single();

  if (!person) return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });

  // Check if person has a Ceiba account
  const { data: claim } = await service
    .from("person_claims")
    .select("user_id")
    .eq("person_id", personId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  // Get avatar URL + config + relation type + is_deceased from family_members (if account exists)
  let avatarUrl: string | null = null;
  let avatarConfig: any = null;
  let is_deceased = false;
  let relationType: string | null = null;

  if (claim?.user_id) {
    const [{ data: profile }, { data: member }] = await Promise.all([
      service
        .from("profiles")
        .select("avatar_path, avatar_config")
        .eq("user_id", claim.user_id)
        .maybeSingle(),
      service
        .from("family_members")
        .select("is_deceased, relation_type")
        .eq("profile_id", claim.user_id)
        .maybeSingle(),
    ]);

    if (profile?.avatar_path) {
      const { data: urlData } = service.storage.from("avatars").getPublicUrl(profile.avatar_path);
      avatarUrl = urlData.publicUrl;
    }
    avatarConfig = profile?.avatar_config ?? null;

    if (member) {
      is_deceased = member.is_deceased ?? false;
      relationType = (member as any).relation_type ?? null;
    }
  }

  // Get sibling persons in the family space who have Ceiba accounts (for relatives + familyInCeiba)
  const siblingPersonIds = allPersonIds.filter((id) => id !== personId);
  let familyInCeiba: any[] = [];
  let relatives: any[] = [];

  if (siblingPersonIds.length > 0) {
    const { data: siblingClaims } = await service
      .from("person_claims")
      .select("user_id, person_id")
      .in("person_id", siblingPersonIds)
      .eq("claim_status", "approved")
      .is("revoked_at", null);

    if (siblingClaims && siblingClaims.length > 0) {
      const claimedPersonIds = (siblingClaims as any[]).map((c) => c.person_id);
      const siblingUserIds = (siblingClaims as any[]).map((c) => c.user_id);

      const [{ data: siblingPersons }, { data: siblingProfiles }] = await Promise.all([
        service
          .from("persons")
          .select("id, first_name, first_surname, birth_date")
          .in("id", claimedPersonIds),
        service
          .from("profiles")
          .select("user_id, avatar_path")
          .in("user_id", siblingUserIds),
      ]);

      familyInCeiba = (siblingPersons ?? []) as any[];

      relatives = (siblingPersons ?? []).slice(0, 4).map((sp: any) => {
        const relClaim = (siblingClaims as any[]).find((c: any) => c.person_id === sp.id);
        const relProfile = relClaim
          ? (siblingProfiles ?? []).find((p: any) => p.user_id === relClaim.user_id)
          : null;
        let relAvatarUrl: string | null = null;
        if (relProfile?.avatar_path) {
          const { data: urlData } = service.storage.from("avatars").getPublicUrl(relProfile.avatar_path);
          relAvatarUrl = urlData.publicUrl;
        }
        return {
          id: sp.id,
          first_name: sp.first_name,
          first_surname: sp.first_surname ?? null,
          birth_year: sp.birth_date ? new Date(sp.birth_date + "T12:00:00").getFullYear() : null,
          avatarUrl: relAvatarUrl,
        };
      });
    }
  }

  // Get events created by this specific person only
  let events: any[] = [];
  if (claim?.user_id) {
    const { data: personEvents } = await service
      .from("family_events")
      .select("id, title, event_type, event_date, description, created_at")
      .eq("created_by", claim.user_id)
      .order("event_date", { ascending: true })
      .limit(8);
    events = (personEvents ?? []) as any[];
  }

  return NextResponse.json({
    person: {
      ...person,
      avatarUrl,
      avatarConfig,
      hasAccount: !!claim,
      is_claimed: !!claim,
      is_deceased,
    },
    relationType,
    relatives,
    familyInCeiba,
    totalInSpace: allPersonIds.length,
    events,
  });
}

// PATCH /api/persona/[personId]
// Allows the original creator to edit an unclaimed person's data
export async function PATCH(
  req: NextRequest,
  { params }: { params: { personId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const { personId } = params;

  // Fetch person to verify creator and claim status
  const { data: person } = await service
    .from("persons")
    .select("id, created_by")
    .eq("id", personId)
    .single();

  if (!person) return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });

  // Only the original creator can edit
  if (person.created_by !== user.id)
    return NextResponse.json({ error: "No tienes permiso para editar este perfil" }, { status: 403 });

  // Editing is blocked once someone has claimed the profile
  const { data: existingClaim } = await service
    .from("person_claims")
    .select("id")
    .eq("person_id", personId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (existingClaim)
    return NextResponse.json({ error: "Este perfil ya fue reclamado y no puede editarse" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    first_name, middle_name, first_surname, second_surname,
    birth_date, birth_city, birth_country, photo_path,
  } = body;

  if (!first_name || typeof first_name !== "string" || first_name.trim().length < 1)
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const updates: Record<string, unknown> = {
    first_name: first_name.trim(),
    middle_name: middle_name?.trim() || null,
    first_surname: first_surname?.trim() || null,
    second_surname: second_surname?.trim() || null,
    birth_date: birth_date || null,
    birth_city: birth_city?.trim() || null,
    birth_country: birth_country?.trim() || null,
  };

  if (photo_path && typeof photo_path === "string") {
    updates.photo_path = photo_path;
  }

  const { error } = await service
    .from("persons")
    .update(updates)
    .eq("id", personId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
