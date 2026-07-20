// ============================================================
// CEIBA — Cliente TypeScript v2 (nuevo dominio)
// ============================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

// ---------------------------------------------------------------------------
// Tipos auxiliares derivados del esquema real
// ---------------------------------------------------------------------------

type PersonRow = Database["public"]["Tables"]["persons"]["Row"];
type PersonUpdate = Database["public"]["Tables"]["persons"]["Update"];
type BroadcastScope = Database["public"]["Enums"]["broadcast_scope"];
type SosAlertRow = Database["public"]["Tables"]["sos_alerts"]["Row"];
type ChatRoom = Database["public"]["Tables"]["chat_rooms"]["Row"];
type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];

type FindPersonMatchesResult =
  Database["public"]["Functions"]["find_person_matches"]["Returns"];

type UpcomingBirthdaysResult =
  Database["public"]["Functions"]["upcoming_birthdays"]["Returns"];

// ---------------------------------------------------------------------------
// Interfaz pública del cliente
// ---------------------------------------------------------------------------

export interface CeibaClient {
  raw: SupabaseClient<Database>;

  // Perfil (vía person_claims → persons)
  getMyProfile(): Promise<PersonRow | null>;
  updateMyProfile(patch: Partial<PersonUpdate>): Promise<PersonRow | null>;

  // Árbol
  getMyFamilyGraph(depth?: number): Promise<Record<string, unknown>>;

  // Matching
  findMatches(
    first_name: string,
    first_surname: string,
    second_surname?: string | null,
    birth_date?: string | null,
    birth_city?: string | null,
    birth_country?: string | null,
    known_parent_ids?: string[] | null,
    known_partner_ids?: string[] | null,
    known_child_ids?: string[] | null,
  ): Promise<FindPersonMatchesResult>;

  rejectMatch(candidateId: string): Promise<void>;

  // Cumpleaños
  upcomingBirthdays(days?: number): Promise<UpcomingBirthdaysResult>;

  // SOS
  triggerSOS(opts: {
    lat?: number;
    lon?: number;
    message?: string;
    scope?: number;
  }): Promise<string>;
  respondSOS(
    sosId: string,
    response: "coming" | "called" | "safe" | "other",
    message?: string,
  ): Promise<void>;
  cancelSOS(sosId: string): Promise<void>;
  subscribeSOS(
    onEvent: (row: SosAlertRow) => void,
  ): { unsubscribe: () => void };

  // Broadcast
  sendBroadcast(
    message: string,
    scope?: BroadcastScope,
  ): Promise<string>;

  // Push tokens
  registerPushToken(
    token: string,
    platform: "ios" | "android" | "web",
  ): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;

  // Chat
  listMyChatRooms(): Promise<Pick<ChatRoom, "id" | "name" | "type">[]>;
  sendChatMessage(
    roomId: string,
    body: string,
    mediaUrl?: string | null,
  ): Promise<string>;
  subscribeChatRoom(
    roomId: string,
    onMessage: (msg: ChatMessage) => void,
  ): { unsubscribe: () => void };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCeibaClient(
  url: string,
  anonKey: string,
): CeibaClient {
  const supabase: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  // Resolver el person_id actual a través de person_claims
  const getMyPersonId = async (): Promise<string | null> => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return null;

    const { data: claim } = await supabase
      .from("person_claims")
      .select("person_id")
      .eq("user_id", user.user.id)
      .eq("claim_status", "approved")
      .maybeSingle();

    return claim?.person_id ?? null;
  };

  return {
    raw: supabase,

    // ----------------------------------------------------------------
    // PERFIL
    // ----------------------------------------------------------------
    async getMyProfile() {
      const personId = await getMyPersonId();
      if (!personId) return null;

      const { data } = await supabase
        .from("persons")
        .select("*")
        .eq("id", personId)
        .maybeSingle();

      return data;
    },

    async updateMyProfile(patch) {
      const personId = await getMyPersonId();
      if (!personId) throw new Error("no session");

      const { data, error } = await supabase
        .from("persons")
        .update(patch)
        .eq("id", personId)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },

    // ----------------------------------------------------------------
    // ÁRBOL
    // ----------------------------------------------------------------
    async getMyFamilyGraph(depth = 3) {
      const { data, error } = await supabase.rpc("get_my_family_graph", {
        p_depth: depth,
      });
      if (error) throw error;
      return (data ?? {}) as Record<string, unknown>;
    },

    // ----------------------------------------------------------------
    // MATCHING
    // ----------------------------------------------------------------
    async findMatches(
      first_name,
      first_surname,
      second_surname = null,
      birth_date = null,
      birth_city = null,
      birth_country = null,
      known_parent_ids = null,
      known_partner_ids = null,
      known_child_ids = null,
    ) {
      const { data, error } = await supabase.rpc("find_person_matches", {
        p_first_name: first_name,
        p_first_surname: first_surname,
        p_second_surname: second_surname ?? undefined,
        p_birth_date: birth_date ?? undefined,
        p_birth_city: birth_city ?? undefined,
        p_birth_country: birth_country ?? undefined,
        p_known_parent_ids: known_parent_ids ?? undefined,
        p_known_partner_ids: known_partner_ids ?? undefined,
        p_known_child_ids: known_child_ids ?? undefined,
      });
      if (error) throw error;
      return (data ?? []) as FindPersonMatchesResult;
    },

    async rejectMatch(candidateId) {
      const { error } = await supabase.rpc("reject_match", {
        p_candidate: candidateId,
      });
      if (error) throw error;
    },

    // ----------------------------------------------------------------
    // CUMPLEAÑOS
    // ----------------------------------------------------------------
    async upcomingBirthdays(days = 30) {
      const { data, error } = await supabase.rpc("upcoming_birthdays", {
        days,
      });
      if (error) throw error;
      return (data ?? []) as UpcomingBirthdaysResult;
    },

    // ----------------------------------------------------------------
    // SOS
    // ----------------------------------------------------------------
    async triggerSOS(opts = {}) {
      const { lat, lon, message, scope = 2 } = opts;
      const { data, error } = await supabase.rpc("trigger_sos", {
        p_lat: lat ?? undefined,
        p_lon: lon ?? undefined,
        p_message: message ?? undefined,
        p_scope: scope,
      });
      if (error) throw error;
      return data as string;
    },

    async respondSOS(sosId, response, message) {
      const { error } = await supabase.rpc("respond_sos", {
        p_sos: sosId,
        p_response: response,
        p_message: message ?? undefined,
      });
      if (error) throw error;
    },

    async cancelSOS(sosId) {
      const { error } = await supabase.rpc("cancel_sos", {
        p_sos: sosId,
      });
      if (error) throw error;
    },

    subscribeSOS(onEvent) {
      const ch = supabase
        .channel("ceiba_sos")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sos_alerts" },
          (payload) => onEvent(payload.new as SosAlertRow),
        )
        .subscribe();
      return { unsubscribe: () => supabase.removeChannel(ch) };
    },

    // ----------------------------------------------------------------
    // BROADCAST
    // ----------------------------------------------------------------
    async sendBroadcast(message, scope = "direct_family") {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("no session");
      const { data, error } = await supabase
        .from("broadcasts")
        .insert({
          message,
          scope: scope as BroadcastScope,
          sender_user_id: user.user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (!data?.id) throw new Error("broadcast id is null");
      return data.id;
    },

    // ----------------------------------------------------------------
    // PUSH TOKENS
    // ----------------------------------------------------------------
    async registerPushToken(token, platform) {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("no session");
      const { error } = await supabase
        .from("push_tokens")
        .insert({ user_id: user.user.id, token, platform })
        .select();
      if (error) throw error;
    },

    async unregisterPushToken(token) {
      const { error } = await supabase
        .from("push_tokens")
        .delete()
        .eq("token", token);
      if (error) throw error;
    },

    // ----------------------------------------------------------------
    // CHAT
    // ----------------------------------------------------------------
    async listMyChatRooms() {
      const { data, error } = await supabase
        .from("chat_rooms")
        .select("id, name, type")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pick<ChatRoom, "id" | "name" | "type">[];
    },

    async sendChatMessage(roomId, body, mediaUrl) {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("no session");
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          room_id: roomId,
          sender_user_id: user.user.id,
          body,
          media_url: mediaUrl,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (!data?.id) throw new Error("chat message id is null");
      return data.id;
    },

    subscribeChatRoom(roomId, onMessage) {
      const ch = supabase
        .channel(`chat_${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `room_id=eq.${roomId}`,
          },
          (p) => onMessage(p.new as ChatMessage),
        )
        .subscribe();
      return { unsubscribe: () => supabase.removeChannel(ch) };
    },
  };
}