# Análisis Washington-Cindy - Relaciones Faltantes

## Problema Confirmado
- Washington es padre de Joselin ✅ (conectado)
- Washington es padre de Cindy ❌ (NO conectado)
- Cindy no necesita tener cuenta para aparecer como hija

## Causa Probable

El adaptador de grafo `resolveRelationsFromRoot()` construye el árbol desde `relationships` table:

```
relationships:
  - person_a_id: Washington_ID
    person_b_id: Joselin_ID  
    relationship_type: "parent"
    deleted_at: null  ✅ VIVO
```

Para Cindy, posibles problemas:

### 1. Relación Invertida (Más Probable)
```
relationships:
  - person_a_id: Cindy_ID
    person_b_id: Washington_ID
    relationship_type: "parent"  ← INVERSA
    deleted_at: null
```

**Problema:** `edgeToRelationType()` interpreta:
- Si viewer = Cindy y edge.person_a_id = Cindy → relación es "daughter"/"son"
- Pero el algoritmo busca desde Washington (root), nunca llega a Cindy

### 2. Relación Eliminada
```
relationships:
  - person_a_id: Washington_ID
    person_b_id: Cindy_ID
    relationship_type: "parent"
    deleted_at: "2026-07-XX"  ← MUERTA
```

**Problema:** `resolveRelationsFromRoot()` filtra `!e.deleted_at`, elimina aristas muertas.

### 3. Relación Faltante
No existe ninguna relación entre Washington y Cindy en la tabla.

## Solución Canónica

### Step 1: Diagnóstico
```bash
curl "https://ceibapp.com/api/relationships/diagnose?parent=washington&child=cindy"
```

Respuestas posibles:
- `status: "healthy"` - ya existe, no hay problema
- `status: "unhealthy"` - problemas detectados con sugerencias

### Step 2: Corrección Automática

**Para relación inversa:**
```bash
DELETE FROM relationships WHERE person_a_id = cindy_id AND person_b_id = washington_id;
INSERT INTO relationships (person_a_id, person_b_id, relationship_type)
VALUES (washington_id, cindy_id, 'parent');
```

**Para relación eliminada:**
```bash
UPDATE relationships 
SET deleted_at = null
WHERE person_a_id = washington_id AND person_b_id = cindy_id;
```

**Para relación faltante:**
```bash
INSERT INTO relationships (person_a_id, person_b_id, relationship_type)
VALUES (washington_id, cindy_id, 'parent');
```

### Step 3: Validación

El árbol debe mostrar:
- Washington conectado con Joselin ✅
- Washington conectado con Cindy ✅
- Cindy muestra a Washington como "Padre" ✅
- No depende de person_claims (Cindy sin cuenta) ✅

## Endpoints Disponibles

1. **GET /api/audit/relationships?name=washington**
   - Lista todas las relaciones de una persona
   - Muestra dirección (incoming/outgoing) y estado

2. **GET /api/relationships/diagnose?parent=washington&child=cindy**
   - Diagnóstico específico padre-hijo
   - Identifica problemas
   - Sugiere correcciones

3. **POST /api/relationships/fix-missing**
   - Body: `{ parentPersonId, childPersonId }`
   - Corrige automáticamente:
     - Elimina inversas
     - Restaura eliminadas
     - Crea faltantes

## Validación

```bash
# Antes de fix
curl "https://ceibapp.com/api/relationships/diagnose?parent=washington&child=cindy"
# Respuesta: status=unhealthy, problems=["..."], suggestions=[...]

# Ejecutar fix (si es necesario)
curl -X POST "https://ceibapp.com/api/relationships/fix-missing" \
  -d '{"parentPersonId":"...", "childPersonId":"..."}'

# Después de fix (recargar árbol en ceibapp.com/tree)
curl "https://ceibapp.com/api/relationships/diagnose?parent=washington&child=cindy"
# Respuesta: status=healthy
```
