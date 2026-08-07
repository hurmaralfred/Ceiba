import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

// GET /api/capsulas/[id]
// Returns the content of a capsula ONLY if:
//   - The requesting user is the recipient, AND
//   - unlock_date <= today
// Also marks opened_at on first read.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = params;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const service = getServiceClient();

  // Find the caller's approved person
  const { data: myClaim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", user.id)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (!myClaim?.person_id)
    return NextResponse.json({ error: "Sin identidad en el árbol" }, { status: 403 });

  const { data: row, error } = await service
    .from("future_messages")
    .select("id, recipient_person_id, unlock_date, content, opened_at, sender_user_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) return NextResponse.json({ error: "Cápsula no encontrada" }, { status: 404 });

  // Only the recipient can open
  if (row.recipient_person_id !== myClaim.person_id)
    return NextResponse.json({ error: "No eres el destinatario" }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);
  if (row.unlock_date > today)
    return NextResponse.json({ error: "Esta cápsula aún no puede abrirse" }, { status: 403 });

  // Mark as opened on first read
  if (!row.opened_at) {
    await service
      .from("future_messages")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", id);
  }

  return NextResponse.json({ content: row.content, opened_at: row.opened_at ?? new Date().toISOString() });
}
