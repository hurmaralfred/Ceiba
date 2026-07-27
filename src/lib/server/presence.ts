// Resolución de identidad y alcance familiar para el feature de presencia/mapa.
// Modelo canónico único:
//   auth.users.id -> person_claims.user_id -> person_claims.person_id -> persons.id
//   familia = otras personas en el/los mismo(s) family_space (space_memberships)
// Nunca persons.linked_user_id (no existe).

export interface SupabaseLike {
  from(table: string): any;
}

/**
 * Resuelve la persona reclamada (aprobada, no revocada) de un usuario
 * autenticado. userId SIEMPRE debe venir de supabase.auth.getUser() en el
 * servidor — nunca de un campo enviado por el cliente.
 */
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

/**
 * IDs de otras personas que comparten al menos un family_space con personId.
 * Nunca incluye a personId mismo ni a personas de espacios distintos.
 */
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

  // Defensa en profundidad: nunca devolver a la propia persona, incluso si
  // el filtro .neq() de la consulta cambiara o fallara en el futuro.
  return [
    ...new Set(
      ((members ?? []) as any[])
        .map((m) => m.person_id as string)
        .filter((id) => id !== personId)
    ),
  ];
}
