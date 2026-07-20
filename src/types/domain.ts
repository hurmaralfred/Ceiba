import type { Database } from "./database.types";

export type Person =
  Database["public"]["Tables"]["persons"]["Row"];

export type Relationship =
  Database["public"]["Tables"]["relationships"]["Row"];

export type FamilySpace =
  Database["public"]["Tables"]["family_spaces"]["Row"];

export type Profile =
  Database["public"]["Tables"]["profiles"]["Row"];

export type PersonClaim =
  Database["public"]["Tables"]["person_claims"]["Row"];

export type RelationshipType =
  Database["public"]["Enums"]["relationship_type"];

export type ClaimStatus =
  Database["public"]["Enums"]["claim_status"];

export interface FamilyGraph {
  me: string | null;
  nodes: Person[];
  edges: Relationship[];
}
