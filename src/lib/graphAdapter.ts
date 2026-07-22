/**
 * Adaptador temporal de presentación.
 *
 * Convierte el grafo canónico:
 *   persons + relationships
 *
 * al formato que todavía consume FamilyTreeGraph.
 *
 * El modelo persistido solo admite:
 *   parent | partner | guardian
 */

import type {
  FamilyMember,
  Profile,
  RelationType,
} from "./types";
import { BLOOD_RELATIONS } from "./types";
import { inferRelation } from "./relations";
import type {
  ExtendedEntry,
  MemberLink,
} from "@/components/tree/FamilyTreeGraph";
import {
  planRelationship,
  type PrimitiveRelationship,
} from "@/domain/relationships";

export interface PersonNode {
  id: string;
  public_id: string;
  first_name: string;
  middle_name?: string | null;
  first_surname: string;
  second_surname?: string | null;
  birth_date?: string | null;
  birth_year?: number | null;
  birth_city?: string | null;
  birth_country?: string | null;
  gender?: string | null;
  photo_path?: string | null;
  is_deceased?: boolean | null;
  death_date?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface EdgeNode {
  id: string;
  person_a_id: string;
  person_b_id: string;
  relationship_type: PrimitiveRelationship;
  parent_kind?: "biological" | "adoptive" | "unknown" | null;
  relationship_status?: string | null;
  is_current?: boolean | null;
  created_at?: string | null;
  deleted_at?: string | null;
}

export interface FamilyGraph {
  me: string | null;
  nodes: PersonNode[];
  edges: EdgeNode[];
}

function isFemale(gender?: string | null): boolean {
  return gender === "F" || gender === "female";
}

function isMale(gender?: string | null): boolean {
  return gender === "M" || gender === "male";
}

function genderedRelation(
  gender: string | null | undefined,
  female: RelationType,
  male: RelationType,
  fallback: RelationType
): RelationType {
  if (isFemale(gender)) return female;
  if (isMale(gender)) return male;
  return fallback;
}

/**
 * Interpreta una arista desde la perspectiva de viewerPersonId.
 *
 * parent:
 *   person_a_id = padre/madre
 *   person_b_id = hijo/hija
 *
 * guardian:
 *   person_a_id = tutor
 *   person_b_id = persona bajo tutela
 */
export function edgeToRelationType(
  edge: EdgeNode,
  viewerPersonId: string,
  otherGender?: string | null
): RelationType {
  const viewerIsA = edge.person_a_id === viewerPersonId;

  switch (edge.relationship_type) {
    case "parent":
      if (viewerIsA) {
        return genderedRelation(
          otherGender,
          "daughter",
          "son",
          "son"
        );
      }

      return genderedRelation(
        otherGender,
        "mother",
        "father",
        "father"
      );

    case "partner":
      return "partner";

    case "guardian":
      if (viewerIsA) {
        return "stepchild";
      }

      return genderedRelation(
        otherGender,
        "stepmother",
        "stepfather",
        "stepfather"
      );

    default:
      return "other";
  }
}

function fullFirstName(person: PersonNode): string {
  return [person.first_name, person.middle_name]
    .filter(Boolean)
    .join(" ");
}

function fullSurname(person: PersonNode): string {
  return [person.first_surname, person.second_surname]
    .filter(Boolean)
    .join(" ");
}

export function personToProfile(person: PersonNode): Profile {
  return {
    id: person.id,
    first_name: fullFirstName(person),
    last_name: fullSurname(person),
    avatar_url: person.photo_path || undefined,
    birth_year:
      person.birth_year ??
      (person.birth_date
        ? Number(person.birth_date.slice(0, 4))
        : undefined),
    gender: person.gender || undefined,
    location_enabled: false,
    city: person.birth_city || undefined,
    country: person.birth_country || undefined,
    created_at: person.created_at || "",
    updated_at: person.updated_at || "",
  };
}

function personToFamilyMember(
  person: PersonNode,
  relationType: RelationType,
  userId: string
): FamilyMember {
  const profile = personToProfile(person);

  return {
    id: person.id,
    added_by: userId,
    profile_id: person.id,
    first_name: profile.first_name,
    last_name: profile.last_name || undefined,
    relation_type: relationType,
    relation_kind: BLOOD_RELATIONS.has(relationType)
      ? "blood"
      : "affinity",
    invitation_sent: false,
    is_deceased: Boolean(person.is_deceased),
    created_at: person.created_at || "",
    profile,
  };
}

function buildAdjacency(edges: EdgeNode[]): Map<string, EdgeNode[]> {
  const adjacency = new Map<string, EdgeNode[]>();

  for (const edge of edges) {
    const forA = adjacency.get(edge.person_a_id) || [];
    forA.push(edge);
    adjacency.set(edge.person_a_id, forA);

    const forB = adjacency.get(edge.person_b_id) || [];
    forB.push(edge);
    adjacency.set(edge.person_b_id, forB);
  }

  return adjacency;
}

export function adaptGraph(
  graph: FamilyGraph,
  userId: string
): {
  profile: Profile | null;
  members: FamilyMember[];
  extendedMembers: ExtendedEntry[];
  memberLinks: MemberLink[];
} {
  const me = graph.me;

  if (!me) {
    return {
      profile: null,
      members: [],
      extendedMembers: [],
      memberLinks: [],
    };
  }

  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  const nodeById = new Map(
    nodes.map((node) => [node.id, node])
  );

  const myNode = nodeById.get(me);

  if (!myNode) {
    return {
      profile: null,
      members: [],
      extendedMembers: [],
      memberLinks: [],
    };
  }

  const adjacency = buildAdjacency(edges);
  const relationFromMe = new Map<string, RelationType>();
  const predecessor = new Map<string, string>();
  const depthById = new Map<string, number>([[me, 0]]);
  const visited = new Set<string>([me]);

  const queue: Array<{
    personId: string;
    relationFromRoot: RelationType | null;
  }> = [
    {
      personId: me,
      relationFromRoot: null,
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) break;

    const currentDepth = depthById.get(current.personId) || 0;
    const neighborEdges = adjacency.get(current.personId) || [];

    for (const edge of neighborEdges) {
      const otherId =
        edge.person_a_id === current.personId
          ? edge.person_b_id
          : edge.person_a_id;

      if (visited.has(otherId)) continue;

      const otherNode = nodeById.get(otherId);
      if (!otherNode) continue;

      const localRelation = edgeToRelationType(
        edge,
        current.personId,
        otherNode.gender
      );

      const relationFromRoot =
        current.personId === me
          ? localRelation
          : current.relationFromRoot
            ? inferRelation(
                current.relationFromRoot,
                localRelation
              )
            : null;

      if (!relationFromRoot) continue;

      visited.add(otherId);
      relationFromMe.set(
        otherId,
        relationFromRoot as RelationType
      );
      predecessor.set(otherId, current.personId);
      depthById.set(otherId, currentDepth + 1);

      queue.push({
        personId: otherId,
        relationFromRoot:
          relationFromRoot as RelationType,
      });
    }
  }

  const members: FamilyMember[] = [];
  const extendedMembers: ExtendedEntry[] = [];

  for (const [personId, relation] of relationFromMe) {
    const person = nodeById.get(personId);
    if (!person) continue;

    const member = personToFamilyMember(
      person,
      relation,
      userId
    );

    const depth = depthById.get(personId) || 1;

    if (depth === 1) {
      members.push(member);
      continue;
    }

    let connectorId = predecessor.get(personId) || "";

    while (
      connectorId &&
      (depthById.get(connectorId) || 0) > 1
    ) {
      connectorId = predecessor.get(connectorId) || "";
    }

    extendedMembers.push({
      member,
      parentMemberId: connectorId,
      inferredRelation: relation,
    });
  }

  const memberLinks: MemberLink[] = edges
    .filter(
      (edge) =>
        edge.person_a_id !== me &&
        edge.person_b_id !== me
    )
    .map((edge) => {
      const personB = nodeById.get(edge.person_b_id);

      return {
        fromMemberId: edge.person_a_id,
        toMemberId: edge.person_b_id,
        relation: edgeToRelationType(
          edge,
          edge.person_a_id,
          personB?.gender
        ),
      };
    });

  return {
    profile: personToProfile(myNode),
    members,
    extendedMembers,
    memberLinks,
  };
}

/**
 * Convierte el parentesco seleccionado por el usuario al único tipo
 * primitivo que puede persistirse.
 *
 * Los parentescos derivados siguen enviando su relation_key al backend.
 */
export function relationTypeToPrimitive(
  relation: RelationType
): PrimitiveRelationship {
  const plan = planRelationship(relation);

  if (plan.kind === "direct") {
    return plan.primitive;
  }

  throw new Error(
    `El parentesco "${relation}" requiere seleccionar familiares intermedios.`
  );
}
