import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolveApprovedPersonId } from "@/lib/server/family";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const myPersonId = await resolveApprovedPersonId(service, user.id);
  if (!myPersonId) return NextResponse.json({ error: "Sin perfil" }, { status: 400 });

  const { data: graphData } = await supabase.rpc("get_my_family_graph", { p_depth: 4 });
  const graphNodes: any[] = graphData ? (graphData as any).nodes ?? [] : [];
  const allPersonIds = [...new Set([myPersonId, ...graphNodes.map((n: any) => n.id)])];

  const { data: persons } = await service
    .from("persons")
    .select("id, first_name, first_surname, birth_date, is_deceased, death_date")
    .in("id", allPersonIds)
    .order("birth_date");

  const today = new Date();
  const result = (persons ?? []).map((p: any) => {
    let daysUntil: number | null = null;
    if (p.birth_date) {
      const bd = new Date(p.birth_date);
      const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      if (next <= today) next.setFullYear(today.getFullYear() + 1);
      daysUntil = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
    return {
      name: `${p.first_name} ${p.first_surname}`,
      birth_date: p.birth_date ?? "❌ SIN FECHA",
      is_deceased: p.is_deceased,
      death_date: p.death_date,
      days_until_next_birthday: daysUntil,
    };
  }).sort((a: any, b: any) => (a.days_until_next_birthday ?? 9999) - (b.days_until_next_birthday ?? 9999));

  return NextResponse.json({
    total_in_graph: allPersonIds.length,
    with_birth_date: result.filter((p: any) => p.birth_date !== "❌ SIN FECHA").length,
    without_birth_date: result.filter((p: any) => p.birth_date === "❌ SIN FECHA").length,
    persons: result,
  });
}
