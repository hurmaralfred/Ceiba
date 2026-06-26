export type RelationType =
  | 'father' | 'mother' | 'son' | 'daughter'
  | 'brother' | 'sister' | 'half_brother' | 'half_sister'
  | 'nephew' | 'niece'
  | 'spouse' | 'partner'
  | 'grandfather_paternal' | 'grandmother_paternal'
  | 'grandfather_maternal' | 'grandmother_maternal'
  | 'grandson' | 'granddaughter'
  | 'uncle' | 'aunt' | 'cousin'
  | 'father_in_law' | 'mother_in_law'
  | 'brother_in_law' | 'sister_in_law'
  | 'stepfather' | 'stepmother' | 'stepchild'
  | 'other'

export type RelationKind = 'blood' | 'affinity' | 'other'

export interface Profile {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  avatar_url?: string
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
  created_at: string
  profile?: Profile
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

export interface RelationshipSuggestion {
  id: string
  suggested_to: string
  first_name: string
  last_name?: string
  suggested_relation: RelationType
  suggested_relation_kind: RelationKind
  suggested_by_profile_id: string
  suggested_by_name: string
  family_member_id?: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
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
  grandfather_paternal: 'Abuelo paterno',
  grandmother_paternal: 'Abuela paterna',
  grandfather_maternal: 'Abuelo materno',
  grandmother_maternal: 'Abuela materna',
  grandson: 'Nieto',
  granddaughter: 'Nieta',
  uncle: 'Tío',
  aunt: 'Tía',
  cousin: 'Primo/a',
  father_in_law: 'Suegro',
  mother_in_law: 'Suegra',
  brother_in_law: 'Cuñado',
  sister_in_law: 'Cuñada',
  stepfather: 'Padrastro',
  stepmother: 'Madrastra',
  stepchild: 'Hijastro/a',
  other: 'Otro familiar',
}

export const BLOOD_RELATIONS = new Set<RelationType>([
  'father','mother','son','daughter','brother','sister','half_brother','half_sister',
  'nephew','niece','grandfather_paternal','grandmother_paternal',
  'grandfather_maternal','grandmother_maternal','grandson','granddaughter','uncle','aunt','cousin',
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
  grandfather_paternal: 'grandson',
  grandmother_paternal: 'grandson',
  grandfather_maternal: 'grandson',
  grandmother_maternal: 'grandson',
  grandson: 'grandfather_paternal',
  granddaughter: 'grandmother_paternal',
  uncle: 'nephew',
  aunt: 'niece',
  cousin: 'cousin',
  father_in_law: 'son',
  mother_in_law: 'son',
  brother_in_law: 'brother_in_law',
  sister_in_law: 'sister_in_law',
  stepfather: 'stepchild',
  stepmother: 'stepchild',
  stepchild: 'stepfather',
  other: 'other',
}
