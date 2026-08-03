'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2, User } from 'lucide-react'
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
        width: 44, height: 44,
        borderRadius: '50%',
        background: color,
        border: selected ? '3px solid #d4af37' : '2.5px solid rgba(255,255,255,0.08)',
        boxShadow: selected
          ? '0 0 0 2px #030208, 0 0 0 4px #d4af37, 0 4px 12px rgba(212,175,55,0.35)'
          : '0 1px 4px rgba(0,0,0,0.4)',
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
        width: 44, height: 44,
        borderRadius: '50%',
        background: color,
        border: selected ? '3px solid #d4af37' : '2.5px solid rgba(255,255,255,0.08)',
        boxShadow: selected
          ? '0 0 0 2px #030208, 0 0 0 4px #d4af37, 0 4px 12px rgba(212,175,55,0.35)'
          : '0 1px 4px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(5,2,0,0.75)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', margin: '2px auto 0' }} />
        </div>
      </div>
    </button>
  )
}

function FaceIcon({ shape, selected, onClick }: { shape: number; selected: boolean; onClick: () => void }) {
  const W = 40, H = 46
  const cx = W / 2, cy = H / 2 - 1
  const rx = shape === 1 ? 15.5 : shape === 2 ? 15 : 13
  const ry = shape === 1 ? 15.5 : shape === 2 ? 14 : 18
  const r  = shape === 2 ? 4 : 1
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 4px',
        borderRadius: 12,
        border: selected ? '2px solid #d4af37' : '1.5px solid rgba(255,255,255,0.08)',
        background: selected ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transition: 'all 0.12s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        boxShadow: selected ? '0 0 12px rgba(212,175,55,0.20)' : 'none',
      }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} rx={r} ry={r}
          fill={selected ? '#d4af37' : 'rgba(255,255,255,0.25)'} />
      </svg>
      <span style={{ fontSize: 10, fontWeight: 600, color: selected ? '#d4af37' : 'rgba(255,255,255,0.35)', letterSpacing: '0.01em' }}>
        {FACE_SHAPE_NAMES[shape]}
      </span>
    </button>
  )
}

function HairCard({ name, idx, selected, onClick }: { name: string; idx: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 0 calc(33% - 6px)',
        padding: '10px 6px 9px',
        borderRadius: 12,
        border: selected ? '2px solid #d4af37' : '1.5px solid rgba(255,255,255,0.08)',
        background: selected ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transition: 'all 0.12s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        minWidth: 0,
        boxShadow: selected ? '0 0 12px rgba(212,175,55,0.18)' : 'none',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: selected ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.08)',
        border: selected ? '1.5px solid #d4af37' : '1.5px solid rgba(255,255,255,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: selected ? '#d4af37' : 'rgba(255,255,255,0.4)', fontWeight: 700,
      }}>
        {idx + 1}
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: selected ? '#d4af37' : 'rgba(255,255,255,0.35)', letterSpacing: '0.01em', textAlign: 'center', lineHeight: 1.2 }}>
        {name}
      </span>
    </button>
  )
}

function AccChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 6px',
        borderRadius: 10,
        border: selected ? '2px solid #d4af37' : '1.5px solid rgba(255,255,255,0.08)',
        background: selected ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
        color: selected ? '#d4af37' : 'rgba(255,255,255,0.35)',
        fontSize: 11, fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.12s',
        letterSpacing: '0.01em', textAlign: 'center', lineHeight: 1.3,
        boxShadow: selected ? '0 0 10px rgba(212,175,55,0.18)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#0c0a18',
      borderRadius: 18,
      padding: '16px 16px 14px',
      border: '0.5px solid rgba(212,175,55,0.12)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
    }}>
      <p style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em',
        color: 'rgba(212,175,55,0.5)', textTransform: 'uppercase', marginBottom: 12,
      }}>
        {label}
      </p>
      {children}
    </div>
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
  const svgContainerRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
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

  const exportAsPhoto = async () => {
    if (!svgContainerRef.current || !userId) return
    const svgEl = svgContainerRef.current.querySelector('svg')
    if (!svgEl) return

    setExporting(true)
    setExported(false)

    try {
      // First save config so it's stored
      await supabase.from('profiles').update({ avatar_config: config }).eq('id', userId)

      // Serialize SVG → canvas → PNG blob
      const svgData = new XMLSerializer().serializeToString(svgEl)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)

      const SIZE = 280
      await new Promise<void>((resolve, reject) => {
        const img = new window.Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = SIZE
          canvas.height = SIZE
          const ctx = canvas.getContext('2d')!
          // dark background to match the avatar bg
          ctx.fillStyle = '#030208'
          ctx.fillRect(0, 0, SIZE, SIZE)
          // center the 72×84 avatar in a circle crop
          const scale = SIZE / 72
          ctx.drawImage(img, 0, 0, SIZE, Math.round(84 * scale))
          URL.revokeObjectURL(svgUrl)

          canvas.toBlob(async (blob) => {
            if (!blob) { reject(new Error('canvas toBlob failed')); return }
            const path = `${userId}/avatar.png`
            const { error } = await supabase.storage
              .from('avatars')
              .upload(path, blob, { contentType: 'image/png', upsert: true })
            if (error) { reject(error); return }
            await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId)
            resolve()
          }, 'image/png')
        }
        img.onerror = reject
        img.src = svgUrl
      })

      setExported(true)
      setTimeout(() => setExported(false), 3500)
    } catch (err) {
      console.error('export avatar:', err)
    } finally {
      setExporting(false)
    }
  }

  const hairNames = config.gender === 'female' ? FEMALE_HAIR_NAMES : MALE_HAIR_NAMES
  const hairCount = hairNames.length
  const accNames  = config.gender === 'female' ? FEMALE_ACCESSORY_NAMES : MALE_ACCESSORY_NAMES
  const previewNode = userId ? makePreviewNode(userId, displayName, config) : null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#030208', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#d4af37' }} />
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#030208' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes universeFloat {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes universeSpin { to { transform: rotate(360deg); } }
        @keyframes universeGlowPulse {
          0%,100% { opacity:1; transform:scaleX(1); }
          50%      { opacity:0.55; transform:scaleX(0.88); }
        }
        @keyframes photoRing {
          0%,100% { box-shadow: 0 0 0 3px rgba(212,175,55,0.5), 0 0 20px rgba(212,175,55,0.2); }
          50%      { box-shadow: 0 0 0 3px rgba(212,175,55,0.9), 0 0 32px rgba(212,175,55,0.45); }
        }
      `}</style>

      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(3,2,8,0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(212,175,55,0.15)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center',
        padding: '10px 16px', gap: 14,
      }}>
        <Link href="/profile" style={{ color: 'rgba(212,175,55,0.7)', display: 'flex', flexShrink: 0, textDecoration: 'none' }}>
          <ArrowLeft size={20} />
        </Link>

        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '0.01em' }}>
            Mi avatar
          </div>
          <div style={{ color: 'rgba(212,175,55,0.45)', fontSize: 10.5, letterSpacing: '0.03em', marginTop: 1 }}>
            Vista previa en tiempo real
          </div>
        </div>

        {/* Live preview — also serves as export target */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 90, height: 90,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 38% 32%, #0d1f3c 0%, #05090f 72%)',
            border: '1.5px solid rgba(212,175,55,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 22px rgba(212,175,55,0.14), inset 0 0 14px rgba(0,0,0,0.55)',
            position: 'relative', overflow: 'hidden',
          }}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute', width: 1.2, height: 1.2, borderRadius: '50%', background: 'white',
                opacity: 0.12 + (i % 4) * 0.08,
                left: `${(i * 43 + 11) % 80 + 10}%`,
                top: `${(i * 59 + 7) % 80 + 8}%`,
              }} />
            ))}
            {/* Hidden container for SVG export */}
            <div ref={svgContainerRef} style={{ transform: 'scale(1.17)', transformOrigin: 'center center' }}>
              {previewNode && <AvatarFigure node={previewNode} labelVisible={false} />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Trait selectors ── */}
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px 120px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Gender */}
        <SectionCard label="Género">
          <div style={{ display: 'flex', gap: 10 }}>
            {(['male', 'female'] as const).map(g => (
              <button
                key={g}
                onClick={() => { set('gender', g); set('hairStyle', 0); set('accessories', 0) }}
                style={{
                  flex: 1, padding: '12px 0',
                  borderRadius: 12, fontSize: 14, fontWeight: 700,
                  border: config.gender === g ? '2px solid #d4af37' : '1.5px solid rgba(255,255,255,0.08)',
                  background: config.gender === g ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                  color: config.gender === g ? '#d4af37' : 'rgba(255,255,255,0.35)',
                  cursor: 'pointer', transition: 'all 0.13s',
                  boxShadow: config.gender === g ? '0 0 14px rgba(212,175,55,0.20)' : 'none',
                }}
              >
                {g === 'male' ? '♂  Hombre' : '♀  Mujer'}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Skin tone */}
        <SectionCard label="Tono de piel">
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            {AVATAR_SKIN_TONES.map((color, i) => (
              <ColorSwatch key={i} color={color} selected={config.skinTone === i} onClick={() => set('skinTone', i)} />
            ))}
          </div>
        </SectionCard>

        {/* Face shape */}
        <SectionCard label="Forma del rostro">
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2].map(s => (
              <FaceIcon key={s} shape={s} selected={config.faceShape === s} onClick={() => set('faceShape', s)} />
            ))}
          </div>
        </SectionCard>

        {/* Hair style */}
        <SectionCard label="Estilo de cabello">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hairNames.map((name, i) => (
              <HairCard key={i} name={name} idx={i} selected={config.hairStyle % hairCount === i} onClick={() => set('hairStyle', i)} />
            ))}
          </div>
        </SectionCard>

        {/* Hair color */}
        <SectionCard label="Color de cabello">
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            {AVATAR_HAIR_COLORS.map((color, i) => (
              <ColorSwatch key={i} color={color} selected={config.hairColor === i} onClick={() => set('hairColor', i)} />
            ))}
          </div>
        </SectionCard>

        {/* Eye color */}
        <SectionCard label="Color de ojos">
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            {AVATAR_EYE_COLORS.map((color, i) => (
              <EyeSwatch key={i} color={color} selected={config.eyeColor === i} onClick={() => set('eyeColor', i)} />
            ))}
          </div>
        </SectionCard>

        {/* Accessories */}
        <SectionCard label="Accesorios">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {accNames.map((name, i) => (
              <AccChip key={i} label={name} selected={config.accessories === i} onClick={() => set('accessories', i)} />
            ))}
          </div>
        </SectionCard>

        {/* ── Action buttons ── */}

        {/* Primary: Use as profile photo */}
        <button
          onClick={exportAsPhoto}
          disabled={exporting}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 16, border: 'none',
            cursor: exporting ? 'default' : 'pointer',
            opacity: exporting ? 0.75 : 1,
            transition: 'opacity 0.15s',
            background: exported
              ? 'linear-gradient(135deg, #2d6a4f, #1a5c3e)'
              : 'linear-gradient(135deg, #c9a820 0%, #e8c840 50%, #c9a820 100%)',
            borderTop: exported ? '2px solid #52b788' : '2px solid #f5e060',
            borderBottom: exported ? '3px solid #1a4a30' : '3px solid #6a5600',
            boxShadow: exported
              ? '0 7px 0 #0d3020, 0 12px 24px rgba(0,0,0,0.7)'
              : '0 7px 0 #4a3c00, 0 12px 24px rgba(0,0,0,0.7), 0 0 24px rgba(212,175,55,0.25)',
            color: exported ? '#a8ffcc' : '#030208',
            fontWeight: 800, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {exporting ? (
            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Guardando como foto…</>
          ) : exported ? (
            <><Check size={18} /> ¡Foto de perfil actualizada!</>
          ) : (
            <><User size={18} /> Usar como foto de perfil</>
          )}
        </button>

        {/* Secondary: Save config only */}
        <button
          onClick={save}
          disabled={saving}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 16,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.65 : 1,
            transition: 'background 0.2s, opacity 0.15s',
            background: saved ? 'rgba(45,125,70,0.20)' : 'rgba(255,255,255,0.06)',
            border: saved ? '1.5px solid rgba(82,183,136,0.5)' : '1.5px solid rgba(255,255,255,0.1)',
            color: saved ? '#52b788' : 'rgba(255,255,255,0.5)',
            fontWeight: 700, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {saving ? (
            <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</>
          ) : saved ? (
            <><Check size={15} /> Config guardada</>
          ) : (
            'Guardar configuración'
          )}
        </button>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', textAlign: 'center', lineHeight: 1.6 }}>
          "Usar como foto de perfil" guarda tu avatar como imagen y lo muestra en todo Ceiba.
          <br />"Guardar configuración" solo guarda los ajustes para seguir editando después.
        </p>

      </div>
    </main>
  )
}
