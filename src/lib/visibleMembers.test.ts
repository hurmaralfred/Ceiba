import { describe, it, expect } from "vitest";
import { buildVisibleMembers } from "./visibleMembers";
import type { FamilyMember } from "./types";
import type { ExtendedEntry } from "@/components/tree/FamilyTreeGraph";

const makeMember = (id: string, name: string): FamilyMember => ({
  id,
  first_name: name,
  last_name: "Test",
  profile_id: `user_${id}`,
  relation_type: "brother",
  relation_kind: "blood",
  invitation_sent: false,
  created_at: new Date().toISOString(),
  added_by: "user_parent",
});

const makeExtendedEntry = (id: string, name: string, parentId: string): ExtendedEntry => ({
  member: makeMember(id, name),
  parentMemberId: parentId,
  inferredRelation: "cousin",
});

describe("buildVisibleMembers", () => {
  it("unifies members and extendedMembers without duplicates", () => {
    const members = [
      makeMember("m1", "Alice"),
      makeMember("m2", "Bob"),
    ];
    const extendedMembers = [
      makeExtendedEntry("m3", "Charlie", "m1"),
      makeExtendedEntry("m4", "Diana", "m2"),
    ];

    const result = buildVisibleMembers(members, extendedMembers);

    expect(result).toHaveLength(4);
    expect(result.map(m => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("deduplicates when same person appears in both lists", () => {
    const member1 = makeMember("m1", "Alice");
    const members = [member1, makeMember("m2", "Bob")];
    const extendedMembers = [
      makeExtendedEntry("m1", "Alice", "m0"), // Same id as member1
      makeExtendedEntry("m3", "Charlie", "m1"),
    ];

    const result = buildVisibleMembers(members, extendedMembers);

    expect(result).toHaveLength(3);
    const ids = result.map(m => m.id);
    expect(ids).toEqual(["m1", "m2", "m3"]);
    // Verify that the result contains exactly one m1
    expect(ids.filter(id => id === "m1")).toHaveLength(1);
  });

  it("handles empty members list", () => {
    const extendedMembers = [
      makeExtendedEntry("m1", "Alice", "m0"),
      makeExtendedEntry("m2", "Bob", "m0"),
    ];

    const result = buildVisibleMembers([], extendedMembers);

    expect(result).toHaveLength(2);
    expect(result.map(m => m.id)).toEqual(["m1", "m2"]);
  });

  it("handles empty extendedMembers list", () => {
    const members = [
      makeMember("m1", "Alice"),
      makeMember("m2", "Bob"),
    ];

    const result = buildVisibleMembers(members, []);

    expect(result).toHaveLength(2);
    expect(result.map(m => m.id)).toEqual(["m1", "m2"]);
  });

  it("handles both lists empty", () => {
    const result = buildVisibleMembers([], []);

    expect(result).toHaveLength(0);
  });

  it("ignores members with null/missing id", () => {
    const members = [
      makeMember("m1", "Alice"),
      { ...makeMember("m2", "Bob"), id: undefined as any },
    ];
    const extendedMembers = [
      makeExtendedEntry("m3", "Charlie", "m1"),
    ];

    const result = buildVisibleMembers(members, extendedMembers);

    // Should have m1, m3 (m2 is skipped due to missing id)
    expect(result).toHaveLength(2);
    expect(result.map(m => m.id).sort()).toEqual(["m1", "m3"]);
  });

  it("ignores extended members with null/missing id", () => {
    const members = [
      makeMember("m1", "Alice"),
    ];
    const extendedMembers = [
      makeExtendedEntry("m2", "Bob", "m1"),
      { member: { ...makeMember("m3", "Charlie"), id: undefined as any }, parentMemberId: "m1" },
    ];

    const result = buildVisibleMembers(members, extendedMembers);

    // Should have m1, m2 (m3 is skipped due to missing id)
    expect(result).toHaveLength(2);
    expect(result.map(m => m.id).sort()).toEqual(["m1", "m2"]);
  });

  it("preserves member attributes when deduplicating", () => {
    const member1 = { ...makeMember("m1", "Alice"), profile_id: "user_alice" };
    const members = [member1];
    const extendedMembers = [
      makeExtendedEntry("m1", "Alice", "m0"),
    ];

    const result = buildVisibleMembers(members, extendedMembers);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(member1);
    expect(result[0].profile_id).toBe("user_alice");
  });

  it("returns members from extended when not in primary members", () => {
    const members = [makeMember("m1", "Alice")];
    const extendedMembers = [
      makeExtendedEntry("m2", "Bob", "m1"),
    ];

    const result = buildVisibleMembers(members, extendedMembers);

    expect(result).toHaveLength(2);
    const bob = result.find(m => m.id === "m2");
    expect(bob).toBeDefined();
    expect(bob?.first_name).toBe("Bob");
  });
});
