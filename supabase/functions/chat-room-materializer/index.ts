// ============================================================
// CEIBA — Edge Function: chat-room-materializer
// ------------------------------------------------------------
// Cada hora (o disparado por webhook al confirmarse relationships)
// recrea/actualiza los chat_rooms derivados del grafo.
//
// Chats generados:
//   - siblings (hermanos)
//   - parents_children (yo + mis hijos)
//   - all_family (rama entera, opcional)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function ensureRoom(kind: string, title: string, rootPersonId: string, members: string[]) {
  if (members.length < 2) return; // no crear sala con 1 miembro

  // Buscar sala existente por kind + root
  const { data: existing } = await admin
    .from("chat_rooms")
    .select("id")
    .eq("kind", kind)
    .eq("root_person_id", rootPersonId)
    .maybeSingle();

  let roomId: string;
  if (existing) {
    roomId = existing.id;
  } else {
    const { data: created, error } = await admin
      .from("chat_rooms")
      .insert({ kind, title, root_person_id: rootPersonId })
      .select("id")
      .single();
    if (error) throw error;
    roomId = created.id;
  }

  // Upsert de miembros
  const rows = members.map((pid) => ({ room_id: roomId, person_id: pid }));
  await admin.from("chat_room_members").upsert(rows, { onConflict: "room_id,person_id" });
}

Deno.serve(async (_req) => {
  // 1) todas las personas con hermanos confirmados
  const { data: siblings } = await admin
    .from("relationships")
    .select("person_a_id, person_b_id")
    .eq("relationship_type", "sibling_of")
    .eq("status", "confirmed");

  // Agrupar por conjunto de hermanos (union-find informal por pares)
  const groups = new Map<string, Set<string>>();
  for (const s of siblings ?? []) {
    const a = s.person_a_id, b = s.person_b_id;
    const key = [a, b].sort().join("|");
    // Buscar si a o b ya están en algún grupo
    let existingKey: string | null = null;
    for (const [k, set] of groups) {
      if (set.has(a) || set.has(b)) { existingKey = k; break; }
    }
    if (existingKey) {
      groups.get(existingKey)!.add(a);
      groups.get(existingKey)!.add(b);
    } else {
      groups.set(key, new Set([a, b]));
    }
  }

  // Crear una sala 'siblings' por cada grupo
  for (const [_k, set] of groups) {
    const members = Array.from(set);
    const root = members.sort()[0]; // primer id como root
    await ensureRoom("siblings", "Hermanos", root, members);
  }

  // 2) cada padre confirmado + sus hijos
  const { data: parents } = await admin
    .from("relationships")
    .select("person_a_id, person_b_id")
    .eq("relationship_type", "parent_of")
    .eq("status", "confirmed");

  const byParent = new Map<string, Set<string>>();
  for (const p of parents ?? []) {
    if (!byParent.has(p.person_a_id)) byParent.set(p.person_a_id, new Set());
    byParent.get(p.person_a_id)!.add(p.person_b_id);
  }
  for (const [parentId, children] of byParent) {
    const members = [parentId, ...children];
    if (members.length >= 2) {
      await ensureRoom("parents_children", "Con mis hijos", parentId, members);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sibling_groups: groups.size, parent_groups: byParent.size }),
    { headers: { "Content-Type": "application/json" } },
  );
});
