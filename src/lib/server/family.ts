// Resolución de identidad y alcance familiar, compartida por Chat, Feed,
// Fotos e Historia. Modelo canónico único:
//   auth.users.id -> person_claims.user_id -> person_claims.person_id -> persons.id
//   familia = otras personas en el/los mismo(s) family_space (space_memberships)
// Nunca family_members, linked_user_id, ni columnas legadas de profiles/persons.

import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * chat_messages, photos, photo_tags y broadcasts tienen RLS habilitado sin
 * ninguna política — solo el service role puede leerlas/escribirlas. Por eso
 * todo el trabajo de Chat/Fotos/Feed pasa por rutas server-side.
 */
export function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface SupabaseLike {
  from(table: string): any;
}

export interface PersonDisplay {
  person_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
}

export async function resolveApprovedPersonId(
  service: SupabaseLike,
  userId: string
): Promise<string | null> {
  const { data, error } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", userId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();
  if (error) console.error("resolveApprovedPersonId error:", JSON.stringify(error));
  return data?.person_id ?? null;
}

/** IDs de otras personas que comparten al menos un family_space con personId. */
export async function resolveFamilySpaceMemberIds(
  service: SupabaseLike,
  personId: string
): Promise<string[]> {
  const { data: mySpaces } = await service
    .from("space_memberships")
    .select("space_id")
    .eq("person_id", personId);

  const spaceIds = ((mySpaces ?? []) as any[]).map((s) => s.space_id as string);
  if (spaceIds.length === 0) return [];

  const { data: members } = await service
    .from("space_memberships")
    .select("person_id")
    .in("space_id", spaceIds)
    .neq("person_id", personId);

  return [
    ...new Set(
      ((members ?? []) as any[]).map((m) => m.person_id as string).filter((id) => id !== personId)
    ),
  ];
}

/**
 * Resuelve nombre/foto para un conjunto de user_id, únicamente entre
 * personas con claim aprobado. Usada para mostrar remitentes de chat,
 * autores de fotos/eventos, sin exponer nunca datos de usuarios fuera
 * de ese conjunto (el llamador decide el alcance: familia, sala, etc.).
 */
export async function resolvePersonsByUserIds(
  service: SupabaseLike,
  userIds: string[]
): Promise<Map<string, PersonDisplay>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const { data: claims } = await service
    .from("person_claims")
    .select("user_id, person_id")
    .in("user_id", uniqueIds)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const personIdToUserId = new Map<string, string>();
  for (const c of (claims ?? []) as any[]) {
    personIdToUserId.set(c.person_id, c.user_id);
  }
  const personIds = [...personIdToUserId.keys()];
  if (personIds.length === 0) return new Map();

  const { data: persons } = await service
    .from("persons")
    .select("id, first_name, first_surname, photo_path")
    .in("id", personIds);

  const result = new Map<string, PersonDisplay>();
  for (const p of (persons ?? []) as any[]) {
    const userId = personIdToUserId.get(p.id);
    if (!userId) continue;
    result.set(userId, {
      person_id: p.id,
      user_id: userId,
      first_name: p.first_name ?? "",
      last_name: p.first_surname ?? "",
      photo_path: p.photo_path ?? null,
    });
  }
  return result;
}

/**
 * Roster completo de mi familia (mismo family_space), con display info.
 * Incluye únicamente personas con claim aprobado (las que sí tienen cuenta).
 */
export async function resolveFamilyRoster(
  service: SupabaseLike,
  myUserId: string
): Promise<PersonDisplay[]> {
  const myPersonId = await resolveApprovedPersonId(service, myUserId);
  if (!myPersonId) return [];

  const familyPersonIds = await resolveFamilySpaceMemberIds(service, myPersonId);
  if (familyPersonIds.length === 0) return [];

  const { data: claims } = await service
    .from("person_claims")
    .select("user_id, person_id")
    .in("person_id", familyPersonIds)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const userIds = [...new Set(((claims ?? []) as any[]).map((c) => c.user_id as string))];
  const map = await resolvePersonsByUserIds(service, userIds);
  return [...map.values()];
}
