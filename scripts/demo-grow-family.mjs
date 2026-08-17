#!/usr/bin/env node
/**
 * demo-grow-family.mjs
 * Agrega 4 nuevos familiares Vargas-Restrepo por día.
 * Simula cómo crece una galaxia familiar real: unos con cuenta en la app,
 * otros solo como persona en el árbol (parientes que aún no se unen).
 * Se ejecuta 1 vez/día vía cron.
 */

import { createClient } from "@supabase/supabase-js";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://txxdzxdzetqlfecqhxkl.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eGR6eGR6ZXRxbGZlY3FoeGtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ0MjE1OCwiZXhwIjoyMDk4MDE4MTU4fQ.0ymRFVpmkUHdxb0yQHCbSh8Tsa0REYdqOYnQ5ehLF4s";
const ANON_KEY     = "sb_publishable_DqXTl9m0osO7axGLJ6lbxw_3YQj3FsG";

// IDs fijos de la familia base
const P_CARLOS  = "9e9d369c-8235-4940-948e-5e92a228a063";
const P_ROSA    = "0eee1ba5-1d31-45f6-bd48-469f1a6d7c7c";
const P_LUIS    = "09aed339-09c6-4cae-96ba-57f0e2543daa";
const P_SOFIA   = "50ceeff0-8921-4775-a0e6-682d0216176b";
const P_VALEN   = "4663a364-e8de-4fe3-96a3-5481c103f0c7";

const U_CARLOS  = "aef9bbfb-445d-4494-807f-fecc88388c2d";
const SPACE_ID  = "a13dd08f-1075-427f-9547-b13491295ba5";
const GROUP_ROOM = "45ab360a-a90b-4a72-b179-b11d67cb1906";

const LOG_DIR   = "/Users/alfredohm/Ceiba/logs";
const STATE_FILE = join(LOG_DIR, "family-growth-state.json");
const LOG_FILE  = join(LOG_DIR, "family-growth.log");

// ── Catálogo completo de familiares a agregar ────────────────────────────────
// Cada grupo de 4 se agrega en un día.
// hasAccount=true → se crea usuario en auth + person_claim + se agrega al chat.
// parentId / partnerId → relación principal con persona existente o por ID de persona nueva.
// birthYear → para el perfil de la persona.

const FAMILY_CATALOG = [
  // Día 1 — Hermano de Carlos y su familia
  [
    { firstName: "Hernando",   surname: "Vargas",    gender: "male",   birthYear: 1952, city: "Manizales",  country: "Colombia", hasAccount: false,
      rel: { type: "sibling",  personBId: P_CARLOS } },
    { firstName: "Amparo",     surname: "Quintero",  gender: "female", birthYear: 1955, city: "Manizales",  country: "Colombia", hasAccount: false,
      rel: { type: "partner",  personBId: "Hernando" } },
    { firstName: "Andrés",     surname: "Vargas",    gender: "male",   birthYear: 1978, city: "Bogotá",     country: "Colombia", hasAccount: true,
      email: "andres.vargas.demo@ceibapp.test",
      rel: { type: "parent",   personBId: "Hernando", kind: "biological" } },
    { firstName: "Camila",     surname: "Vargas",    gender: "female", birthYear: 1981, city: "Medellín",   country: "Colombia", hasAccount: false,
      rel: { type: "parent",   personBId: "Hernando", kind: "biological" } },
  ],
  // Día 2 — Padres de Sofía
  [
    { firstName: "Roberto",    surname: "Montoya",   gender: "male",   birthYear: 1958, city: "Pereira",    country: "Colombia", hasAccount: false,
      rel: { type: "parent",   personBId: P_SOFIA,  kind: "biological" } },
    { firstName: "Gloria",     surname: "Salcedo",   gender: "female", birthYear: 1960, city: "Pereira",    country: "Colombia", hasAccount: true,
      email: "gloria.montoya.demo@ceibapp.test",
      rel: { type: "parent",   personBId: P_SOFIA,  kind: "biological" } },
    { firstName: "Julián",     surname: "Montoya",   gender: "male",   birthYear: 1985, city: "Cali",       country: "Colombia", hasAccount: false,
      rel: { type: "sibling",  personBId: P_SOFIA } },
    { firstName: "Natalia",    surname: "Montoya",   gender: "female", birthYear: 1988, city: "Bucaramanga", country: "Colombia", hasAccount: true,
      email: "natalia.montoya.demo@ceibapp.test",
      rel: { type: "sibling",  personBId: P_SOFIA } },
  ],
  // Día 3 — Esposa de Andrés + su hijo, hermana de Valentina
  [
    { firstName: "Marcela",    surname: "Ríos",      gender: "female", birthYear: 1980, city: "Bogotá",     country: "Colombia", hasAccount: false,
      rel: { type: "partner",  personBId: "Andrés" } },
    { firstName: "Sebastián",  surname: "Vargas",    gender: "male",   birthYear: 2005, city: "Bogotá",     country: "Colombia", hasAccount: true,
      email: "sebastian.vargas.demo@ceibapp.test",
      rel: { type: "parent",   personBId: "Andrés", kind: "biological" } },
    { firstName: "Isabella",   surname: "Vargas",    gender: "female", birthYear: 2010, city: "Medellín",   country: "Colombia", hasAccount: false,
      rel: { type: "parent",   personBId: P_LUIS, kind: "biological" } },
    { firstName: "Tío Jorge",  surname: "Restrepo",  gender: "male",   birthYear: 1960, city: "Pasto",      country: "Colombia", hasAccount: false,
      rel: { type: "sibling",  personBId: P_ROSA } },
  ],
  // Día 4 — Familia extendida Restrepo
  [
    { firstName: "Mercedes",   surname: "Castro",    gender: "female", birthYear: 1962, city: "Pasto",      country: "Colombia", hasAccount: false,
      rel: { type: "partner",  personBId: "Tío Jorge" } },
    { firstName: "Daniela",    surname: "Restrepo",  gender: "female", birthYear: 1990, city: "Cali",       country: "Colombia", hasAccount: true,
      email: "daniela.restrepo.demo@ceibapp.test",
      rel: { type: "parent",   personBId: "Tío Jorge", kind: "biological" } },
    { firstName: "Felipe",     surname: "Restrepo",  gender: "male",   birthYear: 1993, city: "Medellín",   country: "Colombia", hasAccount: false,
      rel: { type: "parent",   personBId: "Tío Jorge", kind: "biological" } },
    { firstName: "Valentina S.", surname: "Vargas",  gender: "female", birthYear: 2008, city: "Medellín",   country: "Colombia", hasAccount: false,
      rel: { type: "parent",   personBId: "Andrés", kind: "biological" } },
  ],
  // Día 5 — Abuelos maternos de Valentina / paternos de Sofía
  [
    { firstName: "Augusto",    surname: "Salcedo",   gender: "male",   birthYear: 1935, city: "Pereira",    country: "Colombia", hasAccount: false,
      rel: { type: "parent",   personBId: "Gloria", kind: "biological" } },
    { firstName: "Lucía",      surname: "Mejía",     gender: "female", birthYear: 1938, city: "Pereira",    country: "Colombia", hasAccount: false,
      rel: { type: "partner",  personBId: "Augusto" } },
    { firstName: "Tomás",      surname: "Vargas",    gender: "male",   birthYear: 2007, city: "Bogotá",     country: "Colombia", hasAccount: false,
      rel: { type: "parent",   personBId: "Andrés", kind: "biological" } },
    { firstName: "Pilar",      surname: "Montoya",   gender: "female", birthYear: 1955, city: "Pereira",    country: "Colombia", hasAccount: false,
      rel: { type: "sibling",  personBId: "Roberto" } },
  ],
  // Día 6 — Amigos de la familia que se unen a la app
  [
    { firstName: "Mauricio",   surname: "Gómez",     gender: "male",   birthYear: 1975, city: "Bogotá",     country: "Colombia", hasAccount: true,
      email: "mauricio.gomez.demo@ceibapp.test",
      rel: { type: "sibling",  personBId: "Julián" } },
    { firstName: "Paola",      surname: "Herrera",   gender: "female", birthYear: 1987, city: "Cali",       country: "Colombia", hasAccount: true,
      email: "paola.herrera.demo@ceibapp.test",
      rel: { type: "partner",  personBId: "Felipe" } },
    { firstName: "Emilio",     surname: "Restrepo",  gender: "male",   birthYear: 2015, city: "Medellín",   country: "Colombia", hasAccount: false,
      rel: { type: "parent",   personBId: "Felipe", kind: "biological" } },
    { firstName: "Sara",       surname: "Restrepo",  gender: "female", birthYear: 2018, city: "Medellín",   country: "Colombia", hasAccount: false,
      rel: { type: "parent",   personBId: "Felipe", kind: "biological" } },
  ],
  // Día 7 — Rama norteamericana de la familia
  [
    { firstName: "Miguel",     surname: "Vargas",    gender: "male",   birthYear: 1970, city: "Miami",      country: "Estados Unidos", hasAccount: true,
      email: "miguel.vargas.demo@ceibapp.test",
      rel: { type: "sibling",  personBId: "Hernando" } },
    { firstName: "Sandra",     surname: "López",     gender: "female", birthYear: 1972, city: "Miami",      country: "Estados Unidos", hasAccount: false,
      rel: { type: "partner",  personBId: "Miguel" } },
    { firstName: "Alejandro",  surname: "Vargas",    gender: "male",   birthYear: 1998, city: "New York",   country: "Estados Unidos", hasAccount: true,
      email: "alejandro.vargas.demo@ceibapp.test",
      rel: { type: "parent",   personBId: "Miguel", kind: "biological" } },
    { firstName: "Valeria",    surname: "Vargas",    gender: "female", birthYear: 2001, city: "Miami",      country: "Estados Unidos", hasAccount: false,
      rel: { type: "parent",   personBId: "Miguel", kind: "biological" } },
  ],
];

// ── Logging ───────────────────────────────────────────────────────────────────

function ensureLog() { if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true }); }
function log(msg) { const line = `[${new Date().toISOString()}] ${msg}\n`; ensureLog(); appendFileSync(LOG_FILE, line); process.stdout.write(line); }

// ── State ─────────────────────────────────────────────────────────────────────

function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { dayIndex: 0, personIds: {} }; }
}

function saveState(state) {
  ensureLog();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Core logic ────────────────────────────────────────────────────────────────

async function addFamilyGroup(service, group, state) {
  const newPersonIds = {}; // firstName → personId (for intra-group references)

  for (const member of group) {
    try {
      // 1. Create person record
      const { data: person, error: personErr } = await service
        .from("persons")
        .insert({
          first_name:    member.firstName,
          first_surname: member.surname,
          gender:        member.gender,
          birth_year:    member.birthYear,
          birth_city:    member.city,
          birth_country: member.country,
        })
        .select("id")
        .single();

      if (personErr || !person) { log(`✗ Person ${member.firstName}: ${personErr?.message}`); continue; }
      const personId = person.id;
      newPersonIds[member.firstName] = personId;
      state.personIds[member.firstName] = personId;
      log(`✓ Persona creada: ${member.firstName} ${member.surname} (${personId.slice(0, 8)})`);

      // 2. Resolve relationship target
      const relTarget = member.rel?.personBId;
      let targetPersonId = null;
      if (relTarget) {
        // Could be a person ID constant, a firstName from this group, or a firstName from state
        if (relTarget.length === 36 && relTarget.includes("-")) {
          targetPersonId = relTarget;
        } else {
          targetPersonId = newPersonIds[relTarget] ?? state.personIds[relTarget] ?? null;
        }
      }

      // 3. Insert relationship
      // Valid types: parent, partner, guardian. Siblings are represented through shared parents.
      if (targetPersonId && member.rel?.type && member.rel.type !== "sibling") {
        const relPayload = {
          person_a_id:         personId,
          person_b_id:         targetPersonId,
          relationship_type:   member.rel.type,
          relationship_status: "active",
          source:              "user_declared",
          created_by:          U_CARLOS,
        };
        if (member.rel.kind) relPayload.parent_kind = member.rel.kind;

        const { error: relErr } = await service.from("relationships").insert(relPayload);
        if (relErr) log(`  ✗ Relación ${member.firstName} → ${relTarget}: ${relErr.message}`);
        else log(`  ✓ Relación ${member.rel.type} con ${relTarget}`);
      } else if (member.rel?.type === "sibling") {
        log(`  · ${member.firstName} es hermano/a de ${relTarget} (en el mismo family space)`);
      }

      // 4. Add to family space membership
      await service.from("space_memberships").upsert(
        { space_id: SPACE_ID, person_id: personId },
        { onConflict: "space_id,person_id", ignoreDuplicates: true }
      );

      // 5. Create auth user + person_claim if hasAccount
      if (member.hasAccount && member.email) {
        const { data: authUser, error: authErr } = await service.auth.admin.createUser({
          email:         member.email,
          password:      "Demo1234!",
          email_confirm: true,
          user_metadata: { display_name: `${member.firstName} ${member.surname}` },
        });

        if (authErr || !authUser?.user) {
          log(`  ✗ Auth user ${member.email}: ${authErr?.message}`);
        } else {
          const uid = authUser.user.id;
          state.personIds[`${member.firstName}_uid`] = uid;

          // Update profile display name
          await service.from("profiles").upsert(
            { id: uid, display_name: `${member.firstName} ${member.surname}` },
            { onConflict: "id" }
          );

          // Create person_claim
          const { error: claimErr } = await service.from("person_claims").insert({
            user_id:      uid,
            person_id:    personId,
            claim_status: "approved",
            approved_at:  new Date().toISOString(),
          });
          if (claimErr) log(`  ✗ Claim ${member.firstName}: ${claimErr.message}`);
          else log(`  ✓ Auth + claim: ${member.email}`);

          // Add to group chat
          await service.from("chat_room_members").upsert(
            { room_id: GROUP_ROOM, user_id: uid },
            { onConflict: "room_id,user_id", ignoreDuplicates: true }
          );
          log(`  ✓ Agregado al chat grupal`);

          // Welcome message in chat
          await service.from("chat_messages").insert({
            room_id:          GROUP_ROOM,
            sender_user_id:   uid,
            body:             `¡Hola familia! Soy ${member.firstName} y acabo de unirme a la app 🎉`,
          });
        }
      }

    } catch (e) {
      log(`✗ EXCEPCIÓN ${member.firstName}: ${e.message}`);
    }
  }

  return newPersonIds;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const service = createClient(SUPABASE_URL, SERVICE_KEY);
  const state   = loadState();

  if (state.dayIndex >= FAMILY_CATALOG.length) {
    log("=== Catálogo completo — todos los familiares ya fueron agregados ✅ ===");
    return;
  }

  const group = FAMILY_CATALOG[state.dayIndex];
  log(`=== Día ${state.dayIndex + 1}: agregando ${group.length} familiares ===`);

  await addFamilyGroup(service, group, state);

  state.dayIndex++;
  saveState(state);

  log(`=== Listo. Próxima ejecución agregará el grupo ${state.dayIndex + 1}/${FAMILY_CATALOG.length} ===`);
}

run().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
