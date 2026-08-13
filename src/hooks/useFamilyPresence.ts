"use client";
import { useFamilyPresenceContext } from "@/contexts/FamilyPresenceContext";

/**
 * Returns the set of online family user IDs.
 * Presence is now managed globally via FamilyPresenceContext so the
 * Realtime channel stays alive on every page, not just the home page.
 */
export function useFamilyPresence(_myUserId: string | null, _familyUserIds: string[]): Set<string> {
  const { onlineIds } = useFamilyPresenceContext();
  return onlineIds;
}
