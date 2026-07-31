import { describe, it, expect, vi } from 'vitest'
import { resolveMemberForEdit } from '@/lib/resolveMemberForEdit'
import type { FamilyMember } from '@/lib/types'
import type { ExtendedEntry } from '@/components/tree/FamilyTreeGraph'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeDirectMember(id: string): FamilyMember {
  return {
    id,
    added_by: 'user-root',
    first_name: 'Test',
    relation_type: 'brother',
    relation_kind: 'blood',
    invitation_sent: false,
    created_at: '2024-01-01',
  }
}

function makeExtendedEntry(memberId: string): ExtendedEntry {
  return {
    member: makeDirectMember(memberId),
    parentMemberId: 'root',
  }
}

// ─── resolveMemberForEdit (same function used in tree/page.tsx) ───────────────

describe('resolveMemberForEdit', () => {
  it('finds a direct member by id', () => {
    const members = [makeDirectMember('m-1'), makeDirectMember('m-2')]
    const result = resolveMemberForEdit('m-1', members, [])
    expect(result).toBeDefined()
    expect(result!.id).toBe('m-1')
  })

  it('finds an extended member when not in direct members', () => {
    const extended = [makeExtendedEntry('ext-99')]
    const result = resolveMemberForEdit('ext-99', [], extended)
    expect(result).toBeDefined()
    expect(result!.id).toBe('ext-99')
  })

  it('prefers direct member over extended when both exist with the same id', () => {
    const direct   = [makeDirectMember('shared-id')]
    const extended = [makeExtendedEntry('shared-id')]
    const result = resolveMemberForEdit('shared-id', direct, extended)
    expect(result).toBe(direct[0])
  })

  it('returns undefined when id is not found in either list', () => {
    const members  = [makeDirectMember('m-1')]
    const extended = [makeExtendedEntry('ext-1')]
    const result = resolveMemberForEdit('ghost-id', members, extended)
    expect(result).toBeUndefined()
  })

  it('undefined result → toast.error fires, openEdit does not', () => {
    const openEdit   = vi.fn()
    const toastError = vi.fn()

    const member = resolveMemberForEdit('ghost-id', [], [])

    if (member) {
      openEdit(member)
    } else {
      toastError('No pudimos abrir este familiar para editarlo')
    }

    expect(openEdit).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('No pudimos abrir este familiar para editarlo')
  })

  it('found result → openEdit fires, toastError does not', () => {
    const openEdit   = vi.fn()
    const toastError = vi.fn()

    const members = [makeDirectMember('m-found')]
    const member = resolveMemberForEdit('m-found', members, [])

    if (member) {
      openEdit(member)
    } else {
      toastError('No pudimos abrir este familiar para editarlo')
    }

    expect(openEdit).toHaveBeenCalledWith(members[0])
    expect(toastError).not.toHaveBeenCalled()
  })
})
