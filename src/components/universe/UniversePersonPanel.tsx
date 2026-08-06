'use client'
import React, { useEffect, useState } from 'react'
import type { UniverseNode } from './useUniverseLayout'

// ── Types ─────────────────────────────────────────────────────────────────────
interface PersonaData {
  id: string
  first_name: string
  middle_name?: string | null
  first_surname?: string | null
  second_surname?: string | null
  birth_date?: string | null
  birth_city?: string | null
  birth_country?: string | null
  avatarUrl?: string | null
  hasAccount: boolean
  is_deceased?: boolean
}

interface EventItem {
  id: string
  title: string
  event_type: string
  event_date: string
  description?: string | null
}

interface PersonaResponse {
  person: PersonaData
  relationType: string | null
  relatives: any[]
  events: EventItem[]
}

type TabKey = 'historia' | 'galeria' | 'recuerdos' | 'atributos'
const TAB_LABELS: Record<TabKey, string> = {
  historia: 'Historia', galeria: 'Galería', recuerdos: 'Recuerdos', atributos: 'Atributos',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const EVENT_SYMBOL: Record<string, string> = {
  birth: '✦', marriage: '◎', death: '✦', graduation: '⬟',
  reunion: '◈', anniversary: '★', other: '◇',
}
const EVENT_COLOR: Record<string, string> = {
  birth: '212,175,55', marriage: '220,120,60', death: '160,160,190',
  graduation: '60,130,240', anniversary: '160,80,240', reunion: '80,180,120', other: '120,120,160',
}

function birthYear(d?: string | null): number | null {
  if (!d) return null
  return new Date(d + 'T12:00:00').getFullYear()
}
function eventYear(d: string): number {
  return new Date(d + 'T12:00:00').getFullYear()
}
function formatDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const NAV_H = 64
const PANEL_CSS = `
.unv-panel {
  position: fixed;
  left: 0; right: 0;
  bottom: calc(${NAV_H}px + env(safe-area-inset-bottom, 0px));
  max-height: 82dvh;
  background: #080610;
  border-top: 1px solid rgba(212,175,55,0.2);
  border-radius: 24px 24px 0 0;
  z-index: 600;
  box-shadow: 0 -20px 60px rgba(0,0,0,0.75);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateY(calc(100% + ${NAV_H}px + env(safe-area-inset-bottom, 0px)));
  transition: transform 0.30s ease-out;
  pointer-events: auto;
}
.unv-panel--visible { transform: translateY(0); }

@media (min-width: 768px) {
  .unv-panel {
    left: auto; right: 0;
    top: ${NAV_H}px; bottom: 0;
    max-height: none;
    width: min(360px, 100vw);
    border-radius: 20px 0 0 20px;
    border-top: none;
    border-left: 1px solid rgba(212,175,55,0.15);
    box-shadow: -12px 0 48px rgba(0,0,0,0.65);
    transform: translateX(calc(100% + 8px));
    transition: transform 0.30s ease-out;
  }
  .unv-panel--visible { transform: translateX(0); }
  .unv-panel__handle { display: none; }
}

.unv-panel__handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: rgba(255,255,255,0.12);
  margin: 10px auto 0;
  flex-shrink: 0;
}
.unv-panel__close {
  position: absolute; top: 12px; right: 14px; z-index: 10;
  width: 30px; height: 30px; border-radius: 50%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.5);
  font-size: 18px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.unv-panel__close:hover { background: rgba(255,255,255,0.12); color: #fff; }

.unv-panel__hero {
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  padding: 18px 20px 14px;
  background: radial-gradient(ellipse 80% 55% at 50% 35%, rgba(20,12,50,0.65) 0%, transparent 100%);
}
.unv-panel__hero::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 100% 80% at 50% 0%, rgba(212,175,55,0.05) 0%, transparent 65%);
  pointer-events: none;
}

/* Tabs bar */
.unv-tabs {
  flex-shrink: 0;
  display: flex;
  border-bottom: 0.5px solid rgba(212,175,55,0.12);
  background: rgba(8,6,16,0.97);
}
.unv-tab {
  flex: 1;
  padding: 10px 4px;
  background: none; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; font-size: 12px; font-weight: 500;
  color: rgba(255,255,255,0.3);
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.unv-tab--active {
  font-weight: 700;
  color: #d4af37;
  border-bottom-color: #d4af37;
}

/* Scrollable tab content */
.unv-panel__body {
  flex: 1 1 auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 14px 16px 8px;
}

/* Footer */
.unv-panel__footer {
  flex-shrink: 0;
  padding: 10px 16px 14px;
  border-top: 1px solid rgba(212,175,55,0.08);
  background: rgba(8,6,16,0.97);
}

/* Timeline */
.unv-timeline { position: relative; }
.unv-timeline::before {
  content: '';
  position: absolute;
  left: 12px; top: 20px; bottom: 8px; width: 1px;
  background: linear-gradient(180deg, rgba(212,175,55,0.4) 0%, rgba(212,175,55,0.04) 100%);
}
.unv-tl-row { display: flex; gap: 14px; margin-bottom: 10px; }
.unv-tl-dot {
  position: relative; z-index: 2; flex-shrink: 0;
  width: 24px;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12px;
}
.unv-tl-dot__inner {
  width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 7px;
}
.unv-tl-card {
  flex: 1;
  background: rgba(12,10,24,0.85);
  border-radius: 12px;
  padding: 10px 13px;
}

/* Attr rows */
.unv-attr-row {
  display: flex; align-items: center; gap: 12;
  background: rgba(12,10,24,0.85);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
}
.unv-attr-icon {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
}

/* Empty state */
.unv-empty {
  padding: 36px 0;
  text-align: center;
}
`

// ── Main panel ────────────────────────────────────────────────────────────────
interface Props {
  node: UniverseNode | null
  onClose?: () => void
  onRefocus?: (id: string) => void
  onEdit?: (memberId: string) => void
  onInvite?: (memberId: string) => void
  onAdd?: () => void
}

export function UniversePersonPanel({ node, onClose, onRefocus, onEdit, onInvite, onAdd }: Props) {
  const visible = !!node && !node.isFocal
  const [data, setData] = useState<PersonaResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<TabKey>('historia')

  useEffect(() => {
    if (!node?.memberId || node.isFocal) { setData(null); return }
    setLoading(true)
    setTab('historia')
    fetch(`/api/persona/${node.memberId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [node?.memberId, node?.isFocal])

  const person = data?.person ?? null
  const events = data?.events ?? []
  const firstName = person?.first_name ?? node?.shortName ?? ''

  const bYear = birthYear(person?.birth_date)
  const yearsLine = person?.is_deceased
    ? `${bYear ?? '?'} — †`
    : bYear ? `${bYear} — Presente` : null

  const birthEvent: EventItem | null = bYear && person?.birth_date ? {
    id: 'birth', title: 'Nacimiento', event_type: 'birth',
    event_date: person.birth_date, description: null,
  } : null

  const timelineItems: EventItem[] = [
    ...(birthEvent ? [birthEvent] : []),
    ...events.filter(e => e.event_type !== 'birth'),
  ].slice(0, 8)

  const memories = events.filter(e => e.description && e.description.trim().length > 0)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PANEL_CSS }} />
      <div
        role="dialog"
        aria-label={node ? `Perfil de ${node?.shortName}` : undefined}
        aria-modal="false"
        className={`unv-panel${visible ? ' unv-panel--visible' : ''}`}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <div className="unv-panel__handle" />
        <button className="unv-panel__close" onClick={onClose} aria-label="Cerrar">×</button>

        {/* ── HERO ── */}
        <div className="unv-panel__hero">
          {node && (
            <PersonHero
              node={node}
              person={person}
              yearsLine={yearsLine}
              loading={loading}
            />
          )}
        </div>

        {/* ── TABS BAR ── */}
        <div className="unv-tabs">
          {(Object.keys(TAB_LABELS) as TabKey[]).map(t => (
            <button
              key={t}
              className={`unv-tab${tab === t ? ' unv-tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="unv-panel__body">

          {/* HISTORIA */}
          {tab === 'historia' && (
            timelineItems.length > 0 ? (
              <div className="unv-timeline">
                {timelineItems.map(ev => {
                  const col = EVENT_COLOR[ev.event_type] ?? '120,120,160'
                  return (
                    <div key={ev.id} className="unv-tl-row">
                      <div className="unv-tl-dot">
                        <div className="unv-tl-dot__inner" style={{
                          background: `rgba(${col},0.12)`,
                          border: `1.5px solid rgba(${col},0.5)`,
                          color: `rgba(${col},0.9)`,
                        }}>
                          {EVENT_SYMBOL[ev.event_type] ?? '•'}
                        </div>
                      </div>
                      <div className="unv-tl-card" style={{ borderTop: `1.5px solid rgba(${col},0.2)` }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: `rgb(${col})`, lineHeight: 1, marginBottom: 2 }}>
                          {eventYear(ev.event_date)}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.35, marginBottom: 2 }}>
                          {ev.event_type === 'birth' && person?.birth_city
                            ? `Nació en ${person.birth_city}${person.birth_country ? `, ${person.birth_country}` : ''}`
                            : ev.title}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{formatDate(ev.event_date)}</div>
                        {ev.description && (
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 5, fontStyle: 'italic', lineHeight: 1.5 }}>
                            {ev.description}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="unv-empty">
                <div style={{ fontSize: 22, opacity: 0.2, marginBottom: 8 }}>✦</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 1.6 }}>
                  Sin momentos registrados aún.
                  <br />Agrega un primer momento para<br />comenzar la historia de {firstName}.
                </div>
              </div>
            )
          )}

          {/* GALERÍA */}
          {tab === 'galeria' && (
            <div className="unv-empty">
              <div style={{ fontSize: 32, opacity: 0.25, marginBottom: 12 }}>◻</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.38)', marginBottom: 6 }}>
                Galería no disponible aún
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', lineHeight: 1.6 }}>
                Las fotos de {firstName} aparecerán aquí
                <br />cuando se agreguen al álbum familiar.
              </div>
              <a href="/photos" style={{
                display: 'inline-block', marginTop: 20,
                background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: 100, padding: '8px 20px', textDecoration: 'none',
                fontSize: 12, fontWeight: 600, color: '#d4af37',
              }}>
                Abrir álbum familiar
              </a>
            </div>
          )}

          {/* RECUERDOS */}
          {tab === 'recuerdos' && (
            memories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {memories.slice(0, 6).map(ev => (
                  <div key={ev.id} style={{
                    background: 'rgba(12,10,24,0.85)', borderRadius: 14, padding: '13px 14px',
                    border: '1px solid rgba(212,175,55,0.1)',
                  }}>
                    <div style={{ fontSize: 10, color: 'rgba(212,175,55,0.55)', marginBottom: 4, letterSpacing: '0.03em' }}>
                      {formatDate(ev.event_date)}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>
                      {ev.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 1.6, fontStyle: 'italic' }}>
                      "{ev.description}"
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="unv-empty">
                <div style={{ fontSize: 22, opacity: 0.2, marginBottom: 8 }}>◈</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 1.6 }}>
                  Sin recuerdos todavía.
                  <br />Los momentos especiales de {firstName}
                  <br />vivirán aquí.
                </div>
              </div>
            )
          )}

          {/* ATRIBUTOS */}
          {tab === 'atributos' && (
            person?.birth_date || person?.birth_city || person?.hasAccount ? (
              <div>
                {person?.birth_date && (
                  <AttrRow icon="✦" iconColor="212,175,55" label="Fecha de nacimiento" value={formatDate(person.birth_date)} />
                )}
                {(person?.birth_city || person?.birth_country) && (
                  <AttrRow icon="◎" iconColor="60,130,220" label="Lugar de nacimiento"
                    value={[person.birth_city, person.birth_country].filter(Boolean).join(', ')} />
                )}
                {person?.hasAccount && (
                  <AttrRow icon="✓" iconColor="40,200,100" label="Cuenta Ceiba" value="Conectado a Ceiba" />
                )}
                {(node?.isDeceased || person?.is_deceased) && (
                  <AttrRow icon="†" iconColor="160,160,190" label="Estado" value="Fallecido/a" />
                )}
              </div>
            ) : (
              <div className="unv-empty">
                <div style={{ fontSize: 22, opacity: 0.2, marginBottom: 8 }}>◇</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 1.6 }}>
                  Sin atributos registrados.
                </div>
              </div>
            )
          )}

        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="unv-panel__footer">
          {node && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <ActionButton
                onClick={() => { onRefocus?.(node.id); onClose?.() }}
                label="Ver su familia"
                icon="◎"
                primary
              />
              {node.memberId && onEdit && (
                <ActionButton
                  onClick={() => { onClose?.(); onEdit(node.memberId!) }}
                  label="Editar"
                  icon="✎"
                />
              )}
              {node.memberId && !node.isJoined && onInvite && (
                <ActionButton
                  onClick={() => { onClose?.(); onInvite(node.memberId!) }}
                  label="Invitar"
                  icon="✉"
                />
              )}
              {onAdd && (
                <ActionButton
                  onClick={() => { onClose?.(); onAdd() }}
                  label="+ Familiar"
                  icon="+"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── PersonHero ────────────────────────────────────────────────────────────────
function PersonHero({ node, person, yearsLine, loading }: {
  node: UniverseNode
  person: PersonaData | null
  yearsLine: string | null
  loading: boolean
}) {
  const avatarSrc = person?.avatarUrl ?? node.avatarUrl ?? null
  const fullName = node.name ?? ''
  const initials = getInitials(fullName)
  const location = [person?.birth_city, person?.birth_country].filter(Boolean).join(', ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Avatar — conic rainbow ring matching /persona page */}
      <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: -12, borderRadius: '50%',
          border: '1px solid rgba(212,175,55,0.1)',
          boxShadow: '0 0 36px rgba(212,175,55,0.1)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: -5, borderRadius: '50%',
          border: '1px solid rgba(212,175,55,0.16)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'conic-gradient(from 15deg,#d4af37 0%,#f5e070 16%,#8a6012 32%,#6030b0 48%,#2044c0 64%,#18b0c0 76%,#f0d060 88%,#d4af37 100%)',
          padding: 3,
          boxShadow: '0 0 36px rgba(212,175,55,0.28), 0 4px 20px rgba(0,0,0,0.65)',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: '#0c0a18', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {avatarSrc
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarSrc} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 26, fontWeight: 800, color: '#d4af37' }}>{initials}</span>
            }
          </div>
        </div>
      </div>

      {/* Name */}
      <div style={{
        fontSize: 19, fontWeight: 800, color: '#fff',
        letterSpacing: '-0.02em', lineHeight: 1.15,
        textAlign: 'center', marginTop: 13, padding: '0 12px',
        fontFamily: "Georgia,'Times New Roman',serif",
      }}>
        {fullName}
      </div>

      {/* Years */}
      {yearsLine && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.36)', marginTop: 3, fontWeight: 500 }}>
          {yearsLine}
        </div>
      )}

      {/* Relation */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
        <span style={{ fontSize: 9, color: '#d4af37' }}>✦</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#d4af37', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {node.relation}
        </span>
      </div>

      {/* Location */}
      {loading && !person && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 5 }}>Cargando…</div>
      )}
      {location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
          <span style={{ fontSize: 10, color: 'rgba(212,175,55,0.45)' }}>◎</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)' }}>{location}</span>
        </div>
      )}

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
        {node.isJoined && <StatusChip color="#2A6B3A" text="En Ceiba" />}
        {!node.isJoined && <StatusChip color="#5C4A20" text="Sin cuenta" />}
        {(node.isDeceased || person?.is_deceased) && <StatusChip color="#4A4A4A" text="Fallecido/a" />}
      </div>
    </div>
  )
}

// ── AttrRow ───────────────────────────────────────────────────────────────────
function AttrRow({ icon, iconColor, label, value }: {
  icon: string; iconColor: string; label: string; value: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'rgba(12,10,24,0.85)', borderRadius: 12, padding: '12px 14px',
      marginBottom: 8, border: `1px solid rgba(${iconColor},0.1)`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: `rgba(${iconColor},0.08)`,
        border: `1px solid rgba(${iconColor},0.18)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: `rgba(${iconColor},0.85)`,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(212,175,55,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{value}</div>
      </div>
    </div>
  )
}

// ── StatusChip ────────────────────────────────────────────────────────────────
function StatusChip({ color, text }: { color: string; text: string }) {
  return (
    <span style={{
      background: color + '40', border: `1px solid ${color}80`,
      color: '#F2E8D0', borderRadius: 20, fontSize: 10, padding: '3px 9px',
      letterSpacing: '0.02em',
    }}>
      {text}
    </span>
  )
}

// ── ActionButton ──────────────────────────────────────────────────────────────
function ActionButton({ onClick, label, icon, primary }: {
  onClick: () => void; label: string; icon: string; primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: primary ? 1 : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '11px 14px', minHeight: 44, borderRadius: 12,
        border: primary ? '1px solid rgba(212,175,55,0.45)' : '1px solid rgba(255,255,255,0.1)',
        background: primary ? 'rgba(212,175,55,0.10)' : 'rgba(255,255,255,0.04)',
        color: primary ? '#d4af37' : 'rgba(255,255,255,0.65)',
        fontSize: 13, fontWeight: primary ? 700 : 400,
        cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.02em',
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
