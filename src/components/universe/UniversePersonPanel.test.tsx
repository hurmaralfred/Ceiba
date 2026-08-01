// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { UniversePersonPanel } from './UniversePersonPanel'
import type { UniverseNode } from './useUniverseLayout'

afterEach(cleanup)

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<UniverseNode> = {}): UniverseNode {
  return {
    id: 'node-1',
    memberId: 'member-abc',
    name: 'Joselin Hurtado',
    shortName: 'Joselin',
    relation: 'Hermana',
    relationType: 'sister',
    gender: 'female',
    avatarUrl: null,
    isRoot: false,
    isFocal: false,
    hopDistance: 1,
    orbitRadius: 115,
    angleDeg: 0,
    cx: 80,
    cy: 0,
    scale: 1,
    opacity: 1,
    zIndex: 10,
    relevanceTier: 1,
    ageGroup: 'adult',
    isDeceased: false,
    isJoined: true,
    parentMemberId: null,
    ...overrides,
  }
}

function getPanel(container: HTMLElement) {
  return container.querySelector('.unv-panel')
}

// ─── Panel visibility ─────────────────────────────────────────────────────────

describe('UniversePersonPanel — visibility', () => {
  it('is hidden (no --visible class) when node is null', () => {
    const { container } = render(<UniversePersonPanel node={null} />)
    expect(getPanel(container)?.classList.contains('unv-panel--visible')).toBe(false)
  })

  it('is hidden when node is focal', () => {
    const { container } = render(
      <UniversePersonPanel node={makeNode({ isFocal: true })} />,
    )
    expect(getPanel(container)?.classList.contains('unv-panel--visible')).toBe(false)
  })

  it('is visible when node is non-focal', () => {
    const { container } = render(
      <UniversePersonPanel node={makeNode()} />,
    )
    expect(getPanel(container)?.classList.contains('unv-panel--visible')).toBe(true)
  })
})

// ─── Edit button ──────────────────────────────────────────────────────────────

describe('UniversePersonPanel — edit button', () => {
  it('shows edit button when onEdit and memberId are both present', () => {
    const { container } = render(
      <UniversePersonPanel
        node={makeNode({ memberId: 'member-abc' })}
        onEdit={vi.fn()}
      />,
    )
    const buttons = Array.from(container.querySelectorAll('button'))
    const editBtn = buttons.find(b => /editar/i.test(b.textContent ?? ''))
    expect(editBtn).toBeDefined()
  })

  it('hides edit button when onEdit is missing', () => {
    const { container } = render(
      <UniversePersonPanel node={makeNode({ memberId: 'member-abc' })} />,
    )
    const buttons = Array.from(container.querySelectorAll('button'))
    const editBtn = buttons.find(b => /editar/i.test(b.textContent ?? ''))
    expect(editBtn).toBeUndefined()
  })

  it('hides edit button when memberId is missing', () => {
    const { container } = render(
      <UniversePersonPanel
        node={makeNode({ memberId: undefined })}
        onEdit={vi.fn()}
      />,
    )
    const buttons = Array.from(container.querySelectorAll('button'))
    const editBtn = buttons.find(b => /editar/i.test(b.textContent ?? ''))
    expect(editBtn).toBeUndefined()
  })

  it('calls onClose before onEdit when edit is clicked', () => {
    const calls: string[] = []
    const onClose = vi.fn(() => calls.push('close'))
    const onEdit  = vi.fn(() => calls.push('edit'))

    const { container } = render(
      <UniversePersonPanel
        node={makeNode({ memberId: 'member-xyz' })}
        onClose={onClose}
        onEdit={onEdit}
      />,
    )
    const editBtn = Array.from(container.querySelectorAll('button'))
      .find(b => /editar/i.test(b.textContent ?? ''))!
    fireEvent.click(editBtn)

    expect(calls).toEqual(['close', 'edit'])
  })

  it('calls onEdit with the exact memberId', () => {
    const onEdit = vi.fn()
    const memberId = 'member-exact-id'

    const { container } = render(
      <UniversePersonPanel
        node={makeNode({ memberId })}
        onEdit={onEdit}
      />,
    )
    const editBtn = Array.from(container.querySelectorAll('button'))
      .find(b => /editar/i.test(b.textContent ?? ''))!
    fireEvent.click(editBtn)

    expect(onEdit).toHaveBeenCalledWith(memberId)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})

// ─── Close button ──────────────────────────────────────────────────────────────

describe('UniversePersonPanel — close button', () => {
  it('has minimum 44px touch target (minWidth and minHeight inline style)', () => {
    const { container } = render(
      <UniversePersonPanel node={makeNode()} onClose={vi.fn()} />,
    )
    const closeBtn = container.querySelector('button[aria-label="Cerrar panel"]') as HTMLButtonElement
    expect(closeBtn).not.toBeNull()
    expect(closeBtn.style.minWidth).toBe('44px')
    expect(closeBtn.style.minHeight).toBe('44px')
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <UniversePersonPanel node={makeNode()} onClose={onClose} />,
    )
    const closeBtn = container.querySelector('button[aria-label="Cerrar panel"]')!
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('panel has no backdrop overlay (close-on-outside handled by parent container)', () => {
    const { container } = render(
      <UniversePersonPanel node={makeNode()} onClose={vi.fn()} />,
    )
    // Backdrop was removed — outside-tap is handled by FamilyUniverse container onClick
    const backdrop = container.querySelector('div[aria-hidden="true"]')
    expect(backdrop).toBeNull()
  })
})

// ─── Invite button ────────────────────────────────────────────────────────────

describe('UniversePersonPanel — invite button', () => {
  it('shows invite for non-joined member with memberId and onInvite', () => {
    const { container } = render(
      <UniversePersonPanel
        node={makeNode({ isJoined: false, memberId: 'member-abc' })}
        onInvite={vi.fn()}
      />,
    )
    const inviteBtn = Array.from(container.querySelectorAll('button'))
      .find(b => /invitar/i.test(b.textContent ?? ''))
    expect(inviteBtn).toBeDefined()
  })

  it('hides invite for joined member even when onInvite is present', () => {
    const { container } = render(
      <UniversePersonPanel
        node={makeNode({ isJoined: true, memberId: 'member-abc' })}
        onInvite={vi.fn()}
      />,
    )
    const inviteBtn = Array.from(container.querySelectorAll('button'))
      .find(b => /invitar/i.test(b.textContent ?? ''))
    expect(inviteBtn).toBeUndefined()
  })
})

// ─── Refocus hint ─────────────────────────────────────────────────────────────

describe('UniversePersonPanel — refocus hint', () => {
  it('shows the double-tap hint text', () => {
    const { container } = render(
      <UniversePersonPanel node={makeNode()} />,
    )
    const hint = container.querySelector('p')
    expect(hint?.textContent).toMatch(/toca nuevamente/i)
  })

  it('does not render a "Centrar aquí" button', () => {
    const { container } = render(
      <UniversePersonPanel node={makeNode()} onRefocus={vi.fn()} />,
    )
    const centrarBtn = Array.from(container.querySelectorAll('button'))
      .find(b => /centrar/i.test(b.textContent ?? ''))
    expect(centrarBtn).toBeUndefined()
  })
})
