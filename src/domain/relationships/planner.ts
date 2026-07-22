import { KINSHIP_CATALOG } from "./catalog";
import type {
  KinshipKey,
  RelationshipPlan,
} from "./types";

export class UnsupportedKinshipError extends Error {
  constructor(readonly kinshipKey: string) {
    super(`Parentesco no soportado: ${kinshipKey}`);
    this.name = "UnsupportedKinshipError";
  }
}

export function isKinshipKey(
  value: string
): value is KinshipKey {
  return Object.prototype.hasOwnProperty.call(
    KINSHIP_CATALOG,
    value
  );
}

export function planRelationship(
  kinshipKey: string
): RelationshipPlan {
  const normalized = kinshipKey
    .trim()
    .toLowerCase();

  if (!isKinshipKey(normalized)) {
    throw new UnsupportedKinshipError(normalized);
  }

  return KINSHIP_CATALOG[normalized].plan;
}
