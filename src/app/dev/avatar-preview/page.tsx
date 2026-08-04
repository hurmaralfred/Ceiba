'use client'
import { AvatarFigure } from '@/components/universe/AvatarFigure'
import type { UniverseNode } from '@/components/universe/useUniverseLayout'

function node(overrides: Partial<UniverseNode>): UniverseNode {
  return {
    id: overrides.id ?? 'n1',
    name: overrides.name ?? 'María García',
    shortName: overrides.shortName ?? overrides.name ?? 'María García',
    firstName: (overrides.name ?? 'María').split(' ')[0],
    relation: overrides.relation ?? 'Mamá',
    relationType: overrides.relationType ?? 'mother',
    gender: overrides.gender ?? 'female',
    cx: 0, cy: 0,
    scale: 1,
    opacity: 1,
    zIndex: 10,
    isFocal: overrides.isFocal ?? false,
    isRoot: overrides.isRoot ?? false,
    isJoined: overrides.isJoined ?? true,
    isDeceased: overrides.isDeceased ?? false,
    relevanceTier: overrides.relevanceTier ?? 1,
    hopDistance: overrides.hopDistance ?? 1,
    ageGroup: overrides.ageGroup ?? 'adult',
    avatarUrl: overrides.avatarUrl ?? null,
    avatarConfig: overrides.avatarConfig ?? null,
    memberId: overrides.memberId ?? 'm1',
    ...overrides,
  }
}

const SAMPLES: UniverseNode[] = [
  node({ id:'root', name:'Alfredo Hurtado', shortName:'Alfredo', relationType:'root', relation:'Tú', gender:'male', isFocal:true, isRoot:true, ageGroup:'adult' }),
  node({ id:'mom',  name:'Carmen Hurtado',  shortName:'Carmen',  relationType:'mother', relation:'Mamá', gender:'female', ageGroup:'elder' }),
  node({ id:'dad',  name:'Humberto Torres', shortName:'Humberto',relationType:'father', relation:'Papá', gender:'male', ageGroup:'elder' }),
  node({ id:'wife', name:'Ana Martínez',    shortName:'Ana',     relationType:'spouse', relation:'Esposa', gender:'female', ageGroup:'adult' }),
  node({ id:'son',  name:'Elias Hurtado',   shortName:'Elias',   relationType:'son',    relation:'Hijo', gender:'male', ageGroup:'child' }),
  node({ id:'dtr',  name:'Sofía Hurtado',   shortName:'Sofía',   relationType:'daughter', relation:'Hija', gender:'female', ageGroup:'child' }),
  node({ id:'bro',  name:'Laura Hurtado',   shortName:'Laura',   relationType:'sister', relation:'Hermana', gender:'female', ageGroup:'adult', isJoined:false }),
  node({ id:'grd',  name:'José Hurtado',    shortName:'José',    relationType:'grandfather_paternal', relation:'Abuelo paterno', gender:'male', ageGroup:'elder', isDeceased:true }),
]

export default function AvatarPreviewPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#030208',
      padding: '40px 24px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ color: '#d4af37', fontSize: 18, fontWeight: 700, marginBottom: 8,
        letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Avatar Preview — /dev/avatar-preview
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 40 }}>
        Vista de retratos ilustrados con avatarConfig = null (sin foto)
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-end' }}>
        {SAMPLES.map(n => (
          <div key={n.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <AvatarFigure node={n} labelVisible highlighted={n.isFocal} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.06em' }}>
              {n.relationType}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 60, padding: '20px', background: 'rgba(255,255,255,0.03)',
        borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.8 }}>
          <strong style={{ color: 'rgba(212,175,55,0.7)' }}>avatarConfig campos:</strong><br/>
          skinTone: 0–5 · hairColor: 0–5 · eyeColor: 0–5 · hairStyle: 0–4(F)/0–5(M) · faceShape: 0–2 · accessories: -1(auto)/0(ninguno)/1(gafas)/2(barba)/3(ambos)<br/>
          <strong style={{ color: 'rgba(212,175,55,0.7)' }}>ageGroup:</strong> child · adult · elder
        </p>
      </div>
    </div>
  )
}
