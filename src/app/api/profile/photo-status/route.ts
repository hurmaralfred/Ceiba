import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * GET /api/profile/photo-status
 *
 * Diagnostic endpoint — PREVIEW ONLY. Remove before merging to main.
 *
 * Returns the state of every link in the photo chain for the authenticated
 * user, without exposing any credentials or sensitive identifiers beyond
 * those already visible to the authenticated session.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const service = getServiceClient();

  // ── 1. Claim state ────────────────────────────────────────────────────────
  const { data: allClaims } = await service
    .from("person_claims")
    .select("person_id, claim_status, revoked_at, approved_at")
    .eq("user_id", user.id)
    .order("approved_at", { ascending: false });

  const approvedClaim = (allClaims ?? []).find(
    (c) => c.claim_status === "approved" && c.revoked_at === null
  );

  const hasApprovedClaim = !!approvedClaim;
  const claimPersonId: string | null = approvedClaim?.person_id ?? null;

  // ── 2. DB values for the claimed person ───────────────────────────────────
  let claimPersonPhotoPath: string | null = null;
  let claimPersonStatus: string | null = null;
  if (claimPersonId) {
    const { data: cp } = await service
      .from("persons")
      .select("photo_path, status")
      .eq("id", claimPersonId)
      .maybeSingle();
    claimPersonPhotoPath = cp?.photo_path ?? null;
    claimPersonStatus = cp?.status ?? null;
  }

  // ── 3. profiles.avatar_path for this user ─────────────────────────────────
  const { data: prof } = await service
    .from("profiles")
    .select("avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileAvatarPath: string | null = prof?.avatar_path ?? null;

  // ── 4. What the RPC returns for the "me" node ─────────────────────────────
  // Use the regular client so auth.uid() resolves correctly inside the RPC.
  const { data: graphData, error: graphError } = await supabase
    .rpc("get_my_family_graph", { p_depth: 2 } as never);

  let rpcMeId: string | null = null;
  let rpcMePhotoPath: string | null | undefined = "(not found in graph)";
  let rpcNodeCount: number | null = null;
  let rpcError: string | null = null;

  if (graphError) {
    rpcError = graphError.message;
  } else if (graphData) {
    rpcMeId = graphData.me ?? null;
    const nodes: Array<{ id: string; photo_path?: string | null }> = graphData.nodes ?? [];
    rpcNodeCount = nodes.length;
    const meNode = nodes.find((n) => n.id === rpcMeId);
    rpcMePhotoPath = meNode ? (meNode.photo_path ?? null) : "(me node not in nodes array)";
  }

  // ── 5. Mismatch detection ─────────────────────────────────────────────────
  const idMismatch = claimPersonId !== null && rpcMeId !== null && claimPersonId !== rpcMeId;

  return NextResponse.json({
    // Claim
    hasApprovedClaim,
    claimPersonId,
    claimPersonStatus,
    claimCount: (allClaims ?? []).length,
    allClaimStatuses: (allClaims ?? []).map((c) => c.claim_status),

    // DB values
    profileAvatarPath,
    claimPersonPhotoPath,

    // RPC
    rpcMeId,
    rpcMePhotoPath,
    rpcNodeCount,
    rpcError,

    // Diagnosis
    idMismatch,
    diagnosis: idMismatch
      ? "MISMATCH: endpoint writes to claimPersonId but RPC reads rpcMeId — photo never reaches /home"
      : claimPersonPhotoPath === null
      ? "photo_path is null for the claimed person — endpoint may have failed or not yet called"
      : rpcMePhotoPath === null
      ? "claimPerson has photo_path but RPC me node does not — likely id mismatch or RPC reads different person"
      : "chain appears intact",
  });
}
