export type RelationType =
  | 'father' | 'mother' | 'son' | 'daughter'
  | 'brother' | 'sister' | 'half_brother' | 'half_sister'
  | 'nephew' | 'niece'
  // Unión: `spouse` es la forma neutra (matrimonio sin género conocido);
  // husband/wife son sus formas con género. `partner` = unión no matrimonial.
  | 'spouse' | 'partner' | 'husband' | 'wife'
  // Catálogo genealógico v1 (unificado con KinshipKey): claves canónicas de
  // abuelos/bisabuelos/nietos/bisnietos. Las variantes *_paternal/*_maternal
  // se conservan porque inferRelation las sigue produciendo en el grafo.
  | 'grandfather' | 'grandmother'
  | 'great_grandfather' | 'great_grandmother'
  | 'grandfather_paternal' | 'grandmother_paternal'
  | 'grandfather_maternal' | 'grandmother_maternal'
  | 'grandson' | 'granddaughter'
  | 'great_grandson' | 'great_granddaughter'
  | 'great_great_grandfather' | 'great_great_grandmother'
  | 'great_great_grandson' | 'great_great_granddaughter'
  | 'uncle' | 'aunt' | 'cousin'
  | 'father_in_law' | 'mother_in_law'
  | 'brother_in_law' | 'sister_in_law'
  | 'son_in_law' | 'daughter_in_law'
  | 'stepfather' | 'stepmother' | 'stepchild'
  | 'stepson' | 'stepdaughter'
  | 'other'

export type RelationKind = 'blood' | 'affinity' | 'other'

import type { AvatarConfig } from '@/lib/avatarConfig'

export interface Profile {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  avatar_url?: string
  avatar_config?: AvatarConfig | null
  social_link?: string
  bio?: string
  birth_year?: number
  gender?: string
  location_enabled: boolean
  latitude?: number
  longitude?: number
  location_updated_at?: string
  city?: string
  country?: string
  created_at: string
  updated_at: string
}

export interface FamilyMember {
  id: string
  added_by: string
  profile_id?: string
  first_name: string
  last_name?: string
  email?: string
  phone?: string
  relation_type: RelationType
  relation_kind: RelationKind
  invitation_sent: boolean
  invitation_token?: string
  invitation_sent_at?: string
  is_deceased?: boolean
  parent_member_id?: string | null
  created_at: string
  profile?: Profile
  /**
   * Generación genealógica ESTRUCTURAL respecto al usuario raíz (0 = misma
   * generación, -1 = padres, +1 = hijos, ...), calculada únicamente a partir
   * de relaciones parent/partner/guardian reales — nunca desde la etiqueta
   * de parentesco mostrada (p. ej. "Hijastra" también es generación +1).
   * Opcional: si falta, quien la use debe caer a un cálculo de respaldo.
   */
  generation?: number
}

export interface Relationship {
  id: string
  profile_a: string
  profile_b: string
  relation_from_a: RelationType
  relation_from_b: RelationType
  relation_kind: RelationKind
  confirmed: boolean
  created_at: string
}

export interface Invitation {
  id: string
  token: string
  invited_by: string
  family_member_id?: string
  email?: string
  phone?: string
  status: 'pending' | 'accepted' | 'expired'
  relation_type: RelationType
  accepted_by?: string
  expires_at: string
  created_at: string
}

export interface FamilyTreeNode {
  profile_id: string
  first_name: string
  last_name: string
  avatar_url?: string
  relation_path: string[]
  depth: number
  location_enabled: boolean
  latitude?: number
  longitude?: number
  city?: string
  country?: string
}

// Label maps
export const RELATION_LABELS: Record<RelationType, string> = {
  father: 'Padre',
  mother: 'Madre',
  son: 'Hijo',
  daughter: 'Hija',
  brother: 'Hermano',
  sister: 'Hermana',
  half_brother: 'Medio hermano',
  half_sister: 'Media hermana',
  nephew: 'Sobrino',
  niece: 'Sobrina',
  spouse: 'Esposo/a',
  partner: 'Pareja',
  husband: 'Esposo',
  wife: 'Esposa',
  grandfather: 'Abuelo',
  grandmother: 'Abuela',
  great_grandfather: 'Bisabuelo',
  great_grandmother: 'Bisabuela',
  // Gen +2: la etiqueta es plana (Abuelo/Abuela) según el catálogo genealógico
  // v1; la variante paterna/materna se conserva SOLO para el posicionamiento
  // (rama izquierda/derecha), no para el texto.
  grandfather_paternal: 'Abuelo',
  grandmother_paternal: 'Abuela',
  grandfather_maternal: 'Abuelo',
  grandmother_maternal: 'Abuela',
  grandson: 'Nieto',
  granddaughter: 'Nieta',
  great_grandson: 'Bisnieto',
  great_granddaughter: 'Bisnieta',
  great_great_grandfather: 'Tatarabuelo',
  great_great_grandmother: 'Tatarabuela',
  great_great_grandson: 'Tataranieto',
  great_great_granddaughter: 'Tataranieta',
  uncle: 'Tío',
  aunt: 'Tía',
  cousin: 'Primo/a',
  father_in_law: 'Suegro',
  mother_in_law: 'Suegra',
  brother_in_law: 'Cuñado',
  sister_in_law: 'Cuñada',
  son_in_law: 'Yerno',
  daughter_in_law: 'Nuera',
  stepfather: 'Padrastro',
  stepmother: 'Madrastra',
  stepchild: 'Hijastro/a',
  stepson: 'Hijastro',
  stepdaughter: 'Hijastra',
  other: 'Otro familiar',
}

export const BLOOD_RELATIONS = new Set<RelationType>([
  'father','mother','son','daughter','brother','sister','half_brother','half_sister',
  'nephew','niece','grandfather','grandmother','great_grandfather','great_grandmother',
  'grandfather_paternal','grandmother_paternal',
  'grandfather_maternal','grandmother_maternal','grandson','granddaughter',
  'great_grandson','great_granddaughter',
  'great_great_grandfather','great_great_grandmother',
  'great_great_grandson','great_great_granddaughter',
  'uncle','aunt','cousin',
])

export const INVERSE_RELATION: Record<RelationType, RelationType> = {
  father: 'son',
  mother: 'son',
  son: 'father',
  daughter: 'mother',
  brother: 'brother',
  sister: 'sister',
  half_brother: 'half_brother',
  half_sister: 'half_sister',
  nephew: 'uncle',
  niece: 'aunt',
  spouse: 'spouse',
  partner: 'partner',
  // El inverso de un cónyuge es su cónyuge; el género real lo aplica
  // applyGenderToRelation sobre la persona del otro lado.
  husband: 'spouse',
  wife: 'spouse',
  grandfather: 'grandson',
  grandmother: 'granddaughter',
  great_grandfather: 'great_grandson',
  great_grandmother: 'great_granddaughter',
  grandfather_paternal: 'grandson',
  grandmother_paternal: 'grandson',
  grandfather_maternal: 'grandson',
  grandmother_maternal: 'grandson',
  grandson: 'grandfather_paternal',
  granddaughter: 'grandmother_paternal',
  great_grandson: 'great_grandfather',
  great_granddaughter: 'great_grandmother',
  great_great_grandfather: 'great_great_grandson',
  great_great_grandmother: 'great_great_granddaughter',
  great_great_grandson: 'great_great_grandfather',
  great_great_granddaughter: 'great_great_grandmother',
  uncle: 'nephew',
  aunt: 'niece',
  cousin: 'cousin',
  father_in_law: 'son',
  mother_in_law: 'son',
  brother_in_law: 'brother_in_law',
  sister_in_law: 'sister_in_law',
  // Yerno/nuera ↔ suegro/a; hijastro/a ↔ padrastro (masculino por defecto,
  // como el resto del mapa; el género real lo aplica applyGenderToRelation).
  son_in_law: 'father_in_law',
  daughter_in_law: 'father_in_law',
  stepfather: 'stepchild',
  stepmother: 'stepchild',
  stepchild: 'stepfather',
  stepson: 'stepfather',
  stepdaughter: 'stepfather',
  other: 'other',
}
// Match seguro (privacidad) — solo datos mínimos para confirmar
export interface PersonMatch {
  id: string;
  first_names: string;
  last_names: string;
  score: number;
  breakdown: {
    name_similarity: number;
    birth_date_match: boolean;
    birth_city_match: boolean;
    email_match: boolean;
  };
  needs_review: boolean;
}
