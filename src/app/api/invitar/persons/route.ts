import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolveApprovedPersonId } from "@/lib/server/family";

/**
 * GET /api/invitar/persons
 * Returns all persons in the caller's family graph annotated with
 * `registered: true` when they already have an approved person_claim.
 *
 * Uses the service client for person_claims to bypass RLS — a user can
 * only see their own claims in the browser client, so we'd incorrectly
 * treat every other family member as "not yet registered".
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Graph via user session (respects their space membership)
  const { data: graph, error: graphError } = await supabase.rpc("get_my_family_graph", { p_depth: 2 });
  if (graphError) return NextResponse.json({ error: graphError.message }, { status: 500 });
  if (!graph) return NextResponse.json({ persons: [], me: null });

  const nodes: any[] = Array.isArray(graph.nodes) ? graph.nodes : [];
  const myId: string | null = graph.me ?? null;

  const personIds = nodes
    .map((n: any) => n.id)
    .filter((id: any): id is string => Boolean(id) && id !== myId);

  // Service client bypasses RLS — can read claims belonging to any user
  const service = getServiceClient();

  const registeredIds = new Set<string>();
  if (personIds.length > 0) {
    const { data: claims } = await service
      .from("person_claims")
      .select("person_id")
      .in("person_id", personIds)
      .eq("claim_status", "approved")
      .is("revoked_at", null);
    for (const c of claims ?? []) {
      if ((c as any).person_id) registeredIds.add((c as any).person_id as string);
    }
  }

  const persons = nodes
    .filter((n: any) => n.id !== myId && n.deleted_at == null)
    .map((n: any) => ({
      id: n.id as string,
      first_name: (n.first_name ?? "") as string,
      middle_name: (n.middle_name ?? null) as string | null,
      first_surname: (n.first_surname ?? "") as string,
      second_surname: (n.second_surname ?? null) as string | null,
      photo_path: (n.photo_path ?? null) as string | null,
      is_deceased: n.is_deceased === true,
      registered: registeredIds.has(n.id as string),
    }));

  return NextResponse.json({ persons, me: myId, edges: graph.edges ?? [] });
}
