export interface AvatarConfig {
  gender: 'male' | 'female'
  skinTone: number   // 0-5
  hairStyle: number  // 0-3 (female) / 0-4 (male)
  hairColor: number  // 0-5
  eyeColor: number   // 0-5
}

export const AVATAR_SKIN_TONES  = ['#FDDBB5', '#F0C08A', '#DDA060', '#C07838', '#8B5020', '#6A3C18']
export const AVATAR_HAIR_COLORS = ['#2C1A0E', '#4A3010', '#8A6A2A', '#C0A860', '#D4CAAA', '#909090']
export const AVATAR_EYE_COLORS  = ['#5B8FD0', '#6B9B60', '#8B6430', '#5A7AAA', '#7B5570', '#60908A']

export const MALE_HAIR_NAMES   = ['Clásico', 'Rapado', 'Rizado', 'Despeinado', 'Degradado']
export const FEMALE_HAIR_NAMES = ['Largo', 'Bob', 'Ondulado', 'Moño']

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  gender: 'male',
  skinTone: 1,
  hairStyle: 0,
  hairColor: 0,
  eyeColor: 2,
}
