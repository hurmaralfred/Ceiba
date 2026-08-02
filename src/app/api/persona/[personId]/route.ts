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

  // Allow viewing your own profile even without a claim (handled via claim check below)
  // If we have a person identity, verify this person is in our family space
  if (myPersonId && !allPersonIds.includes(personId)) {
    // Allow if the viewer IS the person (their own page via a claim)
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
    .select("id, first_name, middle_name, first_surname, second_surname, birth_date, birth_city, birth_country, photo_path")
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

  // Get avatar URL if they have an account
  let avatarUrl: string | null = null;
  let avatarConfig: any = null;
  if (claim?.user_id) {
    const { data: profile } = await service
      .from("profiles")
      .select("avatar_path, avatar_config")
      .eq("user_id", claim.user_id)
      .maybeSingle();
    if (profile?.avatar_path) {
      const { data: urlData } = service.storage.from("avatars").getPublicUrl(profile.avatar_path);
      avatarUrl = urlData.publicUrl;
    }
    avatarConfig = profile?.avatar_config ?? null;
  }

  // Get other persons in the family space who have Ceiba accounts
  const siblingPersonIds = allPersonIds.filter((id) => id !== personId);
  let familyInCeiba: any[] = [];
  if (siblingPersonIds.length > 0) {
    const { data: siblingClaims } = await service
      .from("person_claims")
      .select("user_id, person_id")
      .in("person_id", siblingPersonIds)
      .eq("claim_status", "approved")
      .is("revoked_at", null);

    if (siblingClaims && siblingClaims.length > 0) {
      const claimedPersonIds = (siblingClaims as any[]).map((c) => c.person_id);
      const { data: siblingPersons } = await service
        .from("persons")
        .select("id, first_name, first_surname")
        .in("id", claimedPersonIds);
      familyInCeiba = (siblingPersons ?? []) as any[];
    }
  }

  // Get recent life events from the family space
  // Find all user_ids in family space for events query
  const { data: allClaims } = await service
    .from("person_claims")
    .select("user_id")
    .in("person_id", allPersonIds)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const familyUserIds = [...new Set([user.id, ...((allClaims ?? []) as any[]).map((c) => c.user_id as string)])];

  const { data: events } = await service
    .from("family_events")
    .select("id, title, event_type, event_date, description, created_at")
    .in("created_by", familyUserIds)
    .order("event_date", { ascending: false })
    .limit(6);

  return NextResponse.json({
    person: {
      ...person,
      avatarUrl,
      avatarConfig,
      hasAccount: !!claim,
    },
    familyInCeiba,
    totalInSpace: allPersonIds.length,
    events: (events ?? []) as any[],
  });
}
