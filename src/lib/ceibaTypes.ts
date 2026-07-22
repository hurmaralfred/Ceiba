// ============================================================
// CEIBA — Tipos TypeScript compartidos con el cliente
// ============================================================

export type Gender = "M" | "F" | "X" | "unknown";

export type PersonStatus =
  | "active" | "pending_merge" | "merged" | "unverified" | "deleted";

export type VerificationLevel =
  | "unverified" | "family_verified" | "self_verified";

export type RelationshipType =
  | "parent"
  | "partner"
  | "guardian";

export type RelationshipStatus =
  | "pending" | "confirmed" | "rejected" | "system_inferred";

export type MatchStatus =
  | "pending" | "confirmed" | "rejected" | "auto_confirmed";

export type SosStatus =
  | "active" | "resolved" | "cancelled" | "expired";

export type BroadcastScope =
  | "direct_family" | "extended_family" | "specific_branch" | "all";

export interface Person {
  id: string;
  first_names: string;
  last_names: string;
  normalized_name?: string;
  email?: string | null;
  birth_date?: string | null;
  birth_city?: string | null;
  birth_country?: string | null;
  profile_photo_url?: string | null;
  photo_hash?: string | null;
  is_living: boolean;
  death_date?: string | null;
  gender: Gender;
  created_by_user_id?: string | null;
  linked_user_id?: string | null;
  status: PersonStatus;
  verification_level: VerificationLevel;
  bio?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Relationship {
  id: string;
  person_a_id: string;
  person_b_id: string;
  relationship_type: RelationshipType;
  pair_key?: string;
  source?: string;
  declared_by_user_id?: string | null;
  confidence_score?: number;
  status: RelationshipStatus;
  system_inferred: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyGraph {
  me: string | null;
  nodes: Person[];
  edges: Relationship[];
}

export interface UpcomingBirthday {
  person_id: string;
  full_name: string;
  profile_photo_url?: string | null;
  birth_date: string;
  next_birthday: string;
  days_until: number;
}

export interface AddRelativePayload {
  first_names: string;
  last_names: string;
  email?: string;
  birth_date?: string;   // YYYY-MM-DD
  birth_city?: string;
  profile_photo_url?: string;
  is_living?: boolean;
  death_date?: string;
  gender?: Gender;
}

export interface AddRelativeResult {
  needs_confirmation: boolean;
  candidate_id?: string;
  person_id?: string;
  relationship_id?: string;
  match?: {
    person_id: string;
    score: number;
    breakdown: Record<string, unknown>;
    matched_person: Person;
  };
}

export interface SosAlert {
  id: string;
  sender_user_id: string;
  lat?: number | null;
  lon?: number | null;
  message?: string | null;
  status: SosStatus;
  scope_degree: number;
  triggered_at: string;
  resolved_at?: string | null;
  cooldown_until?: string | null;
}
