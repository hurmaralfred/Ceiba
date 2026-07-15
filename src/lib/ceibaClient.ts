// ============================================================
// CEIBA — Cliente TypeScript
// Wrapper sobre @supabase/supabase-js con todos los métodos
// de dominio (árbol, familia, SOS, cumpleaños, broadcast, chat).
// ============================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  AddRelativePayload,
  AddRelativeResult,
  FamilyGraph,
  Person,
  Relationship,
  RelationshipType,
  SosAlert,
  UpcomingBirthday,
} from "./types";

export interface CeibaClient {
  raw: SupabaseClient;

  // Perfil
  getMyProfile(): Promise<Person | null>;
  updateMyProfile(patch: Partial<Person>): Promise<Person | null>;

  // Árbol
  getMyFamilyGraph(depth?: number): Promise<FamilyGraph>;

  // Familiares
  addRelative(payload: AddRelativePayload, rel: RelationshipType): Promise<AddRelativeResult>;
  confirmMatch(candidateId: string): Promise<string>;   // devuelve relationship_id
  rejectMatch(candidateId: string): Promise<void>;
  async findMatches(payload: AddRelativePayload): Promise<PersonMatch[]> {
  const { data, error } = await supabase.rpc("find_person_matches", {
    payload: payload as unknown as Record<string, unknown>,
  });
  if (error) throw error;
  return (data ?? []) as PersonMatch[];
},
    person_id: string;
    score: number;
    breakdown: Record<string, unknown>;
    matched_person: Person;
  }>>;

  // Cumpleaños
  upcomingBirthdays(days?: number): Promise<UpcomingBirthday[]>;

  // SOS
  triggerSOS(opts: { lat?: number; lon?: number; message?: string; scope?: number }): Promise<string>;
  respondSOS(sosId: string, response: "coming"|"called"|"safe"|"other", message?: string): Promise<void>;
  cancelSOS(sosId: string): Promise<void>;
  subscribeSOS(onEvent: (row: SosAlert) => void): { unsubscribe: () => void };

  // Broadcast
  sendBroadcast(message: string, scope?: "direct_family" | "extended_family" | "all"): Promise<string>;

  // Push tokens
  registerPushToken(token: string, platform: "ios"|"android"|"web"): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;

  // Chat
  listMyChatRooms(): Promise<Array<{ id: string; title: string; kind: string }>>;
  sendChatMessage(roomId: string, body: string, mediaUrl?: string): Promise<string>;
  subscribeChatRoom(roomId: string, onMessage: (msg: any) => void): { unsubscribe: () => void };
}

export function createCeibaClient(url: string, anonKey: string): CeibaClient {
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  return {
    raw: supabase,

    async getMyProfile() {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      const { data } = await supabase
        .from("persons")
        .select("*")
        .eq("linked_user_id", user.user.id)
        .maybeSingle();
      return data as Person | null;
    },

    async updateMyProfile(patch) {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("no session");
      const { data, error } = await supabase
        .from("persons")
        .update(patch)
        .eq("linked_user_id", user.user.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Person;
    },

    async getMyFamilyGraph(depth = 3) {
      const { data, error } = await supabase.rpc("get_my_family_graph", { depth });
      if (error) throw error;
      return data as FamilyGraph;
    },

    async findMatches(payload) {
      const { data, error } = await supabase.rpc("find_person_matches", {
        payload: payload as unknown as Record<string, unknown>,
      });
      if (error) throw error;
      return data as any;
    },

    async addRelative(payload, rel) {
      const { data, error } = await supabase.rpc("add_relative", {
        p_payload: payload,
        p_relationship: rel,
      });
      if (error) throw error;
      return data as AddRelativeResult;
    },

    async confirmMatch(candidateId) {
      const { data, error } = await supabase.rpc("confirm_match", { p_candidate: candidateId });
      if (error) throw error;
      return data as string;
    },

    async rejectMatch(candidateId) {
      const { error } = await supabase.rpc("reject_match", { p_candidate: candidateId });
      if (error) throw error;
    },

    async upcomingBirthdays(days = 30) {
      const { data, error } = await supabase.rpc("upcoming_birthdays", { days });
      if (error) throw error;
      return (data ?? []) as UpcomingBirthday[];
    },

    async triggerSOS({ lat, lon, message, scope = 2 } = {} as any) {
      const { data, error } = await supabase.rpc("trigger_sos", {
        p_lat: lat ?? null,
        p_lon: lon ?? null,
        p_message: message ?? null,
        p_scope: scope,
      });
      if (error) throw error;
      return data as string;
    },

    async respondSOS(sosId, response, message) {
      const { error } = await supabase.rpc("respond_sos", {
        p_sos: sosId,
        p_response: response,
        p_message: message ?? null,
      });
      if (error) throw error;
    },

    async cancelSOS(sosId) {
      const { error } = await supabase.rpc("cancel_sos", { p_sos: sosId });
      if (error) throw error;
    },

    subscribeSOS(onEvent) {
      const ch = supabase
        .channel("ceiba_sos")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sos_alerts" },
          (payload) => onEvent(payload.new as SosAlert),
        )
        .subscribe();
      return { unsubscribe: () => supabase.removeChannel(ch) };
    },

    async sendBroadcast(message, scope = "direct_family") {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("no session");
      const { data, error } = await supabase
        .from("broadcasts")
        .insert({ message, scope, sender_user_id: user.user.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },

    async registerPushToken(token, platform) {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("no session");
      const { error } = await supabase
        .from("push_tokens")
        .upsert(
          { user_id: user.user.id, token, platform },
          { onConflict: "token" },
        );
      if (error) throw error;
    },

    async unregisterPushToken(token) {
      const { error } = await supabase.from("push_tokens").delete().eq("token", token);
      if (error) throw error;
    },

    async listMyChatRooms() {
      const { data, error } = await supabase
        .from("chat_rooms")
        .select("id, title, kind")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
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
      return data.id as string;
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
          (p) => onMessage(p.new),
        )
        .subscribe();
      return { unsubscribe: () => supabase.removeChannel(ch) };
    },
  };
}
