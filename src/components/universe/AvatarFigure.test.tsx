// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { AvatarFigure } from './AvatarFigure'
import type { UniverseNode } from './useUniverseLayout'

afterEach(cleanup)

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<UniverseNode> = {}): UniverseNode {
  return {
    id: 'test-node',
    memberId: 'member-1',
    name: 'Test Person',
    shortName: 'Test',
    relation: 'Hermano',
    relationType: 'brother',
    gender: 'male',
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

// ─── Photo vs SVG face ────────────────────────────────────────────────────────

describe('AvatarFigure — avatar rendering (photos never shown on SVG)', () => {
  it('always renders the generated SVG face — never an <image> element', () => {
    const { container } = render(
      <AvatarFigure node={makeNode({ avatarUrl: 'https://example.com/photo.jpg' })} />,
    )
    // Profile photos are intentionally NOT rendered inside the SVG avatar
    expect(container.querySelector('image[href]')).toBeNull()
    // The generated face is always present (eye sclera circles)
    const whites = Array.from(container.querySelectorAll('circle')).filter(
      c => c.getAttribute('fill') === 'white',
    )
    expect(whites.length).toBeGreaterThan(0)
  })

  it('renders SVG face when avatarUrl is null', () => {
    const { container } = render(
      <AvatarFigure node={makeNode({ avatarUrl: null })} />,
    )
    expect(container.querySelector('image[href]')).toBeNull()
    const whites = Array.from(container.querySelectorAll('circle')).filter(
      c => c.getAttribute('fill') === 'white',
    )
    expect(whites.length).toBeGreaterThan(0)
  })

  it('eyelid paths (stroke #0A0200) are always present', () => {
    const { container } = render(
      <AvatarFigure node={makeNode({ avatarUrl: 'https://example.com/photo.jpg' })} />,
    )
    const eyelids = Array.from(container.querySelectorAll('path')).filter(
      p => p.getAttribute('stroke') === '#0A0200',
    )
    expect(eyelids.length).toBeGreaterThan(0)
  })
})

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('AvatarFigure — deterministic variants', () => {
  // Extract a stable fingerprint: solid hex fills only (exclude url(#...) references
  // and rgba() values that don't differ between renders, and skip animation attrs)
  function hexFingerprint(container: HTMLElement): string {
    return Array.from(container.querySelectorAll('[fill]'))
      .map(el => el.getAttribute('fill'))
      .filter((f): f is string => !!f && f.startsWith('#'))
      .join('|')
  }

  it('same ID always produces the same hex colour pattern', () => {
    const node = makeNode({ id: 'stable-id-abc123', avatarUrl: null })

    const { container: a } = render(<AvatarFigure node={{ ...node }} />)
    const fpA = hexFingerprint(a)  // capture BEFORE cleanup removes DOM
    cleanup()

    const { container: b } = render(<AvatarFigure node={{ ...node }} />)
    const fpB = hexFingerprint(b)

    expect(fpA).toBe(fpB)
    expect(fpA.length).toBeGreaterThan(0)
  })

  it('different IDs produce different hex colour patterns', () => {
    const nodeA = makeNode({ id: 'person-aaaaaaa', avatarUrl: null })
    const nodeB = makeNode({ id: 'person-zzzzzzz', avatarUrl: null })

    const { container: ca } = render(<AvatarFigure node={nodeA} />)
    const fpA = hexFingerprint(ca)
    cleanup()

    const { container: cb } = render(<AvatarFigure node={nodeB} />)
    const fpB = hexFingerprint(cb)

    expect(fpA).not.toBe(fpB)
  })
})

// ─── Deceased styling ─────────────────────────────────────────────────────────

describe('AvatarFigure — deceased', () => {
  it('applies desaturate filter (feColorMatrix saturate=0.1) when isDeceased', () => {
    const { container } = render(
      <AvatarFigure node={makeNode({ isDeceased: true })} />,
    )
    const cm = container.querySelector('feColorMatrix[type="saturate"]')
    expect(cm).not.toBeNull()
    expect(cm!.getAttribute('values')).toBe('0.1')
  })

  it('does not apply desaturate filter when not deceased', () => {
    const { container } = render(
      <AvatarFigure node={makeNode({ isDeceased: false })} />,
    )
    expect(container.querySelector('feColorMatrix[type="saturate"]')).toBeNull()
  })
})

// ─── Interaction ──────────────────────────────────────────────────────────────

describe('AvatarFigure — interaction', () => {
  it('calls onClick when non-focal avatar is clicked', () => {
    const onClick = vi.fn()
    const { container } = render(
      <AvatarFigure node={makeNode({ isFocal: false })} onClick={onClick} />,
    )
    fireEvent.click(container.firstElementChild!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick for focal avatars', () => {
    const onClick = vi.fn()
    const { container } = render(
      <AvatarFigure node={makeNode({ isFocal: true })} onClick={onClick} />,
    )
    fireEvent.click(container.firstElementChild!)
    expect(onClick).not.toHaveBeenCalled()
  })
})
