# Genealogy Engine — Fases y diseño

Principio invariable: la base de datos solo persiste relaciones **canónicas**
`parent | partner | guardian`. Todo parentesco derivado se **infiere**
recorriendo el grafo en el cliente (`adaptGraph` + `inferRelation`). Nunca se
agregan `uncle`, `cousin`, `in_law`, etc. a `relationships.relationship_type`.

## Estado actual (implementado)

- **Directos:** father/mother, son/daughter, spouse/partner (1 salto).
- **Consanguíneos:** brother/sister, grand*/great-grand*, uncle/aunt,
  nephew/niece, cousin.
- **Políticos:** father/mother_in_law, brother/sister_in_law,
  **son_in_law/daughter_in_law** (yerno/nuera = pareja de un hijo/a),
  stepfather/stepmother, **stepson/stepdaughter** (hijo/a de la pareja que el
  BFS no alcanzó antes por una arista `parent` propia → no es hijo del usuario).
- **Género:** `applyGenderToRelation` fija la etiqueta con el `gender` REAL de
  la persona. Regla: `unknown/neutral` **no** se convierte en masculino; se
  respeta la relación inferida.

### Pendiente conocido (fase posterior, no bloqueante)
- **Bug de género femenino→masculino** en algunos nodos: aún se instrumenta el
  origen exacto (logs `[adaptGraph:before/after]`, `[tree-label]`). El motor de
  parentescos ya es correcto; el fix es de propagación del `gender`.

## Fase A — `union_type` (married, partner, engaged, …)

Objetivo: distinguir el **tipo de unión** (matrimonio, unión libre, noviazgo)
**sin** cambiar la relación canónica `partner`.

Diseño propuesto (sin tocar el enum canónico):
- El tipo de unión viaja como **metadato** de la arista `partner`
  (`relationships.metadata->>'union_type'` o columna opcional), no como un nuevo
  valor de `relationship_type`.
- `EdgeNode` gana `union_type?: 'married' | 'partner' | 'engaged' | ...`.
- La ETIQUETA sigue derivándose igual (spouse/partner); `union_type` solo afina
  el texto visible ("Esposo/a" vs "Pareja") y no altera la inferencia de
  suegros/cuñados/yernos, que dependen únicamente de que exista `partner`.
- Migración: aditiva y reversible; el default preserva el comportamiento actual.

## Fase B — Inferencia asistida del segundo progenitor

Cuando un hijo tiene **una sola** arista `parent` pero existe una **unión**
(`partner`) del progenitor conocido, y los **apellidos** lo sugieren, proponer
(no crear automáticamente) al segundo progenitor:

- Señal 1: el progenitor conocido tiene `partner` P.
- Señal 2: el `first_surname`/`second_surname` del hijo coincide con el patrón
  esperado de P (apellido paterno/materno latino).
- Acción: **sugerencia** al usuario ("¿P también es progenitor de este hijo?"),
  nunca una arista silenciosa. Solo al confirmar se inserta la segunda
  `parent`. Esto habilita la doble filiación (Fase C) con datos reales.

## Fase C — Doble filiación visible

Cada hijo debe conectarse visualmente a **ambos** padres cuando existan las dos
aristas `parent`. Requisitos de diseño del motor (para no romper el BFS actual):

- El BFS de `adaptGraph` toma el **camino más corto** por persona (una etiqueta
  por nodo). Para doble filiación, el **layout** debe poder dibujar **dos
  aristas `parent`** hacia un mismo hijo aunque la etiqueta se derive por un
  solo camino.
- Las aristas se construyen desde los **vínculos reales** (`memberLinks` / las
  dos `parent` del payload), no desde el árbol de inferencia. Así un hijo con
  padre y madre confirmados muestra ambas líneas verticales.
- Riesgo a vigilar: endogamia / multi-camino (una persona alcanzable por dos
  ramas). La etiqueta se mantiene única; el dibujo usa IDs reales.

## Notas de payload

`get_my_family_graph(p_depth)` recorre `relationships` en todas direcciones. A
`p_depth = 4` (valor usado por el cliente) el payload incluye hasta primos
(4 saltos) y bisabuelos/bisnietos (3), suficiente para todas las inferencias
anteriores sin modificar la RPC.
