/**
 * relations.ts — lógica compartida de relaciones familiares
 *
 * Exporta reverseRelation e inferRelation, usadas en:
 *   - src/app/tree/page.tsx
 *   - src/components/FamilyDiscoveryWizard.tsx
 */
import type { RelationType } from "@/lib/types";

/**
 * reverseRelation(rel)
 *
 * Si la persona P tiene relación R conmigo, yo tengo reverseRelation(R) con P.
 * Ejemplo: P es mi "father" → yo soy "son" de P.
 *
 * Nota: usa el masculino neutro por defecto (son, brother...).
 * El wizard muestra chips de ALT_RELATIONS para que el usuario corrija el género.
 */
export function reverseRelation(rel: string): string {
  switch (rel) {
    case "father":               return "son";
    case "mother":               return "son";
    case "son":                  return "father";
    case "daughter":             return "father";
    case "brother":              return "brother";
    case "sister":               return "brother";
    case "half_brother":         return "brother";
    case "half_sister":          return "brother";
    case "spouse":               return "spouse";
    case "partner":              return "partner";
    case "uncle":                return "nephew";
    case "aunt":                 return "nephew";
    case "nephew":               return "uncle";
    case "niece":                return "uncle";
    case "cousin":               return "cousin";
    case "grandfather_paternal": return "grandson";
    case "grandmother_paternal": return "grandson";
    case "grandfather_maternal": return "grandson";
    case "grandmother_maternal": return "grandson";
    case "grandson":             return "grandfather_paternal";
    case "granddaughter":        return "grandfather_paternal";
    case "father_in_law":        return "son";
    case "mother_in_law":        return "son";
    case "brother_in_law":       return "brother";
    case "sister_in_law":        return "brother";
    case "stepfather":           return "stepchild";
    case "stepmother":           return "stepchild";
    case "stepchild":            return "stepfather";
    default:                     return rel;
  }
}

/**
 * inferRelation(parentRelation, childRelation)
 *
 * Dado que el CONECTOR tiene parentRelation conmigo, y la PERSONA EXTENDIDA
 * tiene childRelation con el CONECTOR, devuelve la relación de la persona extendida
 * conmigo. Devuelve null si no se puede inferir.
 *
 * Ejemplo: mi "father" tiene un "brother" → ese brother es mi "uncle".
 */
export function inferRelation(parentRelation: RelationType | string, childRelation: string): string | null {
  switch (parentRelation) {

    // ── Mi esposo/a o pareja ──────────────────────────────────
    case "spouse": case "partner":
      if (childRelation === "son")        return "son";
      if (childRelation === "daughter")   return "daughter";
      if (childRelation === "stepchild")  return "stepchild";
      if (["brother","half_brother"].includes(childRelation)) return "brother_in_law";
      if (["sister","half_sister"].includes(childRelation))   return "sister_in_law";
      if (childRelation === "father")     return "father_in_law";
      if (childRelation === "mother")     return "mother_in_law";
      if (childRelation === "nephew")     return "nephew";
      if (childRelation === "niece")      return "niece";
      // Familia extendida del cónyuge
      if (childRelation === "grandfather_paternal") return "grandfather_paternal";
      if (childRelation === "grandfather_maternal") return "grandfather_paternal";
      if (childRelation === "grandmother_paternal") return "grandmother_paternal";
      if (childRelation === "grandmother_maternal") return "grandmother_paternal";
      if (childRelation === "uncle")   return "uncle";
      if (childRelation === "aunt")    return "aunt";
      if (childRelation === "cousin")  return "cousin";
      break;

    // ── Mis hermanos ─────────────────────────────────────────
    case "brother": case "sister":
    case "half_brother": case "half_sister":
      if (childRelation === "son")              return "nephew";
      if (childRelation === "daughter")         return "niece";
      if (childRelation === "stepchild")        return "nephew";
      if (childRelation === "nephew")           return "nephew";
      if (childRelation === "niece")            return "niece";
      if (childRelation === "grandson")         return "nephew";
      if (childRelation === "granddaughter")    return "niece";
      if (["spouse","partner"].includes(childRelation)) return "brother_in_law";
      if (["father","stepfather"].includes(childRelation)) return "father";
      if (["mother","stepmother"].includes(childRelation)) return "mother";
      if (["brother","half_brother"].includes(childRelation)) return "brother";
      if (["sister","half_sister"].includes(childRelation))   return "sister";
      if (["uncle","father_in_law"].includes(childRelation)) return "uncle";
      if (["aunt","mother_in_law"].includes(childRelation))  return "aunt";
      if (childRelation === "cousin") return "cousin";
      break;

    // ── Mis cuñados ──────────────────────────────────────────
    case "brother_in_law": case "sister_in_law":
      if (childRelation === "son")       return "nephew";
      if (childRelation === "daughter")  return "niece";
      if (childRelation === "stepchild") return "nephew";
      if (["brother","half_brother"].includes(childRelation)) return "brother_in_law";
      if (["sister","half_sister"].includes(childRelation))   return "sister_in_law";
      if (["spouse","partner"].includes(childRelation))       return "brother_in_law";
      if (childRelation === "father") return "father_in_law";
      if (childRelation === "mother") return "mother_in_law";
      if (childRelation === "nephew") return "nephew";
      if (childRelation === "niece")  return "niece";
      break;

    // ── Mi padre / padrastro ─────────────────────────────────
    case "father": case "stepfather":
      if (childRelation === "son")            return "brother";
      if (childRelation === "daughter")       return "sister";
      if (childRelation === "stepchild")      return "brother";
      if (["brother","half_brother"].includes(childRelation)) return "uncle";
      if (["sister","half_sister"].includes(childRelation))   return "aunt";
      // Los padres de papá = abuelos PATERNOS
      if (childRelation === "father")         return "grandfather_paternal";
      if (childRelation === "mother")         return "grandmother_paternal";
      if (["grandfather_paternal","grandfather_maternal"].includes(childRelation)) return "grandfather_paternal";
      if (["grandmother_paternal","grandmother_maternal"].includes(childRelation)) return "grandmother_paternal";
      if (["spouse","partner"].includes(childRelation))       return "stepmother";
      if (childRelation === "nephew")         return "cousin";
      if (childRelation === "niece")          return "cousin";
      if (childRelation === "cousin")         return "cousin";
      if (childRelation === "uncle")          return "uncle";
      if (childRelation === "aunt")           return "aunt";
      if (childRelation === "grandson")       return "nephew";
      if (childRelation === "granddaughter")  return "niece";
      break;

    // ── Mi madre / madrastra ─────────────────────────────────
    case "mother": case "stepmother":
      if (childRelation === "son")            return "brother";
      if (childRelation === "daughter")       return "sister";
      if (childRelation === "stepchild")      return "brother";
      if (["brother","half_brother"].includes(childRelation)) return "uncle";
      if (["sister","half_sister"].includes(childRelation))   return "aunt";
      // Los padres de mamá = abuelos MATERNOS
      if (childRelation === "father")         return "grandfather_maternal";
      if (childRelation === "mother")         return "grandmother_maternal";
      if (["grandfather_paternal","grandfather_maternal"].includes(childRelation)) return "grandfather_maternal";
      if (["grandmother_paternal","grandmother_maternal"].includes(childRelation)) return "grandmother_maternal";
      if (["spouse","partner"].includes(childRelation))       return "stepfather";
      if (childRelation === "nephew")         return "cousin";
      if (childRelation === "niece")          return "cousin";
      if (childRelation === "cousin")         return "cousin";
      if (childRelation === "uncle")          return "uncle";
      if (childRelation === "aunt")           return "aunt";
      if (childRelation === "grandson")       return "nephew";
      if (childRelation === "granddaughter")  return "niece";
      break;

    // ── Mis suegros ──────────────────────────────────────────
    case "father_in_law": case "mother_in_law":
      if (["brother","half_brother"].includes(childRelation)) return "brother_in_law";
      if (["sister","half_sister"].includes(childRelation))   return "sister_in_law";
      if (childRelation === "son")       return "brother_in_law";
      if (childRelation === "daughter")  return "sister_in_law";
      break;

    // ── Mis primos ───────────────────────────────────────────
    case "cousin":
      if (childRelation === "son" || childRelation === "daughter") return "cousin";
      if (childRelation === "stepchild") return "cousin";
      if (childRelation === "grandson" || childRelation === "granddaughter") return "cousin";
      if (["brother","half_brother","sister","half_sister"].includes(childRelation)) return "cousin";
      if (["spouse","partner"].includes(childRelation)) return "cousin";
      if (childRelation === "father") return "uncle";
      if (childRelation === "mother") return "aunt";
      if (childRelation === "uncle")  return "uncle";
      if (childRelation === "aunt")   return "aunt";
      if (childRelation === "nephew" || childRelation === "niece") return "cousin";
      break;

    // ── Mis hijos ────────────────────────────────────────────
    case "son": case "daughter": case "stepchild":
      if (childRelation === "son")            return "grandson";
      if (childRelation === "daughter")       return "granddaughter";
      if (childRelation === "stepchild")      return "grandson";
      if (childRelation === "grandson")       return "grandson";
      if (childRelation === "granddaughter")  return "granddaughter";
      if (["spouse","partner"].includes(childRelation)) return "son"; // hijo/a político/a
      break;

    // ── Mis nietos ───────────────────────────────────────────
    case "grandson": case "granddaughter":
      if (childRelation === "son")            return "grandson";
      if (childRelation === "daughter")       return "granddaughter";
      if (["spouse","partner"].includes(childRelation)) return "grandson";
      break;

    // ── Mis tíos ─────────────────────────────────────────────
    case "uncle": case "aunt":
      if (childRelation === "son" || childRelation === "daughter") return "cousin";
      if (childRelation === "stepchild")    return "cousin";
      if (childRelation === "grandson" || childRelation === "granddaughter") return "cousin";
      if (childRelation === "nephew" || childRelation === "niece") return "cousin";
      if (childRelation === "cousin")       return "cousin";
      if (["brother","half_brother"].includes(childRelation)) return "uncle";
      if (["sister","half_sister"].includes(childRelation))   return "aunt";
      if (["spouse","partner"].includes(childRelation)) return parentRelation === "uncle" ? "aunt" : "uncle";
      if (childRelation === "father") return "grandfather_paternal";
      if (childRelation === "mother") return "grandmother_paternal";
      if (["grandfather_paternal","grandfather_maternal"].includes(childRelation)) return "grandfather_paternal";
      if (["grandmother_paternal","grandmother_maternal"].includes(childRelation)) return "grandmother_paternal";
      break;

    // ── Mis abuelos ──────────────────────────────────────────
    case "grandfather_paternal": case "grandfather_maternal":
    case "grandmother_paternal": case "grandmother_maternal":
      if (childRelation === "son")            return "uncle";
      if (childRelation === "daughter")       return "aunt";
      if (childRelation === "stepchild")      return "uncle";
      if (childRelation === "grandson")       return "uncle";
      if (childRelation === "granddaughter")  return "aunt";
      if (childRelation === "nephew" || childRelation === "niece") return "cousin";
      if (childRelation === "cousin")         return "uncle";
      if (["brother","half_brother"].includes(childRelation)) return "uncle";
      if (["sister","half_sister"].includes(childRelation))   return "aunt";
      if (childRelation === "father")         return "grandfather_paternal";
      if (childRelation === "mother")         return "grandmother_paternal";
      if (["grandfather_paternal","grandfather_maternal"].includes(childRelation)) return "grandfather_paternal";
      if (["grandmother_paternal","grandmother_maternal"].includes(childRelation)) return "grandmother_paternal";
      break;

    // ── Mis sobrinos ─────────────────────────────────────────
    case "nephew": case "niece":
      if (childRelation === "son")            return "nephew";
      if (childRelation === "daughter")       return "niece";
      if (childRelation === "stepchild")      return "nephew";
      if (childRelation === "grandson")       return "nephew";
      if (childRelation === "granddaughter")  return "niece";
      if (["spouse","partner"].includes(childRelation)) return "nephew";
      if (["father","stepfather"].includes(childRelation)) return "brother";
      if (["mother","stepmother"].includes(childRelation)) return "sister";
      if (childRelation === "uncle")          return "brother";
      if (childRelation === "aunt")           return "sister";
      if (["brother","half_brother"].includes(childRelation)) return "nephew";
      if (["sister","half_sister"].includes(childRelation))   return "niece";
      if (childRelation === "cousin")         return "cousin";
      break;
  }
  return null;
}
