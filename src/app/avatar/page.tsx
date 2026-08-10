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
  AVATAR_TOP_COLORS,
  AVATAR_BOT_COLORS,
  MALE_HAIR_NAMES,
  FEMALE_HAIR_NAMES,
  FACE_SHAPE_NAMES,
  MALE_ACCESSORY_NAMES,
  FEMALE_ACCESSORY_NAMES,
  DEFAULT_AVATAR_CONFIG,
} from '@/lib/avatarConfig'

// ── CSS ────────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes avb-float {
    0%,100% { transform: translateY(0px); }
    50%      { transform: translateY(-8px); }
  }
  @keyframes avb-ring-a { to { transform: rotate(360deg); } }
  @keyframes avb-ring-b { to { transform: rotate(-360deg); } }
  @keyframes avb-pulse-glow {
    0%,100% { opacity:0.55; transform:scale(1); }
    50%      { opacity:1;    transform:scale(1.10); }
  }
  @keyframes avb-twinkle {
    0%,100% { opacity:0.70; } 50% { opacity:0.18; }
  }
  @keyframes avb-born-scale {
    0%   { opacity:0; transform:scale(0.5); }
    60%  { opacity:1; transform:scale(1.08); }
    100% { opacity:1; transform:scale(1); }
  }
  @keyframes avb-born-text {
    0%   { opacity:0; transform:translateY(16px); }
    100% { opacity:1; transform:translateY(0); }
  }
  @keyframes avb-born-fade {
    0%   { opacity:1; }
    80%  { opacity:1; }
    100% { opacity:0; }
  }
  @keyframes avb-spin { to { transform:rotate(360deg); } }
`

// ── Option swatches ────────────────────────────────────────────────────────────

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 38, height: 38, borderRadius: '50%', background: color, flexShrink: 0,
      border: selected ? '2.5px solid #d4af37' : '2px solid rgba(255,255,255,0.08)',
      boxShadow: selected
        ? '0 0 0 2px #030208, 0 0 0 4px rgba(212,175,55,0.80), 0 4px 12px rgba(212,175,55,0.30)'
        : '0 1px 4px rgba(0,0,0,0.4)',
      cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s',
    }} />
  )
}

function EyeSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 38, height: 38, borderRadius: '50%', background: color, flexShrink: 0,
      border: selected ? '2.5px solid #d4af37' : '2px solid rgba(255,255,255,0.08)',
      boxShadow: selected
        ? '0 0 0 2px #030208, 0 0 0 4px rgba(212,175,55,0.80), 0 4px 12px rgba(212,175,55,0.30)'
        : '0 1px 4px rgba(0,0,0,0.4)',
      cursor: 'pointer', transition: 'box-shadow 0.15s', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(5,2,0,0.75)' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', margin: '2px auto 0' }} />
        </div>
      </div>
    </button>
  )
}

function FaceOption({ shape, selected, onClick }: { shape: number; selected: boolean; onClick: () => void }) {
  const W = 34, H = 40, cx = W / 2, cy = H / 2
  const rx = shape === 1 ? 13 : shape === 2 ? 13 : 11
  const ry = shape === 1 ? 13 : shape === 2 ? 12 : 16
  const r  = shape === 2 ? 4 : 1
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px 6px', borderRadius: 14, cursor: 'pointer',
      border: selected ? '0.5px solid rgba(242,180,60,0.65)' : '0.5px solid rgba(255,255,255,0.08)',
      background: selected ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
      transition: 'all 0.12s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      boxShadow: selected ? '0 0 14px rgba(212,175,55,0.18)' : 'none',
    }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} rx={r} ry={r}
          fill={selected ? 'rgba(242,180,60,0.85)' : 'rgba(255,255,255,0.22)'} />
      </svg>
      <span style={{ fontSize: 9.5, fontWeight: 600, color: selected ? '#F2B43C' : 'rgba(255,255,255,0.30)',
        letterSpacing: '0.03em' }}>
        {FACE_SHAPE_NAMES[shape]}
      </span>
    </button>
  )
}

function HairChip({ name, selected, onClick }: { name: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: '7px 14px', borderRadius: 100, cursor: 'pointer',
      border: selected ? '0.5px solid rgba(242,180,60,0.65)' : '0.5px solid rgba(255,255,255,0.10)',
      background: selected ? 'rgba(242,180,60,0.14)' : 'rgba(255,255,255,0.04)',
      color: selected ? '#F2B43C' : 'rgba(255,255,255,0.32)',
      fontSize: 11, fontWeight: 600, transition: 'all 0.12s',
      boxShadow: selected ? '0 0 12px rgba(242,180,60,0.18)' : 'none',
      letterSpacing: '0.01em', whiteSpace: 'nowrap',
    }}>
      {name}
    </button>
  )
}

function AccChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: '7px 14px', borderRadius: 100, cursor: 'pointer',
      border: selected ? '0.5px solid rgba(242,180,60,0.65)' : '0.5px solid rgba(255,255,255,0.10)',
      background: selected ? 'rgba(242,180,60,0.14)' : 'rgba(255,255,255,0.04)',
      color: selected ? '#F2B43C' : 'rgba(255,255,255,0.32)',
      fontSize: 11, fontWeight: 600, transition: 'all 0.12s',
      boxShadow: selected ? '0 0 12px rgba(242,180,60,0.18)' : 'none',
      letterSpacing: '0.01em', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  )
}

// ── Preview node factory (unchanged) ──────────────────────────────────────────

function makePreviewNode(userId: string, name: string, config: AvatarConfig): UniverseNode {
  return {
    id: userId, memberId: undefined, name,
    shortName: name.split(' ')[0] || 'Tú',
    relation: 'Tú', relationType: 'root',
    gender: config.gender, avatarUrl: null, avatarConfig: config,
    isRoot: true, isFocal: true, hopDistance: 0, orbitRadius: 0,
    angleDeg: 0, cx: 0, cy: 0, scale: 1, opacity: 1, zIndex: 10,
    relevanceTier: 0, ageGroup: 'adult', isDeceased: false,
    isJoined: true, connectionChannel: 'blood', orbitParentId: null,
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
      textTransform: 'uppercase', color: 'rgba(242,180,60,0.40)',
      display: 'block', marginBottom: 10 }}>
      {children}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AvatarBuilderPage() {
  const router  = useRouter()
  const supabase = createClient()
  const svgContainerRef = useRef<HTMLDivElement>(null)

  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exported,  setExported]  = useState(false)
  const [userId,    setUserId]    = useState('')
  const [displayName, setDisplayName] = useState('Tú')
  const [config,    setConfig]    = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG)
  const [pulse,     setPulse]     = useState(false)
  const [showBorn,  setShowBorn]  = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_config')
        .eq('user_id', user.id)
        .single()
      if (data) {
        setDisplayName(data.display_name || 'Tú')
        if (data.avatar_config) setConfig({ ...DEFAULT_AVATAR_CONFIG, ...(data.avatar_config as AvatarConfig) })
      }
      setLoading(false)
    })()
  }, [])

  const set = <K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: val }))
    setPulse(true)
    setTimeout(() => setPulse(false), 380)
  }

  const save = async () => {
    setSaving(true); setSaved(false)
    await supabase.from('profiles').update({ avatar_config: config }).eq('user_id', userId)
    setSaving(false); setSaved(true)
    setShowBorn(true)
    setTimeout(() => setShowBorn(false), 2600)
    setTimeout(() => setSaved(false), 2800)
  }

  const exportAsPhoto = async () => {
    if (!svgContainerRef.current || !userId) return
    const svgEl = svgContainerRef.current.querySelector('svg')
    if (!svgEl) return
    setExporting(true); setExported(false)
    try {
      await supabase.from('profiles').update({ avatar_config: config }).eq('user_id', userId)
      const svgData = new XMLSerializer().serializeToString(svgEl)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl  = URL.createObjectURL(svgBlob)
      const SIZE    = 280
      await new Promise<void>((resolve, reject) => {
        const img = new window.Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = SIZE; canvas.height = SIZE
          const ctx = canvas.getContext('2d')!
          ctx.fillStyle = '#030208'
          ctx.fillRect(0, 0, SIZE, SIZE)
          const scale = SIZE / 72
          ctx.drawImage(img, 0, 0, SIZE, Math.round(144 * scale))
          URL.revokeObjectURL(svgUrl)
          canvas.toBlob(async (blob) => {
            if (!blob) { reject(new Error('canvas toBlob failed')); return }
            const path = `${userId}/avatar.png`
            const { error } = await supabase.storage
              .from('avatars').upload(path, blob, { contentType: 'image/png', upsert: true })
            if (error) { reject(error); return }
            await supabase.from('profiles').update({ avatar_path: path }).eq('user_id', userId)
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
    } finally { setExporting(false) }
  }

  const hairNames = config.gender === 'female' ? FEMALE_HAIR_NAMES : MALE_HAIR_NAMES
  const hairCount = hairNames.length
  const accNames  = config.gender === 'female' ? FEMALE_ACCESSORY_NAMES : MALE_ACCESSORY_NAMES
  const previewNode = userId ? makePreviewNode(userId, displayName, config) : null
  const avatarScale = pulse ? 2.04 : 2.2  // 2.2 × 0.93 ≈ 2.046

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#030208', display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 22, color: 'rgba(242,180,60,0.4)',
        animation: 'avb-twinkle 2s ease-in-out infinite' }}>✦</div>
      <style>{CSS}</style>
    </div>
  )

  return (
    <>
      <style>{CSS}</style>

      {/* ── Nebula background ──────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 120% 70% at 50% 0%, #18062e 0%, #0c0420 40%, #060214 70%, #030208 100%)' }}>
        <div style={{ position: 'absolute', top: -40, left: -30, width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(80,15,200,0.22) 0%, transparent 65%)', filter: 'blur(28px)' }} />
        <div style={{ position: 'absolute', top: '35%', right: -50, width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(15,45,180,0.14) 0%, transparent 65%)', filter: 'blur(22px)' }} />
        <div style={{ position: 'absolute', top: '55%', left: '20%', width: 300, height: 120, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 65%)', filter: 'blur(16px)' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden>
          {[[30,16,0.44],[92,10,0.36],[155,22,0.50],[220,13,0.38],[295,18,0.40],
            [18,58,0.34],[110,46,0.30],[188,62,0.38],[260,50,0.32]
          ].map(([x,y,o],i) => <circle key={i} cx={x} cy={y} r="0.6" fill="white" opacity={o} />)}
          <circle cx="175" cy="14" r="1.2" fill="#d4af37" opacity="0.88"
            style={{ animation: 'avb-twinkle 3.6s ease-in-out infinite' }} />
          <circle cx="52"  cy="30" r="0.9" fill="white"   opacity="0.80"
            style={{ animation: 'avb-twinkle 2.9s ease-in-out infinite 0.8s' }} />
        </svg>
      </div>

      <div style={{ minHeight: '100vh', position: 'relative', zIndex: 5, paddingBottom: 50 }}>

        {/* ── Back button ─────────────────────────────────────────────────── */}
        <div style={{ padding: "calc(env(safe-area-inset-top,20px) + 14px) 18px 0", display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/profile" style={{ textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(12,10,26,0.95)',
              borderTop: '1px solid rgba(212,175,55,0.28)', borderBottom: '2px solid #000',
              borderLeft: '1px solid rgba(212,175,55,0.12)', borderRight: '1px solid rgba(0,0,0,0.6)',
              boxShadow: '0 5px 0 #02010a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeft size={17} style={{ color: 'rgba(212,175,55,0.75)' }} />
            </div>
          </Link>
        </div>

        {/* ── Hero: avatar suspended in space ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 36, paddingBottom: 40 }}>

          {/* Avatar + glow + orbit rings */}
          <div style={{ position: 'relative', width: 100, height: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 32, animation: 'avb-float 5s ease-in-out infinite' }}>

            {/* Ambient glow */}
            <div style={{ position: 'absolute', inset: -70, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(242,180,60,0.28) 0%, rgba(120,50,220,0.12) 45%, transparent 68%)',
              filter: 'blur(18px)',
              animation: 'avb-pulse-glow 4.5s ease-in-out infinite', pointerEvents: 'none' }} />

            {/* Orbit ring 1 */}
            <div style={{ position: 'absolute', inset: -44, borderRadius: '50%',
              border: '0.5px solid rgba(242,180,60,0.16)',
              animation: 'avb-ring-a 22s linear infinite', pointerEvents: 'none' }} />

            {/* Orbit ring 2 */}
            <div style={{ position: 'absolute', inset: -62, borderRadius: '50%',
              border: '0.5px solid rgba(123,175,212,0.09)',
              animation: 'avb-ring-b 38s linear infinite', pointerEvents: 'none' }} />

            {/* Orbit ring 3 — faint */}
            <div style={{ position: 'absolute', inset: -80, borderRadius: '50%',
              border: '0.5px solid rgba(184,160,216,0.05)',
              animation: 'avb-ring-a 55s linear infinite', pointerEvents: 'none' }} />

            {/* Avatar SVG — scaled hero size */}
            <div ref={svgContainerRef} style={{
              transform: `scale(${avatarScale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              {previewNode && <AvatarFigure node={previewNode} labelVisible={false} />}
            </div>
          </div>

          {/* Tagline */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#F5EDD8',
              letterSpacing: '0.01em', marginBottom: 4 }}>
              Esta será tu presencia
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.32)' }}>
              en la constelación familiar.
            </div>
          </div>
        </div>

        {/* ── Controls panel ───────────────────────────────────────────────── */}
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 18px' }}>

          {/* Glass surface for all controls */}
          <div style={{
            background: 'rgba(8,5,18,0.88)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 24, border: '0.5px solid rgba(242,180,60,0.10)',
            borderTop: '0.5px solid rgba(242,180,60,0.22)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.60)',
            padding: '22px 18px 24px',
            display: 'flex', flexDirection: 'column', gap: 22,
          }}>

            {/* Gender */}
            <div>
              <Label>Identidad</Label>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['male', 'female'] as const).map(g => (
                  <button key={g}
                    onClick={() => { set('gender', g); set('hairStyle', 0); set('accessories', 0) }}
                    style={{
                      flex: 1, padding: '13px 0', borderRadius: 14, cursor: 'pointer',
                      border: config.gender === g ? '0.5px solid rgba(242,180,60,0.65)' : '0.5px solid rgba(255,255,255,0.08)',
                      background: config.gender === g ? 'rgba(242,180,60,0.12)' : 'rgba(255,255,255,0.03)',
                      color: config.gender === g ? '#F2B43C' : 'rgba(255,255,255,0.28)',
                      fontWeight: 700, fontSize: 14, transition: 'all 0.13s',
                      boxShadow: config.gender === g ? '0 0 16px rgba(242,180,60,0.16)' : 'none',
                    }}>
                    {g === 'male' ? '♂  Hombre' : '♀  Mujer'}
                  </button>
                ))}
              </div>
            </div>

            {/* Skin tone */}
            <div>
              <Label>Tono de piel</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {AVATAR_SKIN_TONES.map((color, i) => (
                  <ColorSwatch key={i} color={color} selected={config.skinTone === i} onClick={() => set('skinTone', i)} />
                ))}
              </div>
            </div>

            {/* Face shape */}
            <div>
              <Label>Rostro</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1, 2].map(s => (
                  <FaceOption key={s} shape={s} selected={config.faceShape === s} onClick={() => set('faceShape', s)} />
                ))}
              </div>
            </div>

            {/* Hair style */}
            <div>
              <Label>Cabello</Label>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {hairNames.map((name, i) => (
                  <HairChip key={i} name={name} selected={config.hairStyle % hairCount === i}
                    onClick={() => set('hairStyle', i)} />
                ))}
              </div>
            </div>

            {/* Hair color */}
            <div>
              <Label>Color de cabello</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {AVATAR_HAIR_COLORS.map((color, i) => (
                  <ColorSwatch key={i} color={color} selected={config.hairColor === i} onClick={() => set('hairColor', i)} />
                ))}
              </div>
            </div>

            {/* Eye color */}
            <div>
              <Label>Ojos</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {AVATAR_EYE_COLORS.map((color, i) => (
                  <EyeSwatch key={i} color={color} selected={config.eyeColor === i} onClick={() => set('eyeColor', i)} />
                ))}
              </div>
            </div>

            {/* Accessories */}
            <div>
              <Label>Accesorios</Label>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {accNames.map((name, i) => (
                  <AccChip key={i} label={name} selected={config.accessories === i}
                    onClick={() => set('accessories', i)} />
                ))}
              </div>
            </div>

            {/* Top color */}
            <div>
              <Label>Color ropa superior</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {AVATAR_TOP_COLORS.map((color, i) => (
                  <ColorSwatch key={i} color={color}
                    selected={(config.topColor ?? AVATAR_TOP_COLORS[0]) === color}
                    onClick={() => set('topColor', color)} />
                ))}
              </div>
            </div>

            {/* Bottom color */}
            <div>
              <Label>{config.gender === 'female' ? 'Color falda / pantalón' : 'Color pantalón'}</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {AVATAR_BOT_COLORS.map((color, i) => (
                  <ColorSwatch key={i} color={color}
                    selected={(config.botColor ?? AVATAR_BOT_COLORS[0]) === color}
                    onClick={() => set('botColor', color)} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Action buttons ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>

            {/* Primary: save identity */}
            <button onClick={save} disabled={saving} style={{
              width: '100%', padding: '15px 0', borderRadius: 18,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.75 : 1, transition: 'opacity 0.15s',
              background: saved
                ? 'linear-gradient(135deg, #2d6a4f, #1a5c3e)'
                : 'rgba(242,180,60,0.12)',
              border: saved
                ? '0.5px solid rgba(82,183,136,0.50)'
                : '0.5px solid rgba(242,180,60,0.50)',
              borderTop: saved
                ? '0.5px solid rgba(82,183,136,0.70)'
                : '0.5px solid rgba(242,180,60,0.70)',
              boxShadow: saved
                ? '0 0 20px rgba(82,183,136,0.15)'
                : '0 0 20px rgba(242,180,60,0.12)',
              color: saved ? '#a8ffcc' : '#F2B43C',
              fontWeight: 800, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              letterSpacing: '0.03em',
            }}>
              {saving ? (
                <><Loader2 size={17} style={{ animation: 'avb-spin 1s linear infinite' }} /> Guardando…</>
              ) : saved ? (
                <><Check size={17} /> ¡Identidad guardada!</>
              ) : (
                <>✦ Guardar mi identidad</>
              )}
            </button>

            {/* Secondary: use as photo */}
            <button onClick={exportAsPhoto} disabled={exporting} style={{
              width: '100%', padding: '13px 0', borderRadius: 18,
              cursor: exporting ? 'default' : 'pointer',
              opacity: exporting ? 0.70 : 1, transition: 'opacity 0.15s',
              background: exported
                ? 'linear-gradient(135deg, #2d6a4f, #1a5c3e)'
                : 'rgba(255,255,255,0.05)',
              border: exported
                ? '0.5px solid rgba(82,183,136,0.45)'
                : '0.5px solid rgba(255,255,255,0.10)',
              color: exported ? '#52b788' : 'rgba(255,255,255,0.40)',
              fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {exporting ? (
                <><Loader2 size={15} style={{ animation: 'avb-spin 1s linear infinite' }} /> Guardando como foto…</>
              ) : exported ? (
                <><Check size={15} /> ¡Foto de perfil actualizada!</>
              ) : (
                <><User size={15} /> Usar como foto de perfil</>
              )}
            </button>

            <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.20)', textAlign: 'center',
              lineHeight: 1.7, marginTop: 2 }}>
              "Guardar mi identidad" almacena tu configuración. "Usar como foto" la convierte en tu imagen de perfil visible en todo Ceiba.
            </p>
          </div>
        </div>
      </div>

      {/* ── "Tu estrella ha nacido" overlay ──────────────────────────────────── */}
      {showBorn && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(3,2,8,0.97)', backdropFilter: 'blur(24px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: 'avb-born-fade 2.6s ease forwards',
        }}>
          {/* Ambient pulse */}
          <div style={{ position: 'absolute', inset: '20%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(242,180,60,0.20) 0%, transparent 65%)',
            filter: 'blur(40px)', animation: 'avb-pulse-glow 2s ease-in-out infinite' }} />

          {/* Avatar large */}
          <div style={{ transform: 'scale(3.2)', marginBottom: 72,
            animation: 'avb-born-scale 0.7s cubic-bezier(0.34,1.56,0.64,1)' }}>
            {previewNode && <AvatarFigure node={previewNode} labelVisible={false} />}
          </div>

          {/* Text */}
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 2,
            animation: 'avb-born-text 0.7s ease 0.3s both' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.20em',
              textTransform: 'uppercase', color: 'rgba(242,180,60,0.55)', marginBottom: 10 }}>
              Tu estrella
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#F5EDD8',
              letterSpacing: '-0.02em' }}>
              ha nacido.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
