import type {
  KinshipDefinition,
  KinshipKey,
} from "./types";

export const KINSHIP_CATALOG: Record<
  KinshipKey,
  KinshipDefinition
> = {
  mother: {
    key: "mother",
    label: "Madre",
    plan: {
      kind: "direct",
      primitive: "parent",
      orientation: "new-to-reference",
      parentKind: "biological",
    },
  },

  father: {
    key: "father",
    label: "Padre",
    plan: {
      kind: "direct",
      primitive: "parent",
      orientation: "new-to-reference",
      parentKind: "biological",
    },
  },

  parent: {
    key: "parent",
    label: "Padre o madre",
    plan: {
      kind: "direct",
      primitive: "parent",
      orientation: "new-to-reference",
      parentKind: "unknown",
    },
  },

  daughter: {
    key: "daughter",
    label: "Hija",
    plan: {
      kind: "direct",
      primitive: "parent",
      orientation: "reference-to-new",
      parentKind: "biological",
    },
  },

  son: {
    key: "son",
    label: "Hijo",
    plan: {
      kind: "direct",
      primitive: "parent",
      orientation: "reference-to-new",
      parentKind: "biological",
    },
  },

  child: {
    key: "child",
    label: "Hijo o hija",
    plan: {
      kind: "direct",
      primitive: "parent",
      orientation: "reference-to-new",
      parentKind: "unknown",
    },
  },

  sister: {
    key: "sister",
    label: "Hermana",
    plan: {
      kind: "derived",
      operation: "share-parents",
      requiresSelection: true,
    },
  },

  brother: {
    key: "brother",
    label: "Hermano",
    plan: {
      kind: "derived",
      operation: "share-parents",
      requiresSelection: true,
    },
  },

  sibling: {
    key: "sibling",
    label: "Hermano o hermana",
    plan: {
      kind: "derived",
      operation: "share-parents",
      requiresSelection: true,
    },
  },

  half_sister: {
    key: "half_sister",
    label: "Media hermana",
    plan: {
      kind: "derived",
      operation: "share-one-parent",
      requiresSelection: true,
    },
  },

  half_brother: {
    key: "half_brother",
    label: "Medio hermano",
    plan: {
      kind: "derived",
      operation: "share-one-parent",
      requiresSelection: true,
    },
  },

  half_sibling: {
    key: "half_sibling",
    label: "Medio hermano o hermana",
    plan: {
      kind: "derived",
      operation: "share-one-parent",
      requiresSelection: true,
    },
  },

  spouse: {
    key: "spouse",
    label: "Esposo o esposa",
    plan: {
      kind: "direct",
      primitive: "partner",
      orientation: "new-to-reference",
    },
  },

  partner: {
    key: "partner",
    label: "Pareja",
    plan: {
      kind: "direct",
      primitive: "partner",
      orientation: "new-to-reference",
    },
  },

  grandmother: {
    key: "grandmother",
    label: "Abuela",
    plan: {
      kind: "derived",
      operation: "parent-of-parent",
      requiresSelection: true,
    },
  },

  grandfather: {
    key: "grandfather",
    label: "Abuelo",
    plan: {
      kind: "derived",
      operation: "parent-of-parent",
      requiresSelection: true,
    },
  },

  grandparent: {
    key: "grandparent",
    label: "Abuelo o abuela",
    plan: {
      kind: "derived",
      operation: "parent-of-parent",
      requiresSelection: true,
    },
  },

  granddaughter: {
    key: "granddaughter",
    label: "Nieta",
    plan: {
      kind: "derived",
      operation: "child-of-child",
      requiresSelection: true,
    },
  },

  grandson: {
    key: "grandson",
    label: "Nieto",
    plan: {
      kind: "derived",
      operation: "child-of-child",
      requiresSelection: true,
    },
  },

  grandchild: {
    key: "grandchild",
    label: "Nieto o nieta",
    plan: {
      kind: "derived",
      operation: "child-of-child",
      requiresSelection: true,
    },
  },

  aunt: {
    key: "aunt",
    label: "Tía",
    plan: {
      kind: "derived",
      operation: "sibling-of-parent",
      requiresSelection: true,
    },
  },

  uncle: {
    key: "uncle",
    label: "Tío",
    plan: {
      kind: "derived",
      operation: "sibling-of-parent",
      requiresSelection: true,
    },
  },

  niece: {
    key: "niece",
    label: "Sobrina",
    plan: {
      kind: "derived",
      operation: "child-of-sibling",
      requiresSelection: true,
    },
  },

  nephew: {
    key: "nephew",
    label: "Sobrino",
    plan: {
      kind: "derived",
      operation: "child-of-sibling",
      requiresSelection: true,
    },
  },

  cousin: {
    key: "cousin",
    label: "Primo o prima",
    plan: {
      kind: "derived",
      operation: "child-of-aunt-or-uncle",
      requiresSelection: true,
    },
  },

  mother_in_law: {
    key: "mother_in_law",
    label: "Suegra",
    plan: {
      kind: "derived",
      operation: "parent-of-partner",
      requiresSelection: true,
    },
  },

  father_in_law: {
    key: "father_in_law",
    label: "Suegro",
    plan: {
      kind: "derived",
      operation: "parent-of-partner",
      requiresSelection: true,
    },
  },

  sister_in_law: {
    key: "sister_in_law",
    label: "Cuñada",
    plan: {
      kind: "derived",
      operation: "sibling-of-partner",
      requiresSelection: true,
    },
  },

  brother_in_law: {
    key: "brother_in_law",
    label: "Cuñado",
    plan: {
      kind: "derived",
      operation: "sibling-of-partner",
      requiresSelection: true,
    },
  },

  stepmother: {
    key: "stepmother",
    label: "Madrastra",
    plan: {
      kind: "derived",
      operation: "partner-parent-child",
      requiresSelection: true,
    },
  },

  stepfather: {
    key: "stepfather",
    label: "Padrastro",
    plan: {
      kind: "derived",
      operation: "partner-parent-child",
      requiresSelection: true,
    },
  },

  stepchild: {
    key: "stepchild",
    label: "Hijastro o hijastra",
    plan: {
      kind: "derived",
      operation: "partner-parent-child",
      requiresSelection: true,
    },
  },

  guardian: {
    key: "guardian",
    label: "Tutor o tutora",
    plan: {
      kind: "direct",
      primitive: "guardian",
      orientation: "new-to-reference",
    },
  },

  ward: {
    key: "ward",
    label: "Persona bajo tutela",
    plan: {
      kind: "direct",
      primitive: "guardian",
      orientation: "reference-to-new",
    },
  },
};
