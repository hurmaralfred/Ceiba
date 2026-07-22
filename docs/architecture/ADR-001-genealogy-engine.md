# ADR-001 — Genealogy Engine oficial

## Estado

Aceptado.

## Decisión

Ceiba utiliza un grafo genealógico global.

Una persona y un usuario son entidades diferentes.

Las únicas relaciones primitivas almacenadas son:

- parent
- partner
- guardian

Los parentescos como hermano, abuelo, tío, primo,
cuñado o padrastro son derivados y no se almacenan
como valores del enum relationship_type.

Las escrituras genealógicas deben realizarse mediante
servicios de dominio y RPC oficiales.

El modelo oficial de espacios familiares utiliza:

- family_spaces
- space_memberships
- space_user_roles
- family_space_events

El modelo anterior basado en family_trees no debe
utilizarse en código nuevo.
