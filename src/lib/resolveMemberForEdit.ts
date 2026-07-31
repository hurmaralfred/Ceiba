import type { FamilyMember } from '@/lib/types'
import type { ExtendedEntry } from '@/components/tree/FamilyTreeGraph'

/**
 * Resolves a FamilyMember by id, checking direct members first then extended.
 * Returns undefined when the id is not found in either list.
 */
export function resolveMemberForEdit(
  memberId: string,
  members: FamilyMember[],
  extendedMembers: ExtendedEntry[],
): FamilyMember | undefined {
  return (
    members.find((m) => m.id === memberId) ??
    extendedMembers.find((e) => e.member.id === memberId)?.member
  )
}
