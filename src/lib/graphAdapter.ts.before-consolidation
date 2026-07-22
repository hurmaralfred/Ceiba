/**
 * graphAdapter.ts
 * Convierte FamilyGraph (persons + relationships) al formato legacy
 * que espera FamilyTreeGraph (FamilyMember[], ExtendedEntry[], MemberLink[]).
 */

import { FamilyMember, Profile, RelationType, BLOOD_RELATIONS } from "./types";
import { inferRelation, reverseRelation } from "./relations";
import type { ExtendedEntry, MemberLink } from "@/components/tree/FamilyTreeGraph";

// --- Tipos del nuevo esquema de grafo ---

export interface PersonNode {
  id: string;
  first_names: string;
  last_names: string;
  email?: string | null;
  birth_date?: string | null;
  birth_city?: string | null;
  profile_photo_url?: string | null;
  is_living: boolean;
  linked_user_id?: string | null;
  gender?: "M" | "F" | "X" | "unknown" | null;
  bio?: string | null;
  normalized_name?: string | null;
  status?: string;
  verification_level?: string;
  created_at: string;
  updated_at: string;
}

export interface EdgeNode {
  id: string;
  person_a_id: string;
  person_b_id: string;
  relationship_type:
    | "parent_of"
    | "partner_of"
    | "sibling_of"
    | "half_sibling_of"
    | "guardian_of"
    | "adoptive_parent_of";
  status: string;
  created_at: string;
  pair_key?: string;
  confidence_score?: number;
  source?: string;
}

export interface FamilyGraph {
  me: string;          // person_id del usuario actual
  nodes: PersonNode[];
  edges: EdgeNode[];
}

// --- Mapeo de relationship_type > RelationType ---

export function edgeToRelationType(
  edge: EdgeNode,
  viewerPersonId: string,
  otherGender: string | null | undefined
): RelationType {
  const iAmA    = edge.person_a_id === viewerPersonId;
  const isFemale = otherGender === "F";
  const isMale   = otherGender === "M";

  switch (edge.relationship_type) {
    case "parent_of":
      if (!iAmA) return isFemale ? "mother" : "father";
      return isFemale ? "daughter" : "son";

    case "partner_of":
      return isFemale ? "partner" : "spouse";

    case "sibling_of":
      return isFemale ? "sister" : "brother";

    case "half_sibling_of":
      return isFemale ? "half_sister" : "half_brother";

    case "guardian_of":
      if (!iAmA) return isFemale ? "stepmother" : "stepfather";
      return "stepchild";

    case "adoptive_parent_of":
      if (!iAmA) return isFemale ? "mother" : "father";
      return isFemale ? "daughter" : "son";

    default:
      return "other";
  }
}

// --- Convertir PersonNode > Profile ---

export function personToProfile(p: PersonNode): Profile {
  return {
    id: p.linked_user_id || p.id,
    first_name: p.first_names || "",
    last_name: p.last_names || "",
    email: p.email || undefined,
    avatar_url: p.profile_photo_url || undefined,
    bio: p.bio || undefined,
    location_enabled: false,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

// --- Convertir PersonNode + edge > FamilyMember ---

function personToFamilyMember(
  person: PersonNode,
  relationType: RelationType,
  myUserId: string
): FamilyMember {
  return {
    id: person.id,                               // person.id como identificador de nodo
    added_by: myUserId,
    profile_id: person.linked_user_id || undefined,
    first_name: person.first_names || "",
    last_name: person.last_names || undefined,
    email: person.email || undefined,
    relation_type: relationType,
    relation_kind: BLOOD_RELATIONS.has(relationType) ? "blood" : "affinity",
    invitation_sent: false,
    is_deceased: !person.is_living,
    created_at: person.created_at,
    profile: person.linked_user_id
      ? {
          id: person.linked_user_id,
          first_name: person.first_names || "",
          last_name: person.last_names || "",
          avatar_url: person.profile_photo_url || undefined,
          location_enabled: false,
          created_at: person.created_at,
          updated_at: person.updated_at,
        }
      : undefined,
  } as FamilyMember;
}

// --- Función principal: FamilyGraph > {members, extendedMembers, memberLinks} ---

export function adaptGraph(
  graph: FamilyGraph,
  myUserId: string
): {
  profile: Profile | null;
  members: FamilyMember[];
  extendedMembers: ExtendedEntry[];
  memberLinks: MemberLink[];
} {
  const { me: myPersonId, nodes, edges } = graph;

  // Index nodes and edges for fast lookup
  const nodeById = new Map<string, PersonNode>(nodes.map((n) => [n.id, n]));

  const myNode = nodeById.get(myPersonId);
  if (!myNode) return { profile: null, members: [], extendedMembers: [], memberLinks: [] };

  const profile = personToProfile(myNode);

  // BFS for relation labels
  // Map: personId > RelationType (as seen FROM the current user)
  const relationFromMe = new Map<string, RelationType>();
  const visited = new Set<string>([myPersonId]);
  const queue: Array<{ personId: string; depth: number; parentId: string | null }> = [
    { personId: myPersonId, depth: 0, parentId: null },
  ];

  // Depth-1 neighbors: direct edges touching myPersonId
  const directEdges = edges.filter(
    (e) => e.person_a_id === myPersonId || e.person_b_id === myPersonId
  );

  for (const edge of directEdges) {
    const otherId = edge.person_a_id === myPersonId ? edge.person_b_id : edge.person_a_id;
    if (visited.has(otherId)) continue;
    const otherNode = nodeById.get(otherId);
    if (!otherNode) continue;
    const rel = edgeToRelationType(edge, myPersonId, otherNode.gender);
    relationFromMe.set(otherId, rel);
    visited.add(otherId);
  }

  // Depth 2+: BFS through the graph using inferRelation
  const bfsQueue = Array.from(relationFromMe.entries()).map(([id, rel]) => ({ id, rel }));
  while (bfsQueue.length > 0) {
    const { id: parentId, rel: parentRel } = bfsQueue.shift()!;
    const neighborEdges = edges.filter(
      (e) => e.person_a_id === parentId || e.person_b_id === parentId
    );
    for (const edge of neighborEdges) {
      const childId = edge.person_a_id === parentId ? edge.person_b_id : edge.person_a_id;
      if (visited.has(childId)) continue;
      const childNode = nodeById.get(childId);
      if (!childNode) continue;
      // Edge relation FROM parent's perspective
      const edgeRel = edgeToRelationType(edge, parentId, childNode.gender);
      const inferredRel = inferRelation(parentRel, edgeRel);
      if (!inferredRel) continue;
      relationFromMe.set(childId, inferredRel as RelationType);
      visited.add(childId);
      bfsQueue.push({ id: childId, rel: inferredRel as RelationType });
    }
  }

  // Build members (depth 1 = directly connected to me)
  const directPersonIds = new Set(
    directEdges.flatMap((e) => [e.person_a_id, e.person_b_id]).filter((id) => id !== myPersonId)
  );

  const members: FamilyMember[] = [];
  for (const personId of directPersonIds) {
    const node = nodeById.get(personId);
    const rel = relationFromMe.get(personId);
    if (!node || !rel) continue;
    members.push(personToFamilyMember(node, rel, myUserId));
  }

  // Build extended members (depth 2+)
  const extendedMembers: ExtendedEntry[] = [];
  for (const [personId, rel] of relationFromMe.entries()) {
    if (personId === myPersonId) continue;
    if (directPersonIds.has(personId)) continue;
    const node = nodeById.get(personId);
    if (!node) continue;
    const member = personToFamilyMember(node, rel, myUserId);
    // Find the "entry point" — the direct member that connects this person
    const connectingEdge = edges.find(
      (e) =>
        (e.person_a_id === personId || e.person_b_id === personId) &&
        (directPersonIds.has(e.person_a_id) || directPersonIds.has(e.person_b_id))
    );
    const parentMemberId =
      connectingEdge
        ? connectingEdge.person_a_id === personId
          ? connectingEdge.person_b_id
          : connectingEdge.person_a_id
        : "";
    extendedMembers.push({
      member,
      parentMemberId,
      inferredRelation: rel,
    });
  }

  // Build member links (edges between non-me nodes)
  const memberLinks: MemberLink[] = [];
  for (const edge of edges) {
    if (edge.person_a_id === myPersonId || edge.person_b_id === myPersonId) continue;
    const aRel = relationFromMe.get(edge.person_a_id);
    const bRel = relationFromMe.get(edge.person_b_id);
    if (!aRel || !bRel) continue;
    const edgeRel = edgeToRelationType(edge, edge.person_a_id, nodeById.get(edge.person_b_id)?.gender);
    memberLinks.push({
      fromMemberId: edge.person_a_id,
      toMemberId: edge.person_b_id,
      relation: edgeRel,
    });
  }

  return { profile, members, extendedMembers, memberLinks };
}

// --- Mapeo inverso: RelationType > relationship_type para add_relative ---

export function relationTypeToGraphType(
  rel: RelationType
): "parent_of" | "partner_of" | "sibling_of" | "half_sibling_of" | "guardian_of" {
  const MAP: Record<RelationType, "parent_of" | "partner_of" | "sibling_of" | "half_sibling_of" | "guardian_of"> = {
    father: "parent_of",    mother: "parent_of",
    son: "parent_of",       daughter: "parent_of",
    brother: "sibling_of",  sister: "sibling_of",
    half_brother: "half_sibling_of", half_sister: "half_sibling_of",
    spouse: "partner_of",   partner: "partner_of",
    stepfather: "guardian_of", stepmother: "guardian_of",
    stepchild: "guardian_of",
    nephew: "sibling_of",   niece: "sibling_of",
    uncle: "parent_of",     aunt: "parent_of",
    grandfather_paternal: "parent_of", grandmother_paternal: "parent_of",
    grandfather_maternal: "parent_of", grandmother_maternal: "parent_of",
    grandson: "parent_of",  granddaughter: "parent_of",
    cousin: "sibling_of",
    father_in_law: "parent_of", mother_in_law: "parent_of",
    brother_in_law: "sibling_of", sister_in_law: "sibling_of",
    other: "sibling_of",
  };
  return MAP[rel] ?? "sibling_of";
}
