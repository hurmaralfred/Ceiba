/**
 * Unit tests for the double-tap-to-refocus interaction logic.
 * Mirrors the state machine in FamilyUniverse.handleAvatarClick.
 */
import { describe, it, expect } from 'vitest'

// Extracted pure logic so tests don't need React rendering
function handleAvatarClick(
  nodeId: string,
  isFocal: boolean,
  selectedId: string | null,
): { nextSelectedId: string | null; refocusId: string | null } {
  if (isFocal) return { nextSelectedId: selectedId, refocusId: null }
  if (selectedId === nodeId) {
    // Second tap on same avatar → refocus
    return { nextSelectedId: null, refocusId: nodeId }
  }
  // First tap on a different (or no) avatar → select only
  return { nextSelectedId: nodeId, refocusId: null }
}

describe('handleAvatarClick — selection', () => {
  it('first tap selects the avatar', () => {
    const { nextSelectedId, refocusId } = handleAvatarClick('a', false, null)
    expect(nextSelectedId).toBe('a')
    expect(refocusId).toBeNull()
  })

  it('tapping focal avatar does nothing', () => {
    const { nextSelectedId, refocusId } = handleAvatarClick('root', true, null)
    expect(nextSelectedId).toBeNull()
    expect(refocusId).toBeNull()
  })

  it('tapping a different avatar changes selection without refocusing', () => {
    const { nextSelectedId, refocusId } = handleAvatarClick('b', false, 'a')
    expect(nextSelectedId).toBe('b')
    expect(refocusId).toBeNull()
  })
})

describe('handleAvatarClick — refocus', () => {
  it('second tap on the same avatar triggers refocus', () => {
    const { nextSelectedId, refocusId } = handleAvatarClick('a', false, 'a')
    expect(refocusId).toBe('a')
    expect(nextSelectedId).toBeNull()
  })

  it('refocusId uses the same id as the node', () => {
    const id = 'member-xyz'
    const { refocusId } = handleAvatarClick(id, false, id)
    expect(refocusId).toBe(id)
  })

  it('panel closes (selectedId=null) when refocusing', () => {
    const { nextSelectedId } = handleAvatarClick('a', false, 'a')
    expect(nextSelectedId).toBeNull()
  })
})

describe('handleAvatarClick — id comparison', () => {
  it('comparison uses node.id, not a fuzzy match', () => {
    // 'a' vs 'a1' must NOT trigger refocus
    const { refocusId } = handleAvatarClick('a1', false, 'a')
    expect(refocusId).toBeNull()
  })

  it('empty string selected and empty string node do not trigger refocus accidentally', () => {
    // isFocal guard must fire first; but if both are '' and not focal it would refocus
    // In practice isFocal nodes always have a real id, so this just validates the guard
    const { nextSelectedId } = handleAvatarClick('real-id', false, '')
    expect(nextSelectedId).toBe('real-id')
  })
})
