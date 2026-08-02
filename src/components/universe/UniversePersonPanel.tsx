'use client'
import React from 'react'
import type { UniverseNode } from './useUniverseLayout'

/*
 * Layout constants (keep in sync with BottomNav height).
 * BottomNav: fixed bottom-0, z-index 50, approx 64px tall + safe-area.
 * Panel must sit above BottomNav, so z-index: 60 and bottom offset ≥ nav height.
 */
const NAV_H = 64 /* px, BottomNav approximate height without safe-area */

const PANEL_CSS = `
.unv-panel {
  position: fixed;
  bottom: calc(${NAV_H}px + env(safe-area-inset-bottom, 0px));
  left: 0;
  right: 0;
  background: linear-gradient(to top, #1A1208 0%, rgba(20,14,6,0.97) 100%);
  border-top: 1px solid rgba(242,180,60,0.18);
  border-radius: 16px 16px 0 0;
  z-index: 60;
  box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  max-height: calc(55dvh - ${NAV_H}px);
  overflow: hidden;
  transform: translateY(calc(100% + ${NAV_H}px + env(safe-area-inset-bottom, 0px)));
  transition: transform 0.35s cubic-bezier(0.34,1.22,0.64,1);
}
.unv-panel--visible {
  transform: translateY(0);
}
.unv-panel__header {
  flex-shrink: 0;
  padding: 16px 20px 0;
}
.unv-panel__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0 20px;
  padding-bottom: 12px;
  -webkit-overflow-scrolling: touch;
}
.unv-panel__actions {
  flex-shrink: 0;
  padding: 8px 20px 16px;
}
@media (min-width: 768px) {
  .unv-panel {
    left: auto;
    right: 24px;
    bottom: 24px;
    width: clamp(280px, 22vw, 360px);
    max-height: min(calc(100dvh - 80px), 480px);
    border-radius: 16px;
    border-top: 1px solid rgba(242,180,60,0.18);
    transform: translateY(calc(100% + 40px));
  }
  .unv-panel--visible {
    transform: translateY(0);
  }
}
`

interface Props {
  node: UniverseNode | null
  onClose?: () => void
  onRefocus?: (id: string) => void
  onEdit?: (memberId: string) => void
  onInvite?: (memberId: string) => void
}

export function UniversePersonPanel({ node, onClose, onRefocus, onEdit, onInvite }: Props) {
  const visible = !!node && !node.isFocal

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PANEL_CSS }} />

      {/* stopPropagation so container's onClick-to-close doesn't fire for panel clicks */}
      <div
        role="dialog"
        aria-label={node ? `Perfil de ${node.shortName}` : undefined}
        aria-modal="false"
        className={`unv-panel${visible ? ' unv-panel--visible' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Fixed header: drag handle + name/close */}
        <div className="unv-panel__header">
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.18)',
            margin: '0 auto 16px',
          }} />

          {node && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 18, fontWeight: 700,
                  color: '#F2E8D0',
                  lineHeight: 1.2,
                }}>
                  {node.name}
                </div>
                <div style={{
                  fontSize: 13,
                  color: '#F2B43C',
                  marginTop: 3,
                  letterSpacing: '0.03em',
                }}>
                  {node.relation}
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Cerrar panel"
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 20, cursor: 'pointer',
                  minWidth: 44, minHeight: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Scrollable body: status chips */}
        <div className="unv-panel__body">
          {node && <PanelChips node={node} />}
        </div>

        {/* Fixed actions row — always visible, never scrolled away */}
        <div className="unv-panel__actions">
          {node && (
            <PanelActions
              node={node}
              onClose={onClose}
              onRefocus={onRefocus}
              onEdit={onEdit}
              onInvite={onInvite}
            />
          )}
        </div>
      </div>

    </>
  )
}

function PanelChips({ node }: { node: UniverseNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4, paddingBottom: 8 }}>
      {node.isJoined  && <StatusChip color="#2A6B3A" text="En Ceiba" />}
      {!node.isJoined && <StatusChip color="#5C4A20" text="Sin cuenta" />}
      {node.isDeceased && <StatusChip color="#4A4A4A" text="Fallecido/a" />}
      {node.isRoot    && <StatusChip color="#2A4A7A" text="Tú" />}
      <p style={{
        width: '100%',
        marginTop: 8,
        fontSize: 11,
        color: 'rgba(242,180,60,0.45)',
        letterSpacing: '0.02em',
        textAlign: 'center',
      }}>
        Toca nuevamente para explorar su familia
      </p>
    </div>
  )
}

function PanelActions({
  node, onClose, onRefocus, onEdit, onInvite,
}: { node: UniverseNode } & Omit<Props, 'node'>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* "Centrar aquí" — always visible; this is the primary action */}
      {onRefocus && (
        <ActionButton
          onClick={() => { onClose?.(); onRefocus(node.id) }}
          label="Explorar su familia"
          icon="⊙"
          primary
        />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {node.memberId && onEdit && (
          <ActionButton
            onClick={() => { onClose?.(); onEdit(node.memberId!) }}
            label="Editar"
            icon="✎"
          />
        )}
        {node.memberId && !node.isJoined && onInvite && (
          <ActionButton
            onClick={() => onInvite(node.memberId!)}
            label="Invitar"
            icon="✉"
          />
        )}
      </div>
    </div>
  )
}

function StatusChip({ color, text }: { color: string; text: string }) {
  return (
    <span style={{
      background: color + '40',
      border: `1px solid ${color}80`,
      color: '#F2E8D0',
      borderRadius: 20,
      fontSize: 11,
      padding: '3px 10px',
      letterSpacing: '0.02em',
    }}>
      {text}
    </span>
  )
}

function ActionButton({
  onClick, label, icon, primary,
}: {
  onClick: () => void
  label: string
  icon: string
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: primary ? 1 : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6,
        padding: '10px 16px',
        minHeight: 44,
        borderRadius: 12,
        border: primary
          ? '1px solid rgba(242,180,60,0.5)'
          : '1px solid rgba(255,255,255,0.15)',
        background: primary
          ? 'rgba(242,180,60,0.12)'
          : 'rgba(255,255,255,0.05)',
        color: primary ? '#F2B43C' : 'rgba(255,255,255,0.75)',
        fontSize: 13,
        fontWeight: primary ? 600 : 400,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
