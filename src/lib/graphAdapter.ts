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
  /**
   * Distingue matrimonio de unión libre SIN ampliar el enum canónico
   * `relationship_type` (que sigue siendo parent | partner | guardian).
   * NULL = no declarado ⇒ se muestra como "Pareja"; nunca se infiere
   * matrimonio desde is_current ni desde la existencia de la arista.
   */
  union_kind?: "marriage" | "partnership" | null;
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

// El género en la base viene en formatos distintos según el origen: el enum
// canónico de `persons` es "M" | "F" | "X" | "unknown", pero también existen
// filas con "male"/"female" (p. ej. las que fija el cliente). La comparación
// anterior era sensible a mayúsculas y solo aceptaba "F"/"female", así que
// "Female", "f", "M"→ok pero "male" en otra caja, etc. caían al MASCULINO por
// defecto — de ahí que una mujer apareciera como "Padre". Normalizamos.
export function classifyGender(gender?: string | null): "male" | "female" | null {
  if (!gender) return null;
  const g = String(gender).trim().toLowerCase();
  if (["f", "female", "femenino", "femenina", "mujer"].includes(g)) return "female";
  if (["m", "male", "masculino", "hombre", "varon", "varón"].includes(g)) return "male";
  return null; // "x"/"unknown"/"other"/"prefer_not_to_say" → neutro
}

function isFemale(gender?: string | null): boolean {
  return classifyGender(gender) === "female";
}

function isMale(gender?: string | null): boolean {
  return classifyGender(gender) === "male";
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

// Corrección autoritativa de la etiqueta por el género REAL de la persona.
// La cadena de inferencia (multi-salto) puede perder el género; esto lo fija
// al final usando graph.persons.gender de la propia persona, conservando la
// generación y la rama (paterna/materna). Si el género es neutro/desconocido,
// se respeta lo inferido.
const GENDER_PAIRS: Partial<Record<RelationType, { male: RelationType; female: RelationType }>> = {
  father: { male: "father", female: "mother" },
  mother: { male: "father", female: "mother" },
  son: { male: "son", female: "daughter" },
  daughter: { male: "son", female: "daughter" },
  grandfather: { male: "grandfather", female: "grandmother" },
  grandmother: { male: "grandfather", female: "grandmother" },
  grandfather_paternal: { male: "grandfather_paternal", female: "grandmother_paternal" },
  grandmother_paternal: { male: "grandfather_paternal", female: "grandmother_paternal" },
  grandfather_maternal: { male: "grandfather_maternal", female: "grandmother_maternal" },
  grandmother_maternal: { male: "grandfather_maternal", female: "grandmother_maternal" },
  great_grandfather: { male: "great_grandfather", female: "great_grandmother" },
  great_grandmother: { male: "great_grandfather", female: "great_grandmother" },
  grandson: { male: "grandson", female: "granddaughter" },
  granddaughter: { male: "grandson", female: "granddaughter" },
  great_grandson: { male: "great_grandson", female: "great_granddaughter" },
  great_granddaughter: { male: "great_grandson", female: "great_granddaughter" },
  // Consanguíneos colaterales
  uncle: { male: "uncle", female: "aunt" },
  aunt: { male: "uncle", female: "aunt" },
  nephew: { male: "nephew", female: "niece" },
  niece: { male: "nephew", female: "niece" },
  // Unión matrimonial: `spouse` es la forma neutra; con género conocido se
  // convierte en esposo/esposa. Sin género se respeta `spouse` ("Esposo/a").
  spouse: { male: "husband", female: "wife" },
  husband: { male: "husband", female: "wife" },
  wife: { male: "husband", female: "wife" },
  // Familia política
  father_in_law: { male: "father_in_law", female: "mother_in_law" },
  mother_in_law: { male: "father_in_law", female: "mother_in_law" },
  brother_in_law: { male: "brother_in_law", female: "sister_in_law" },
  sister_in_law: { male: "brother_in_law", female: "sister_in_law" },
  son_in_law: { male: "son_in_law", female: "daughter_in_law" },
  daughter_in_law: { male: "son_in_law", female: "daughter_in_law" },
  stepfather: { male: "stepfather", female: "stepmother" },
  stepmother: { male: "stepfather", female: "stepmother" },
  stepson: { male: "stepson", female: "stepdaughter" },
  stepdaughter: { male: "stepson", female: "stepdaughter" },
};

export function applyGenderToRelation(
  relation: RelationType,
  gender?: string | null
): RelationType {
  const cls = classifyGender(gender);
  if (!cls) return relation;
  const pair = GENDER_PAIRS[relation];
  return pair ? pair[cls] : relation;
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
      // Solo un matrimonio declarado explícitamente produce `spouse`; el
      // género lo aplica después applyGenderToRelation (spouse → esposo/esposa).
      return edge.union_kind === "marriage" ? "spouse" : "partner";

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

/**
 * Generación ESTRUCTURAL de `otherId` respecto a `currentId`, calculada
 * ÚNICAMENTE desde el tipo de arista real y su dirección — nunca desde la
 * etiqueta de parentesco derivada (esa etiqueta responde a "¿cómo se llama
 * esta persona para mí?", no a "¿en qué generación está?").
 *
 *   parent:   person_a_id = padre/madre, person_b_id = hijo/hija
 *             → el hijo queda una generación por debajo del padre/madre.
 *   guardian: person_a_id = tutor, person_b_id = persona bajo tutela
 *             → estructuralmente igual que parent (el tutelado baja una
 *               generación), aunque la etiqueta mostrada sea "Hijastro/a".
 *   partner:  ambos miembros de la unión quedan en la MISMA generación.
 */
function structuralGenerationDelta(
  edge: EdgeNode,
  currentId: string
): number {
  const currentIsA = edge.person_a_id === currentId;

  switch (edge.relationship_type) {
    case "parent":
    case "guardian":
      return currentIsA ? 1 : -1;
    case "partner":
    default:
      return 0;
  }
}

// Orden de exploración por nodo: las relaciones parent/guardian se procesan
// antes que partner, para que —ante dos rutas de la misma longitud— la ruta
// de sangre gane sobre una ruta de afinidad. Combinado con el `visited` de
// la búsqueda (cada persona se resuelve una sola vez), esto hace que el
// resultado sea determinista y nunca dependa del orden de llegada de las
// aristas desde la base de datos.
const STRUCTURAL_EDGE_PRIORITY: Record<string, number> = {
  parent: 0,
  guardian: 1,
  partner: 2,
};

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

/**
 * Relación resuelta de una persona respecto a la raíz del grafo.
 */
export interface ResolvedRelation {
  /** Parentesco canónico con género ya aplicado cuando se conoce. */
  relation: RelationType;
  /**
   * `false` cuando el género de la persona es desconocido/neutro. Permite
   * a la capa de presentación elegir una etiqueta neutral ("Tío/Tía") en
   * vez de caer al masculino por defecto. NO altera ningún dato.
   */
  genderKnown: boolean;
  /** Saltos desde la raíz (1 = relación directa). */
  depth: number;
  /** Generación estructural (0 = misma, -1 = padres, +1 = hijos). */
  generation: number;
  /** Persona desde la que se alcanzó (para agrupar ramas). */
  predecessorId: string;
}

/**
 * ÚNICA fuente de verdad del parentesco en la app.
 *
 * Recorre el grafo desde la persona raíz y resuelve, para cada persona
 * alcanzable, qué es respecto a la raíz. Consumida por:
 *   - /tree     (vía adaptGraph)
 *   - /invitar  (vía @/lib/genealogy)
 *
 * Interpreta correctamente:
 *   - la DIRECCIÓN de person_a_id / person_b_id (en una arista `parent`,
 *     person_a es el progenitor y person_b el hijo: quién es quién depende
 *     de desde dónde se mire — esto es justo lo que /invitar ignoraba);
 *   - relationship_type canónico (parent | partner | guardian);
 *   - relaciones inversas y caminos indirectos (multi-salto) vía
 *     inferRelation;
 *   - personas eliminadas o fusionadas (se excluyen del recorrido);
 *   - género desconocido (se marca en genderKnown, sin asumir masculino).
 */
export function resolveRelationsFromRoot(graph: FamilyGraph): {
  me: string | null;
  byPersonId: Map<string, ResolvedRelation>;
} {
  const byPersonId = new Map<string, ResolvedRelation>();
  const me = graph.me;
  if (!me) return { me: null, byPersonId };

  const allNodes = graph.nodes || [];
  const edges = graph.edges || [];

  // Personas eliminadas o fusionadas nunca participan del parentesco.
  const isUsable = (n: PersonNode) =>
    !n.deleted_at && (!n.status || n.status === "active");

  const nodeById = new Map(
    allNodes.filter(isUsable).map((node) => [node.id, node])
  );

  if (!nodeById.has(me)) return { me, byPersonId };

  // Solo aristas vivas entre personas utilizables.
  const usableEdges = edges.filter(
    (e) =>
      !e.deleted_at &&
      nodeById.has(e.person_a_id) &&
      nodeById.has(e.person_b_id)
  );

  const adjacency = buildAdjacency(usableEdges);
  const depthById = new Map<string, number>([[me, 0]]);
  const generationById = new Map<string, number>([[me, 0]]);
  const visited = new Set<string>([me]);

  const queue: Array<{
    personId: string;
    relationFromRoot: RelationType | null;
  }> = [{ personId: me, relationFromRoot: null }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const currentDepth = depthById.get(current.personId) || 0;
    const neighborEdges = [...(adjacency.get(current.personId) || [])].sort(
      (a, b) =>
        (STRUCTURAL_EDGE_PRIORITY[a.relationship_type] ?? 9) -
        (STRUCTURAL_EDGE_PRIORITY[b.relationship_type] ?? 9)
    );

    for (const edge of neighborEdges) {
      const otherId =
        edge.person_a_id === current.personId
          ? edge.person_b_id
          : edge.person_a_id;

      if (visited.has(otherId)) continue;

      const otherNode = nodeById.get(otherId);
      if (!otherNode) continue;

      // La dirección de la arista se interpreta SIEMPRE desde quien mira.
      const localRelation = edgeToRelationType(
        edge,
        current.personId,
        otherNode.gender
      );

      const relationFromRoot =
        current.personId === me
          ? localRelation
          : current.relationFromRoot
            ? inferRelation(current.relationFromRoot, localRelation)
            : null;

      if (!relationFromRoot) continue;

      visited.add(otherId);

      // Etiqueta final: corrige el género con el de la persona real (Padre
      // vs Madre, Abuelo vs Abuela, ...). La cadena sigue usando la
      // relación canónica para no alterar los siguientes saltos.
      const relationAfterGender = applyGenderToRelation(
        relationFromRoot as RelationType,
        otherNode.gender
      );

      depthById.set(otherId, currentDepth + 1);
      generationById.set(
        otherId,
        (generationById.get(current.personId) ?? 0) +
          structuralGenerationDelta(edge, current.personId)
      );

      byPersonId.set(otherId, {
        relation: relationAfterGender,
        genderKnown: classifyGender(otherNode.gender) !== null,
        depth: currentDepth + 1,
        generation: generationById.get(otherId) ?? 0,
        predecessorId: current.personId,
      });

      queue.push({
        personId: otherId,
        relationFromRoot: relationFromRoot as RelationType,
      });
    }
  }

  return { me, byPersonId };
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
  console.table(
    (graph.nodes || []).map((node: any) => ({
      id: node.id,
      name:
        node.display_name ||
        node.full_name ||
        [node.first_names, node.last_names].filter(Boolean).join(" "),
      gender: node.gender,
      genderType: typeof node.gender,
    }))
  );

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

  // Recorrido canónico compartido: la MISMA función que usa /invitar.
  // No se duplica lógica de parentesco en ninguna página.
  const resolved = resolveRelationsFromRoot(graph);
  const relationFromMe = new Map<string, RelationType>();
  const predecessor = new Map<string, string>();
  const depthById = new Map<string, number>([[me, 0]]);
  const generationById = new Map<string, number>([[me, 0]]);

  for (const [personId, r] of resolved.byPersonId) {
    relationFromMe.set(personId, r.relation);
    if (r.predecessorId) predecessor.set(personId, r.predecessorId);
    depthById.set(personId, r.depth);
    generationById.set(personId, r.generation);
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
    member.generation = generationById.get(personId) ?? 0;

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

/**
 * Catálogo genealógico v1.
 *
 * Parentescos que NO pueden persistirse tal cual (el modelo canónico solo
 * admite parent | partner | guardian) y que, en cambio, se agregan como una
 * cadena "parent" apoyada en un familiar conector ya existente:
 *
 *   abuelo/abuela      → parent respecto de mi padre/madre
 *   bisabuelo/bisabuela → parent respecto de mi abuelo/abuela
 *   nieto/nieta        → parent respecto de mi hijo/hija
 *   bisnieto/bisnieta  → parent respecto de mi nieto/nieta
 *
 * Ninguno se guarda como grandfather/great_grandfather/etc.: esas etiquetas
 * las deriva el grafo desde las cadenas parent (ver inferRelation).
 */
const CONNECTOR_RELATIONS = new Set<RelationType>([
  "grandfather",
  "grandmother",
  "great_grandfather",
  "great_grandmother",
  "grandson",
  "granddaughter",
  "great_grandson",
  "great_granddaughter",
]);

export function relationRequiresConnector(
  relation: RelationType
): boolean {
  return CONNECTOR_RELATIONS.has(relation);
}

/**
 * Parentescos que `buildAddRelativeRequest` sabe traducir HOY a relaciones
 * canónicas (parent | partner) sin inventar personas intermedias.
 *
 * Fuente única para habilitar/deshabilitar opciones del selector: el resto del
 * catálogo central se sigue MOSTRANDO, pero deshabilitado y con explicación —
 * nunca se oculta en silencio ni se persiste un parentesco derivado.
 */
const ADD_RELATIVE_SUPPORTED = new Set<RelationType>([
  "father",
  "mother",
  "son",
  "daughter",
  "brother",
  "sister",
  "spouse",
  "partner",
  "grandfather",
  "grandmother",
  "great_grandfather",
  "great_grandmother",
  "grandson",
  "granddaughter",
  "great_grandson",
  "great_granddaughter",
]);

export function isAddRelativeSupported(relation: string): boolean {
  return ADD_RELATIVE_SUPPORTED.has(relation as RelationType);
}

export type AddRelativeGender = "male" | "female" | null;

export interface AddRelativeRequest {
  /** Primitivo persistible (única forma que acepta relationships). */
  primitive: PrimitiveRelationship;
  /** relation_key que interpreta el RPC add_relative (padre, hijo, ...). */
  backendRelationKey: string;
  /** Persona de referencia (conector). null ⇒ usa la persona reclamada. */
  relatedPersonId: string | null;
  parentKind: "biological" | "adoptive" | "unknown" | null;
  gender: AddRelativeGender;
}

/**
 * Traduce el parentesco elegido en el formulario al payload real de
 * add_relative(p_payload, p_relationship). Nunca lanza para los parentescos
 * ofrecidos por el selector; para los abuelos/bisabuelos/nietos/bisnietos usa
 * `connectorId` como related_person_id (BR: no se crean personas intermedias
 * ficticias — el conector es un familiar que ya existe).
 */
export function buildAddRelativeRequest(
  relationType: RelationType,
  connectorId?: string | null
): AddRelativeRequest {
  const connector = connectorId || null;

  switch (relationType) {
    case "father":
      return { primitive: "parent", backendRelationKey: "father", relatedPersonId: null, parentKind: "biological", gender: "male" };
    case "mother":
      return { primitive: "parent", backendRelationKey: "mother", relatedPersonId: null, parentKind: "biological", gender: "female" };
    case "son":
      return { primitive: "parent", backendRelationKey: "son", relatedPersonId: null, parentKind: "biological", gender: "male" };
    case "daughter":
      return { primitive: "parent", backendRelationKey: "daughter", relatedPersonId: null, parentKind: "biological", gender: "female" };

    case "spouse":
      return { primitive: "partner", backendRelationKey: "spouse", relatedPersonId: null, parentKind: null, gender: null };
    case "partner":
      return { primitive: "partner", backendRelationKey: "partner", relatedPersonId: null, parentKind: null, gender: null };

    // Hermanos: se conserva el flujo derived existente del RPC (relation_key
    // 'brother'/'sister'). No requieren conector explícito.
    case "brother":
      return { primitive: "parent", backendRelationKey: "brother", relatedPersonId: null, parentKind: "unknown", gender: "male" };
    case "sister":
      return { primitive: "parent", backendRelationKey: "sister", relatedPersonId: null, parentKind: "unknown", gender: "female" };

    // Ascendientes con conector: el nuevo es padre/madre del conector.
    case "grandfather":
    case "great_grandfather":
      return { primitive: "parent", backendRelationKey: "father", relatedPersonId: connector, parentKind: "biological", gender: "male" };
    case "grandmother":
    case "great_grandmother":
      return { primitive: "parent", backendRelationKey: "mother", relatedPersonId: connector, parentKind: "biological", gender: "female" };

    // Descendientes con conector: el nuevo es hijo/hija del conector.
    case "grandson":
    case "great_grandson":
      return { primitive: "parent", backendRelationKey: "son", relatedPersonId: connector, parentKind: "biological", gender: "male" };
    case "granddaughter":
    case "great_granddaughter":
      return { primitive: "parent", backendRelationKey: "daughter", relatedPersonId: connector, parentKind: "biological", gender: "female" };

    default:
      // Parentescos directos no cubiertos arriba (p. ej. guardian si se
      // agregara al selector): delega en el planner del catálogo.
      return {
        primitive: relationTypeToPrimitive(relationType),
        backendRelationKey: relationType,
        relatedPersonId: connector,
        parentKind: null,
        gender: null,
      };
  }
}
