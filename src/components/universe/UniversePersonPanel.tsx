'use client'
import React from 'react'
import type { UniverseNode } from './useUniverseLayout'

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
      {/* Mobile: bottom sheet */}
      <div
        role="dialog"
        aria-label={node ? `Perfil de ${node.shortName}` : undefined}
        aria-modal="false"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, #1A1208 0%, rgba(20,14,6,0.97) 100%)',
          borderTop: '1px solid rgba(242,180,60,0.18)',
          borderRadius: '16px 16px 0 0',
          padding: '20px 24px 32px',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.34,1.22,0.64,1)',
          zIndex: 50,
          maxWidth: 480,
          margin: '0 auto',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.18)',
          margin: '0 auto 16px',
        }} />

        {node && (
          <PanelContent
            node={node}
            onClose={onClose}
            onRefocus={onRefocus}
            onEdit={onEdit}
            onInvite={onInvite}
          />
        )}
      </div>

      {/* Backdrop tap to close */}
      {visible && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 49,
            background: 'rgba(0,0,0,0.0)',
          }}
          onClick={onClose}
          aria-hidden
        />
      )}
    </>
  )
}

function PanelContent({ node, onClose, onRefocus, onEdit, onInvite }: { node: UniverseNode } & Omit<Props, 'node'>) {
  return (
    <div>
      {/* Header row */}
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
            padding: '0 4px', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {node.isJoined && (
          <StatusChip color="#2A6B3A" text="En Ceiba" />
        )}
        {!node.isJoined && (
          <StatusChip color="#5C4A20" text="Sin cuenta" />
        )}
        {node.isDeceased && (
          <StatusChip color="#4A4A4A" text="Fallecido/a" />
        )}
        {node.isRoot && (
          <StatusChip color="#2A4A7A" text="Tú" />
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Re-focus on this person */}
        <ActionButton
          onClick={() => { onRefocus?.(node.id); onClose?.() }}
          label="Centrar aquí"
          icon="◎"
          primary
        />

        {node.memberId && onEdit && (
          <ActionButton
            onClick={() => onEdit(node.memberId!)}
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
