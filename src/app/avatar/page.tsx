'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AvatarFigure } from '@/components/universe/AvatarFigure'
import type { UniverseNode } from '@/components/universe/useUniverseLayout'
import {
  type AvatarConfig,
  AVATAR_SKIN_TONES,
  AVATAR_HAIR_COLORS,
  AVATAR_EYE_COLORS,
  MALE_HAIR_NAMES,
  FEMALE_HAIR_NAMES,
  DEFAULT_AVATAR_CONFIG,
} from '@/lib/avatarConfig'

function makePreviewNode(userId: string, name: string, config: AvatarConfig): UniverseNode {
  return {
    id: userId,
    memberId: undefined,
    name,
    shortName: name.split(' ')[0] || 'Tú',
    relation: 'Tú',
    relationType: 'root',
    gender: config.gender,
    avatarUrl: null,
    avatarConfig: config,
    isRoot: true,
    isFocal: true,
    hopDistance: 0,
    orbitRadius: 0,
    angleDeg: 0,
    cx: 0, cy: 0,
    scale: 1,
    opacity: 1,
    zIndex: 10,
    relevanceTier: 0,
    ageGroup: 'adult',
    isDeceased: false,
    isJoined: true,
    connectionChannel: 'blood',
    orbitParentId: null,
  }
}

export default function AvatarBuilderPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('Tú')
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_config')
        .eq('id', user.id)
        .single()
      if (data) {
        setDisplayName([data.first_name, data.last_name].filter(Boolean).join(' ') || 'Tú')
        if (data.avatar_config) setConfig(data.avatar_config as AvatarConfig)
      }
      setLoading(false)
    })()
  }, [])

  const set = <K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: val }))

  const save = async () => {
    setSaving(true)
    setSaved(false)
    await supabase.from('profiles').update({ avatar_config: config }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const hairNames = config.gender === 'female' ? FEMALE_HAIR_NAMES : MALE_HAIR_NAMES
  const hairCount = hairNames.length
  const previewNode = userId ? makePreviewNode(userId, displayName, config) : null

  if (loading) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-ceiba-600" />
    </div>
  )

  return (
    <main className="min-h-screen bg-cream-100">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg">
        <Link href="/settings" className="text-ceiba-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <span className="font-display text-lg font-bold">Mi avatar</span>
      </nav>

      <div className="max-w-sm mx-auto px-4 py-6 pb-28 space-y-5">

        {/* Preview */}
        <div className="flex justify-center py-2">
          <div style={{
            width: 180, height: 180,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 40% 35%, #0d1f3c 0%, #07111c 70%)',
            border: '1.5px solid rgba(100,160,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 50px rgba(20,60,160,0.22), inset 0 0 24px rgba(0,0,0,0.5)',
            position: 'relative', overflow: 'hidden',
          }}>
            {Array.from({ length: 22 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: 1.5, height: 1.5,
                borderRadius: '50%',
                background: 'white',
                opacity: 0.2 + (i % 5) * 0.1,
                left: `${(i * 41 + 13) % 84 + 8}%`,
                top: `${(i * 59 + 5) % 84 + 6}%`,
              }} />
            ))}
            {previewNode && (
              <div style={{ transform: 'scale(2.5)', transformOrigin: 'center center' }}>
                <AvatarFigure node={previewNode} labelVisible={false} />
              </div>
            )}
          </div>
        </div>

        {/* Gender */}
        <section className="card space-y-3">
          <p className="text-xs font-semibold text-ceiba-500 uppercase tracking-wider">Soy…</p>
          <div className="flex gap-3">
            {(['male', 'female'] as const).map(g => (
              <button
                key={g}
                onClick={() => { set('gender', g); set('hairStyle', 0) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border"
                style={{
                  background: config.gender === g ? '#2e5318' : undefined,
                  color: config.gender === g ? 'white' : '#2e5318',
                  borderColor: config.gender === g ? '#2e5318' : '#a3b89a',
                }}
              >
                {g === 'male' ? 'Hombre' : 'Mujer'}
              </button>
            ))}
          </div>
        </section>

        {/* Skin tone */}
        <section className="card space-y-3">
          <p className="text-xs font-semibold text-ceiba-500 uppercase tracking-wider">Tono de piel</p>
          <div className="flex gap-3">
            {AVATAR_SKIN_TONES.map((color, i) => (
              <button
                key={i}
                onClick={() => set('skinTone', i)}
                style={{
                  flex: 1, aspectRatio: '1',
                  borderRadius: '50%',
                  background: color,
                  border: config.skinTone === i ? '3px solid #2e5318' : '2px solid rgba(0,0,0,0.10)',
                  boxShadow: config.skinTone === i ? '0 0 0 2px white, 0 0 0 4px #2e5318' : undefined,
                  transition: 'box-shadow 0.12s',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </section>

        {/* Hair style */}
        <section className="card space-y-3">
          <p className="text-xs font-semibold text-ceiba-500 uppercase tracking-wider">Estilo de cabello</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => set('hairStyle', (config.hairStyle - 1 + hairCount) % hairCount)}
              className="w-9 h-9 rounded-full bg-cream-200 text-ceiba-700 font-bold flex items-center justify-center hover:bg-ceiba-100 transition-colors text-xl leading-none"
            >‹</button>
            <span className="flex-1 text-center text-sm font-semibold text-ceiba-800">
              {hairNames[config.hairStyle % hairCount]}
            </span>
            <button
              onClick={() => set('hairStyle', (config.hairStyle + 1) % hairCount)}
              className="w-9 h-9 rounded-full bg-cream-200 text-ceiba-700 font-bold flex items-center justify-center hover:bg-ceiba-100 transition-colors text-xl leading-none"
            >›</button>
          </div>
          <div className="flex gap-2 justify-center">
            {Array.from({ length: hairCount }, (_, i) => (
              <button
                key={i}
                onClick={() => set('hairStyle', i)}
                style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: config.hairStyle % hairCount === i ? '#2e5318' : '#b8c8b0',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </section>

        {/* Hair color */}
        <section className="card space-y-3">
          <p className="text-xs font-semibold text-ceiba-500 uppercase tracking-wider">Color de cabello</p>
          <div className="flex gap-3">
            {AVATAR_HAIR_COLORS.map((color, i) => (
              <button
                key={i}
                onClick={() => set('hairColor', i)}
                style={{
                  flex: 1, aspectRatio: '1',
                  borderRadius: '50%',
                  background: color,
                  border: config.hairColor === i ? '3px solid #2e5318' : '2px solid rgba(0,0,0,0.16)',
                  boxShadow: config.hairColor === i ? '0 0 0 2px white, 0 0 0 4px #2e5318' : undefined,
                  transition: 'box-shadow 0.12s',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </section>

        {/* Eye color */}
        <section className="card space-y-3">
          <p className="text-xs font-semibold text-ceiba-500 uppercase tracking-wider">Color de ojos</p>
          <div className="flex gap-3">
            {AVATAR_EYE_COLORS.map((color, i) => (
              <button
                key={i}
                onClick={() => set('eyeColor', i)}
                style={{
                  flex: 1, aspectRatio: '1',
                  borderRadius: '50%',
                  background: color,
                  border: config.eyeColor === i ? '3px solid #2e5318' : '2px solid rgba(0,0,0,0.12)',
                  boxShadow: config.eyeColor === i ? '0 0 0 2px white, 0 0 0 4px #2e5318' : undefined,
                  transition: 'box-shadow 0.12s',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </section>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-all"
          style={{
            background: saved ? '#2e8b47' : '#2e5318',
            opacity: saving ? 0.65 : 1,
          }}
        >
          {saving
            ? <Loader2 size={18} className="animate-spin mx-auto" />
            : saved
            ? '¡Avatar guardado ✓'
            : 'Guardar avatar'}
        </button>

      </div>
    </main>
  )
}
