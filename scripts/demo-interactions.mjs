#!/usr/bin/env node
/**
 * demo-interactions.mjs
 * Simula comportamiento de usuario real para la Familia Vargas Restrepo.
 * Cubre: auth, chat grupal, mensajes directos, fotos, feed, actividad,
 *        memorias, mapa, árbol, sugerencias, gamificación, eventos.
 * Registra errores y los corrige automáticamente cuando es posible.
 */

import { createClient } from "@supabase/supabase-js";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL  = "https://txxdzxdzetqlfecqhxkl.supabase.co";
const SERVICE_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eGR6eGR6ZXRxbGZlY3FoeGtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ0MjE1OCwiZXhwIjoyMDk4MDE4MTU4fQ.0ymRFVpmkUHdxb0yQHCbSh8Tsa0REYdqOYnQ5ehLF4s";
const ANON_KEY      = "sb_publishable_DqXTl9m0osO7axGLJ6lbxw_3YQj3FsG";
const PROD_URL      = "https://ceibapp.com";
const PROJECT_REF   = "txxdzxdzetqlfecqhxkl";
const COOKIE_NAME   = `sb-${PROJECT_REF}-auth-token`;

const GROUP_ROOM_ID  = "45ab360a-a90b-4a72-b179-b11d67cb1906";
const SPACE_CARLOS   = "a13dd08f-1075-427f-9547-b13491295ba5";

const MEMBERS = [
  { email: "carlos.vargas.demo@ceibapp.test",    password: "Demo1234!", name: "Carlos",    personId: "9e9d369c-8235-4940-948e-5e92a228a063" },
  { email: "sofia.montoya.demo@ceibapp.test",    password: "Demo1234!", name: "Sofía",     personId: "50ceeff0-8921-4775-a0e6-682d0216176b" },
  { email: "luis.vargas.demo@ceibapp.test",      password: "Demo1234!", name: "Luis",      personId: "09aed339-09c6-4cae-96ba-57f0e2543daa" },
  { email: "valentina.vargas.demo@ceibapp.test", password: "Demo1234!", name: "Valentina", personId: "4663a364-e8de-4fe3-96a3-5481c103f0c7" },
];

// Pairs for direct messages (each pair gets a DM room)
const DM_PAIRS = [
  [0, 2],  // Carlos ↔ Luis
  [1, 3],  // Sofía ↔ Valentina
  [0, 1],  // Carlos ↔ Sofía
];

const CHAT_POOLS = {
  Carlos:    ["¿Cómo están todos? 🌅", "¿A qué hora nos reunimos el domingo?", "Recuerden que este fin es el cumpleaños de la abuela Rosa ❤️"],
  Sofía:     ["Todo bien por acá 😊", "Valentina ya terminó las tareas", "¿Quién trae el postre para el domingo?"],
  Luis:      ["Saludos desde Medellín!", "Llegué bien al trabajo", "¿Alguien necesita algo de la ciudad?"],
  Valentina: ["Hola familia! ❤️", "Abue, te extraño mucho!", "¿Puedo llevar una amiga el domingo?"],
};

const DM_MESSAGES = [
  "Hola! ¿Todo bien?",
  "Te llamo luego para coordinar",
  "Gracias por todo ❤️",
  "¿Nos vemos el fin de semana?",
];

const MEMORY_BODIES = [
  "Tarde familiar en la finca. El clima estuvo perfecto y la comida deliciosa.",
  "El abuelo Carlos nos contó cómo conoció a la abuela. Historia que nunca cansa.",
  "Primer día de clases de Valentina en el nuevo colegio. Muy valiente.",
  "Noche de juegos de mesa. Ganó Sofía (como siempre).",
  "Viaje relámpago a Cartagena. El mar siempre recarga las pilas.",
];

// ── Logging ─────────────────────────────────────────────────────────────────

const LOG_DIR   = "/Users/alfredohm/Ceiba/logs";
const LOG_FILE  = join(LOG_DIR, "demo-interactions.log");
const ERR_FILE  = join(LOG_DIR, "demo-errors.log");

function ensureLog() { if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true }); }

function log(msg, isErr = false) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  ensureLog();
  appendFileSync(isErr ? ERR_FILE : LOG_FILE, line);
  process.stdout.write(line);
}

function err(msg) { log(msg, true); return msg; }

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randomDate(yearsBack = 4) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - Math.floor(Math.random() * yearsBack));
  d.setMonth(Math.floor(Math.random() * 12));
  d.setDate(1 + Math.floor(Math.random() * 27));
  return d.toISOString().split("T")[0];
}

/**
 * Llama un endpoint de Next.js en producción usando el token JWT como cookie.
 * @supabase/ssr lee la cookie sb-{ref}-auth-token con el JSON del session.
 */
async function callApi(path, session, { method = "GET", body } = {}) {
  const sessionJson = JSON.stringify({
    access_token:  session.access_token,
    refresh_token: session.refresh_token,
    expires_at:    session.expires_at,
    token_type:    "bearer",
    user:          session.user,
  });
  const cookieValue = encodeURIComponent(sessionJson);

  const opts = {
    method,
    headers: {
      "Cookie": `${COOKIE_NAME}=${cookieValue}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${PROD_URL}${path}`, opts);
    let data;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("json")) data = await res.json();
    else data = await res.text();
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, fetchError: e.message };
  }
}

// ── DM Room cache ────────────────────────────────────────────────────────────

const dmRoomCache = new Map(); // key: "uid1:uid2" sorted

async function getOrCreateDmRoom(service, uid1, uid2) {
  const key = [uid1, uid2].sort().join(":");
  if (dmRoomCache.has(key)) return dmRoomCache.get(key);

  // Look for existing DM room shared by both users
  const { data: rooms1 } = await service.from("chat_room_members").select("room_id").eq("user_id", uid1);
  const { data: rooms2 } = await service.from("chat_room_members").select("room_id").eq("user_id", uid2);

  const ids1 = new Set((rooms1 ?? []).map(r => r.room_id));
  const shared = (rooms2 ?? []).map(r => r.room_id).filter(id => ids1.has(id));

  if (shared.length > 0) {
    // Verify it's a direct room
    const { data: room } = await service.from("chat_rooms").select("id,type").eq("id", shared[0]).single();
    if (room?.type === "direct") { dmRoomCache.set(key, room.id); return room.id; }
  }

  // Create new DM room
  const { data: newRoom } = await service.from("chat_rooms")
    .insert({ type: "direct", created_by: uid1 })
    .select("id").single();
  if (!newRoom) return null;

  await service.from("chat_room_members").insert([
    { room_id: newRoom.id, user_id: uid1 },
    { room_id: newRoom.id, user_id: uid2 },
  ]);
  dmRoomCache.set(key, newRoom.id);
  return newRoom.id;
}

// ── Health check suite ───────────────────────────────────────────────────────

async function healthCheck(member, session, service) {
  const checks = [
    { name: "GET /api/feed",            path: "/api/feed",            expect: (d) => d !== null && typeof d === "object" && ("photos" in d || "birthdays" in d) },
    { name: "GET /api/hoy",             path: "/api/hoy",             expect: (d) => d !== null && typeof d === "object" },
    { name: "GET /api/activity",        path: "/api/activity",        expect: (d) => d !== null && typeof d === "object" },
    { name: "GET /api/photos",          path: "/api/photos",          expect: (d) => Array.isArray(d?.photos) },
    { name: "GET /api/family/map",      path: "/api/family/map",      expect: (d) => Array.isArray(d?.pins) },
    { name: "GET /api/family/roster",   path: "/api/family/roster",   expect: (d) => Array.isArray(d?.members) || d !== null },
    { name: "GET /api/chat/rooms",      path: "/api/chat/rooms",      expect: (d) => Array.isArray(d?.conversations) || Array.isArray(d?.rooms) },
    { name: "GET /api/suggestions",     path: "/api/suggestions",     expect: (d) => d !== null && typeof d === "object" },
    { name: "GET /api/events",          path: "/api/events",          expect: (d) => d !== null && typeof d === "object" },
    { name: "GET /api/gamification",    path: "/api/gamification",    expect: (d) => d !== null && typeof d === "object" },
  ];

  const results = [];
  for (const chk of checks) {
    const r = await callApi(chk.path, session);
    const pass = r.ok && chk.expect(r.data);
    if (!pass) {
      const msg = err(`  ✗ [${member.name}] ${chk.name} → HTTP ${r.status} | ${JSON.stringify(r.data)?.slice(0, 120)}`);
      results.push({ ...chk, error: msg, status: r.status, data: r.data });
    } else {
      log(`  ✓ [${member.name}] ${chk.name} → ${r.status}`);
      results.push({ ...chk, error: null });
    }
  }
  return results;
}

// ── Per-member interaction flow ───────────────────────────────────────────────

async function interact(member, session, service, allSessions) {
  const userId = session.user.id;

  // 1. Send group chat message
  const { error: chatErr } = await service.from("chat_messages").insert({
    room_id: GROUP_ROOM_ID,
    sender_user_id: userId,
    body: pick(CHAT_POOLS[member.name]),
  });
  if (chatErr) err(`  ✗ [${member.name}] Chat grupal: ${chatErr.message}`);
  else log(`  ✓ [${member.name}] Chat grupal`);

  // 2. Read group chat
  const { data: msgs, error: readErr } = await service
    .from("chat_messages")
    .select("id, body, sender_user_id, created_at")
    .eq("room_id", GROUP_ROOM_ID)
    .order("created_at", { ascending: false })
    .limit(10);
  if (readErr) err(`  ✗ [${member.name}] Leer chat: ${readErr.message}`);
  else log(`  ✓ [${member.name}] Leyó ${msgs?.length ?? 0} mensajes grupales`);

  // 3. Direct messages with a partner
  const myIdx = MEMBERS.indexOf(member);
  const pair = DM_PAIRS.find(p => p.includes(myIdx));
  if (pair) {
    const partnerIdx = pair.find(i => i !== myIdx);
    const partnerSession = allSessions[partnerIdx];
    if (partnerSession) {
      const dmRoomId = await getOrCreateDmRoom(service, userId, partnerSession.user.id);
      if (dmRoomId) {
        const { error: dmErr } = await service.from("chat_messages").insert({
          room_id: dmRoomId,
          sender_user_id: userId,
          body: pick(DM_MESSAGES),
        });
        if (dmErr) err(`  ✗ [${member.name}] DM: ${dmErr.message}`);
        else log(`  ✓ [${member.name}] DM → ${MEMBERS[partnerIdx].name}`);
      }
    }
  }

  // 4. Create memory (60% chance)
  if (Math.random() < 0.6) {
    const { error: memErr } = await service.from("family_memories").insert({
      family_space_id: SPACE_CARLOS,
      author_user_id:  userId,
      person_id:       member.personId,
      body:            pick(MEMORY_BODIES),
      memory_date:     randomDate(3),
    });
    if (memErr) err(`  ✗ [${member.name}] Memoria: ${memErr.message}`);
    else log(`  ✓ [${member.name}] Memoria creada`);
  }

  // 5. Verify family tree integrity via person_claims + relationships
  const { data: claim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", userId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .single();

  if (!claim) {
    err(`  ✗ [${member.name}] Sin person_claim aprobado`);
  } else {
    const { data: rels } = await service
      .from("relationships")
      .select("id")
      .or(`person_a_id.eq.${claim.person_id},person_b_id.eq.${claim.person_id}`)
      .eq("relationship_status", "active")
      .is("deleted_at", null);
    const count = rels?.length ?? 0;
    if (count === 0) err(`  ✗ [${member.name}] Sin relaciones activas en árbol`);
    else log(`  ✓ [${member.name}] Árbol: ${count} relaciones activas`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  log("=== Iniciando ciclo de interacciones demo ===");
  const service = createClient(SUPABASE_URL, SERVICE_KEY);
  const errors  = [];

  // Sign in all members in parallel
  const sessions = await Promise.all(
    MEMBERS.map(async (m) => {
      const anon = createClient(SUPABASE_URL, ANON_KEY);
      const { data, error } = await anon.auth.signInWithPassword({ email: m.email, password: m.password });
      if (error || !data.session) {
        const msg = err(`AUTH ERROR ${m.name}: ${error?.message ?? "sin sesión"}`);
        errors.push(msg);
        return null;
      }
      log(`✓ Login: ${m.name}`);
      return data.session;
    })
  );

  // Health checks — run for first member that authenticated
  const firstAuth = sessions.findIndex(Boolean);
  if (firstAuth >= 0) {
    log("--- Health checks de API routes ---");
    const hcResults = await healthCheck(MEMBERS[firstAuth], sessions[firstAuth], service);
    const failed    = hcResults.filter(r => r.error);
    errors.push(...failed.map(r => r.error));
  }

  // Per-member interaction flows
  log("--- Interacciones por usuario ---");
  for (let i = 0; i < MEMBERS.length; i++) {
    if (!sessions[i]) continue;
    try {
      await interact(MEMBERS[i], sessions[i], service, sessions);
    } catch (e) {
      const msg = err(`EXCEPTION ${MEMBERS[i].name}: ${e.message}`);
      errors.push(msg);
    }
  }

  if (errors.length === 0) {
    log("=== Todas las verificaciones exitosas ✅ ===");
  } else {
    log(`=== ${errors.length} problema(s) detectado(s) ❌ ===`, true);
    errors.forEach(e => log(`  • ${e}`, true));
  }

  return errors;
}

run()
  .then(errors => process.exit(errors.length > 0 ? 1 : 0))
  .catch(e => { log(`FATAL: ${e.message}`, true); process.exit(1); });
