export type PrimitiveRelationship =
  | "parent"
  | "partner"
  | "guardian";

export type ParentKind =
  | "biological"
  | "adoptive"
  | "unknown";

export type KinshipKey =
  | "mother"
  | "father"
  | "parent"
  | "daughter"
  | "son"
  | "child"
  | "sister"
  | "brother"
  | "sibling"
  | "half_sister"
  | "half_brother"
  | "half_sibling"
  | "spouse"
  | "partner"
  | "grandmother"
  | "grandfather"
  | "grandparent"
  | "granddaughter"
  | "grandson"
  | "grandchild"
  | "aunt"
  | "uncle"
  | "niece"
  | "nephew"
  | "cousin"
  | "mother_in_law"
  | "father_in_law"
  | "sister_in_law"
  | "brother_in_law"
  | "stepmother"
  | "stepfather"
  | "stepchild"
  | "guardian"
  | "ward";

export type RelationshipPlan =
  | {
      kind: "direct";
      primitive: PrimitiveRelationship;
      orientation: "new-to-reference" | "reference-to-new";
      parentKind?: ParentKind;
    }
  | {
      kind: "derived";
      operation:
        | "share-parents"
        | "share-one-parent"
        | "parent-of-parent"
        | "child-of-child"
        | "sibling-of-parent"
        | "child-of-sibling"
        | "child-of-aunt-or-uncle"
        | "parent-of-partner"
        | "sibling-of-partner"
        | "partner-of-sibling"
        | "partner-parent-child";
      requiresSelection: boolean;
    };

export interface KinshipDefinition {
  key: KinshipKey;
  label: string;
  plan: RelationshipPlan;
}
