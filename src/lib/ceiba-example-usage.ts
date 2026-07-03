// ============================================================
// CEIBA — Ejemplos de uso del cliente
// ============================================================

import { createCeibaClient } from "./ceibaClient";
import type { AddRelativePayload } from "./ceiba-types";

const SUPABASE_URL  = process.env.SUPABASE_URL!;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY!;

const ceiba = createCeibaClient(SUPABASE_URL, SUPABASE_ANON);

// ------------------------------------------------------------
// 1) Login y perfil
// ------------------------------------------------------------
async function loginExample() {
  const { data, error } = await ceiba.raw.auth.signInWithPassword({
    email: "yo@correo.com",
    password: "***",
  });
  if (error) throw error;

  const me = await ceiba.getMyProfile();
  console.log("Mi perfil:", me);
}

// ------------------------------------------------------------
// 2) Ver mi árbol
// ------------------------------------------------------------
async function verMiArbol() {
  const graph = await ceiba.getMyFamilyGraph(4);
  console.log("Yo soy:", graph.me);
  console.log("Nodos:", graph.nodes.length);
  console.log("Aristas:", graph.edges.length);
}

// ------------------------------------------------------------
// 3) Agregar un familiar (con detección de duplicados)
// ------------------------------------------------------------
async function agregarPapa() {
  const payload: AddRelativePayload = {
    first_names: "Carlos",
    last_names: "Gómez",
    email: "carlos@correo.com",
    birth_date: "1965-08-20",
    birth_city: "Medellín",
    is_living: true,
  };

  const result = await ceiba.addRelative(payload, "parent_of");

  if (result.needs_confirmation) {
    console.log("Coincidencia encontrada:", result.match);
    // Mostrar modal al usuario y si confirma:
    // await ceiba.confirmMatch(result.candidate_id!);
    // O si rechaza:
    // await ceiba.rejectMatch(result.candidate_id!);
  } else {
    console.log("Papá creado:", result.person_id);
  }
}

// ------------------------------------------------------------
// 4) Cumpleaños próximos
// ------------------------------------------------------------
async function verCumples() {
  const bdays = await ceiba.upcomingBirthdays(30);
  for (const b of bdays) {
    console.log(`${b.full_name} cumple en ${b.days_until} días`);
  }
}

// ------------------------------------------------------------
// 5) Activar SOS
// ------------------------------------------------------------
async function activarSOS() {
  // Obtener ubicación del usuario (browser / mobile)
  const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject)
  );

  try {
    const sosId = await ceiba.triggerSOS({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      message: "Necesito ayuda, por favor.",
      scope: 2,
    });
    console.log("SOS activado:", sosId);
  } catch (e) {
    // Puede fallar por cooldown
    console.error("No se pudo activar SOS:", e);
  }
}

// ------------------------------------------------------------
// 6) Escuchar SOS en vivo (para recibir alertas de familiares)
// ------------------------------------------------------------
function escucharSOS() {
  const sub = ceiba.subscribeSOS((sos) => {
    console.log("🚨 Nuevo SOS recibido:", sos);
    // Mostrar pantalla dedicada al SOS con opciones de respuesta
  });

  // Cuando salgas de la app / componente:
  // sub.unsubscribe();
}

// ------------------------------------------------------------
// 7) Enviar broadcast familiar
// ------------------------------------------------------------
async function enviarBroadcast() {
  const id = await ceiba.sendBroadcast(
    "Este domingo hay reunión en casa de la abuela 🎉",
    "extended_family",
  );
  console.log("Broadcast enviado:", id);
}

// ------------------------------------------------------------
// 8) Chat familiar
// ------------------------------------------------------------
async function chatearConHermanos() {
  const rooms = await ceiba.listMyChatRooms();
  const hermanos = rooms.find((r) => r.kind === "siblings");
  if (!hermanos) return;

  // Suscribirse
  const sub = ceiba.subscribeChatRoom(hermanos.id, (msg) => {
    console.log("Nuevo mensaje:", msg);
  });

  // Enviar mensaje
  await ceiba.sendChatMessage(hermanos.id, "Buenos días, familia ✨");

  // Al salir:
  // sub.unsubscribe();
}

// ------------------------------------------------------------
// 9) Registrar push token (llamar tras obtener FCM token)
// ------------------------------------------------------------
async function registrarPushToken(fcmToken: string) {
  await ceiba.registerPushToken(fcmToken, "ios");
}
