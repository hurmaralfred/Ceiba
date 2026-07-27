import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolveApprovedPersonId, resolveFamilyRoster } from "@/lib/server/family";

/**
 * GET /api/family/roster
 * Lista de personas de mi(s) family_space (space_memberships) con cuenta
 * reclamada (person_claims aprobado). Usada para elegir con quién chatear,
 * a quién etiquetar en una foto, etc. Nunca family_members.
 */
export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const personId = await resolveApprovedPersonId(service, user.id);
  if (!personId) {
    return NextResponse.json({ members: [] });
  }

  const members = await resolveFamilyRoster(service, user.id);
  return NextResponse.json({ members });
}
