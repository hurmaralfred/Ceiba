'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
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
  FACE_SHAPE_NAMES,
  MALE_ACCESSORY_NAMES,
  FEMALE_ACCESSORY_NAMES,
  DEFAULT_AVATAR_CONFIG,
} from '@/lib/avatarConfig'

// ── Swatch helpers ────────────────────────────────────────────────────────────

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 42, height: 42,
        borderRadius: '50%',
        background: color,
        border: selected ? '3px solid #16302B' : '2.5px solid rgba(0,0,0,0.13)',
        boxShadow: selected
          ? '0 0 0 2.5px white, 0 0 0 5px #16302B, 0 2px 8px rgba(0,0,0,0.22)'
          : '0 1px 4px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        flexShrink: 0,
      }}
    />
  )
}

function EyeSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 42, height: 42,
        borderRadius: '50%',
        background: color,
        border: selected ? '3px solid #16302B' : '2.5px solid rgba(0,0,0,0.13)',
        boxShadow: selected
          ? '0 0 0 2.5px white, 0 0 0 5px #16302B, 0 2px 8px rgba(0,0,0,0.22)'
          : '0 1px 4px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* pupil overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(5,2,0,0.75)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', margin: '2px auto 0' }} />
        </div>
      </div>
    </button>
  )
}

// Face shape mini-SVGs
function FaceIcon({ shape, selected, onClick }: { shape: number; selected: boolean; onClick: () => void }) {
  const W = 40, H = 46
  const cx = W / 2, cy = H / 2 - 1
  // oval: rx=14 ry=18 | round: rx=16 ry=16 | square: rx=15 ry=14
  const rx = shape === 1 ? 15.5 : shape === 2 ? 15 : 13
  const ry = shape === 1 ? 15.5 : shape === 2 ? 14 : 18
  const r  = shape === 2 ? 4 : 1
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 4px',
        borderRadius: 12,
        border: selected ? '2px solid #16302B' : '1.5px solid #d4ddd1',
        background: selected ? '#e8f0e6' : 'white',
        cursor: 'pointer',
        transition: 'all 0.12s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} rx={r} ry={r}
          fill={selected ? '#16302B' : '#c8d4c4'} />
      </svg>
      <span style={{ fontSize: 10, fontWeight: 600, color: selected ? '#16302B' : '#7a9470', letterSpacing: '0.01em' }}>
        {FACE_SHAPE_NAMES[shape]}
      </span>
    </button>
  )
}

// Hair style grid item
function HairCard({ name, idx, selected, onClick }: { name: string; idx: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 0 calc(33% - 6px)',
        padding: '10px 6px 8px',
        borderRadius: 12,
        border: selected ? '2px solid #16302B' : '1.5px solid #d4ddd1',
        background: selected ? '#e8f0e6' : 'white',
        cursor: 'pointer',
        transition: 'all 0.12s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        minWidth: 0,
      }}
    >
      <div style={{
        width: 28, height: 28,
        borderRadius: '50%',
        background: selected ? '#16302B' : '#d4ddd1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: 'white', fontWeight: 700,
      }}>
        {idx + 1}
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: selected ? '#16302B' : '#7a9470', letterSpacing: '0.01em', textAlign: 'center', lineHeight: 1.2 }}>
        {name}
      </span>
    </button>
  )
}

// Accessory toggle chip
function AccChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '9px 6px',
        borderRadius: 10,
        border: selected ? '2px solid #16302B' : '1.5px solid #d4ddd1',
        background: selected ? '#16302B' : 'white',
        color: selected ? 'white' : '#5a7055',
        fontSize: 11, fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.12s',
        letterSpacing: '0.01em',
        textAlign: 'center',
        lineHeight: 1.3,
      }}
    >
      {label}
    </button>
  )
}

// Section label
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
      color: '#8aa888', textTransform: 'uppercase', marginBottom: 10,
    }}>
      {children}
    </p>
  )
}

// ── Preview node factory ───────────────────────────────────────────────────────

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

// ── Page ─────────────────────────────────────────────────────────────────────

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
        if (data.avatar_config) setConfig({ ...DEFAULT_AVATAR_CONFIG, ...(data.avatar_config as AvatarConfig) })
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
    setTimeout(() => setSaved(false), 2800)
  }

  const hairNames = config.gender === 'female' ? FEMALE_HAIR_NAMES : MALE_HAIR_NAMES
  const hairCount = hairNames.length
  const accNames  = config.gender === 'female' ? FEMALE_ACCESSORY_NAMES : MALE_ACCESSORY_NAMES
  const previewNode = userId ? makePreviewNode(userId, displayName, config) : null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#07111c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#F2B43C' }} />
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#f4f0e8' }}>

      {/* ── Sticky header with live preview ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'linear-gradient(180deg, #04090f 0%, #07111c 100%)',
        borderBottom: '1px solid rgba(100,160,255,0.10)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center',
        padding: '10px 16px',
        gap: 16,
      }}>
        {/* Back */}
        <Link href="/profile" style={{ color: 'rgba(242,180,60,0.7)', display: 'flex', flexShrink: 0, textDecoration: 'none' }}>
          <ArrowLeft size={20} />
        </Link>

        {/* Title */}
        <div style={{ flex: 1 }}>
          <div style={{ color: 'rgba(242,228,208,0.85)', fontWeight: 700, fontSize: 15, letterSpacing: '0.01em' }}>
            Mi avatar
          </div>
          <div style={{ color: 'rgba(242,228,208,0.36)', fontSize: 10.5, letterSpacing: '0.03em', marginTop: 1 }}>
            Los cambios se ven aquí al instante →
          </div>
        </div>

        {/* Live preview circle */}
        <div style={{
          width: 88, height: 88, flexShrink: 0,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 38% 32%, #0d1f3c 0%, #05090f 72%)',
          border: '1.5px solid rgba(100,160,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(242,180,60,0.12), inset 0 0 12px rgba(0,0,0,0.5)',
          position: 'relative', overflow: 'hidden',
        }}>
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: 1.2, height: 1.2, borderRadius: '50%', background: 'white',
              opacity: 0.15 + (i % 4) * 0.1,
              left: `${(i * 43 + 11) % 80 + 10}%`,
              top: `${(i * 59 + 7) % 80 + 8}%`,
            }} />
          ))}
          {previewNode && (
            <div style={{ transform: 'scale(1.17)', transformOrigin: 'center center' }}>
              <AvatarFigure node={previewNode} labelVisible={false} />
            </div>
          )}
        </div>
      </div>

      {/* ── Trait selectors ── */}
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '20px 16px 110px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Gender */}
        <div style={{ background: 'white', borderRadius: 18, padding: '16px 16px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <SectionLabel>Género</SectionLabel>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['male', 'female'] as const).map(g => (
              <button
                key={g}
                onClick={() => { set('gender', g); set('hairStyle', 0); set('accessories', 0) }}
                style={{
                  flex: 1, padding: '11px 0',
                  borderRadius: 12, fontSize: 13.5, fontWeight: 700,
                  border: config.gender === g ? '2px solid #16302B' : '1.5px solid #d4ddd1',
                  background: config.gender === g ? '#16302B' : 'white',
                  color: config.gender === g ? 'white' : '#5a7055',
                  cursor: 'pointer', transition: 'all 0.13s',
                }}
              >
                {g === 'male' ? '♂  Hombre' : '♀  Mujer'}
              </button>
            ))}
          </div>
        </div>

        {/* Skin tone */}
        <div style={{ background: 'white', borderRadius: 18, padding: '16px 16px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <SectionLabel>Tono de piel</SectionLabel>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            {AVATAR_SKIN_TONES.map((color, i) => (
              <ColorSwatch key={i} color={color} selected={config.skinTone === i} onClick={() => set('skinTone', i)} />
            ))}
          </div>
        </div>

        {/* Face shape */}
        <div style={{ background: 'white', borderRadius: 18, padding: '16px 16px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <SectionLabel>Forma del rostro</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2].map(s => (
              <FaceIcon key={s} shape={s} selected={config.faceShape === s} onClick={() => set('faceShape', s)} />
            ))}
          </div>
        </div>

        {/* Hair style */}
        <div style={{ background: 'white', borderRadius: 18, padding: '16px 16px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <SectionLabel>Estilo de cabello</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hairNames.map((name, i) => (
              <HairCard key={i} name={name} idx={i} selected={config.hairStyle % hairCount === i} onClick={() => set('hairStyle', i)} />
            ))}
          </div>
        </div>

        {/* Hair color */}
        <div style={{ background: 'white', borderRadius: 18, padding: '16px 16px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <SectionLabel>Color de cabello</SectionLabel>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            {AVATAR_HAIR_COLORS.map((color, i) => (
              <ColorSwatch key={i} color={color} selected={config.hairColor === i} onClick={() => set('hairColor', i)} />
            ))}
          </div>
        </div>

        {/* Eye color */}
        <div style={{ background: 'white', borderRadius: 18, padding: '16px 16px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <SectionLabel>Color de ojos</SectionLabel>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            {AVATAR_EYE_COLORS.map((color, i) => (
              <EyeSwatch key={i} color={color} selected={config.eyeColor === i} onClick={() => set('eyeColor', i)} />
            ))}
          </div>
        </div>

        {/* Accessories */}
        <div style={{ background: 'white', borderRadius: 18, padding: '16px 16px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <SectionLabel>Accesorios</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {accNames.map((name, i) => (
              <AccChip key={i} label={name} selected={config.accessories === i} onClick={() => set('accessories', i)} />
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          style={{
            width: '100%',
            padding: '15px 0',
            borderRadius: 16,
            border: 'none',
            background: saved ? '#2d7d46' : '#16302B',
            color: 'white',
            fontWeight: 700,
            fontSize: 15,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.65 : 1,
            transition: 'background 0.2s, opacity 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 16px rgba(22,48,43,0.28)',
          }}
        >
          {saving ? (
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          ) : saved ? (
            <><Check size={16} /> Avatar guardado</>
          ) : (
            'Guardar avatar'
          )}
        </button>

      </div>
    </main>
  )
}
