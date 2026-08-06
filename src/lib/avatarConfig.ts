export interface AvatarConfig {
  gender: 'male' | 'female'
  skinTone: number    // 0-5
  hairStyle: number   // 0-3 (female) / 0-4 (male)
  hairColor: number   // 0-5
  eyeColor: number    // 0-5
  faceShape: number   // 0=oval  1=redondo  2=cuadrado
  accessories: number // male: 0=ninguno 1=lentes 2=barba 3=lentes+barba
                      // female: 0=ninguno 1=lentes 2=aretes 3=lentes+aretes
  topColor?: string   // hex — color de ropa superior (shirt/blouse)
  botColor?: string   // hex — color de ropa inferior (pants/skirt)
}

export const AVATAR_SKIN_TONES  = ['#FDDBB5', '#F0C08A', '#DDA060', '#C07838', '#8B5020', '#6A3C18']
export const AVATAR_HAIR_COLORS = ['#2C1A0E', '#4A3010', '#8A6A2A', '#C0A860', '#D4CAAA', '#909090']
export const AVATAR_EYE_COLORS  = ['#5B8FD0', '#6B9B60', '#8B6430', '#5A7AAA', '#7B5570', '#60908A']

// Curated outfit palettes — dark, rich tones that read well on dark space background
export const AVATAR_TOP_COLORS  = ['#1A3A5C', '#8B2E50', '#2E5318', '#4A3A7A', '#8B5020', '#2A4A4A']
export const AVATAR_BOT_COLORS  = ['#12203A', '#2A1020', '#0E2014', '#1E1828', '#1C1008', '#141E1E']

export const MALE_HAIR_NAMES   = ['Clásico', 'Rapado', 'Rizado', 'Despeinado', 'Degradado']
export const FEMALE_HAIR_NAMES = ['Largo', 'Bob', 'Ondulado', 'Moño']
export const FACE_SHAPE_NAMES  = ['Ovalado', 'Redondo', 'Cuadrado']
export const MALE_ACCESSORY_NAMES   = ['Ninguno', 'Lentes', 'Barba', 'Lentes + barba']
export const FEMALE_ACCESSORY_NAMES = ['Ninguno', 'Lentes', 'Aretes', 'Lentes + aretes']

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  gender: 'male',
  skinTone: 1,
  hairStyle: 0,
  hairColor: 0,
  eyeColor: 2,
  faceShape: 0,
  accessories: 0,
  topColor: '#1A3A5C',
  botColor: '#12203A',
}
