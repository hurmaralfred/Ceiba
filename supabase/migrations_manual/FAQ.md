# Ceiba — FAQ técnica

## ⚠️ Errores comunes al ejecutar los SQL

### "type XXX already exists"
No es error: el bloque `DO $$` usa `IF NOT EXISTS`. Si aún ves el mensaje, revisa que estés usando la versión del archivo `01_extensions_enums.sql` que envolvió los `create type` en `DO $$ ... $$`.

### "permission denied to create extension postgis"
Supabase requiere habilitar `postgis` desde el Dashboard → Database → Extensions. La versión SQL falla si el rol no tiene privilegios. Ignora `postgis` si no vas a usar el mapa avanzado; funciona sin él.

### "relation public.profiles does not exist" al correr backfill
Normal: los ejemplos del backfill asumen nombres genéricos. Reemplaza `profiles` por el nombre real de tu tabla.

### "new row violates row-level security policy for table X"
Significa que la RLS está bloqueando la inserción/lectura. Diagnóstico:
1. ¿El usuario tiene su `persons.linked_user_id = auth.uid()`?
2. ¿La persona/relación involucrada está en su red hasta grado 4?
3. Como último recurso, descomenta el bloque **MODO DIAGNÓSTICO** en `07_rls_policies.sql`.

### "SOS en cooldown hasta ..."
Es a propósito. Espera 5 minutos o cancela el SOS activo con `cancel_sos`.

---

## 🤔 Preguntas de producto

### ¿Cómo maneja Ceiba familias mezcladas / segundos matrimonios?
- `partner_of` no exige exclusividad. Se pueden guardar múltiples parejas históricas de la misma persona.
- Para diferenciar "actual" vs "pasado", se puede añadir columna `end_date` a `relationships`.
- Los medios hermanos se guardan como `half_sibling_of`.

### ¿Cómo maneja adopciones?
Con `adoptive_parent_of`. En la UI se muestra con línea con guiones cortos. La persona adoptada puede tener tanto `parent_of` biológico como `adoptive_parent_of` sin conflicto.

### ¿Y si dos usuarios agregan el mismo abuelo con datos ligeramente distintos?
1. El motor de matching detecta la coincidencia.
2. Uno de ellos confirma que es el mismo.
3. Los datos "ganadores" son los del perfil con mayor `verification_level`.
4. La operación queda en `merge_history` para auditar.

### ¿El SOS reemplaza al 911?
No. Es un canal complementario para avisar a la familia. La app debe mostrar textualmente que "SOS de Ceiba avisa a tu familia, no a servicios de emergencia" en la primera vez que se activa.

### ¿Se pueden borrar familiares fallecidos?
No, salvo soft delete por el creador del perfil. La memoria familiar es un valor del producto. El perfil queda con `is_living = false` y `death_date` visible.

### ¿Qué pasa si un usuario se retira?
- Su `auth.users` puede eliminarse.
- Su `persons.linked_user_id` queda NULL.
- El perfil se marca `unclaimed`.
- Sus relaciones y datos siguen visibles para la familia (memoria).
- Alternativa GDPR estricta: anonimizar (nombres a "Familiar", email/foto a NULL) manteniendo la topología.

---

## 🚀 Preguntas técnicas de escala

### ¿Cuánto puede crecer un `get_my_family_graph`?
Con `depth=4`, en una familia latina promedio (mucha extensión) se pueden traer ~500-800 personas. Firestore no aguanta esto sin denormalizar. PostgreSQL lo hace en ~50 ms con los índices puestos.

### ¿Cuándo materializar el grafo?
Si un usuario con > 500 conexiones nota lentitud al abrir su árbol, se materializa una tabla:
```sql
create materialized view mv_user_family (user_id, person_ids) as ...
```
Refrescada por trigger cuando cambian relationships.

### ¿Cómo se comporta Realtime con muchos usuarios?
Supabase Realtime aguanta cómodo miles de suscriptores simultáneos. Para chats familiares (10-30 miembros por sala) es totalmente holgado.

### ¿Cómo enviar push si un usuario tiene múltiples dispositivos?
La tabla `push_tokens` guarda un token por dispositivo. La Edge Function envía a **todos** los tokens del usuario. Un `unique(token)` evita duplicados.

---

## 🔒 Preguntas de seguridad

### ¿Puedo confiar en `SECURITY DEFINER`?
Sí, siempre que:
- La función tenga `set search_path = public` para evitar inyección por schema.
- Devuelva datos ya filtrados por lógica, no exponga toda una tabla.
- El código de la función esté auditado.

En Ceiba, `is_in_my_family` y `get_family_ids_up_to` son `SECURITY DEFINER` porque son helpers de RLS. `get_my_family_graph` también, pero devuelve solo datos del usuario logueado (usa `auth.uid()` internamente).

### ¿Puede alguien leer todos los `sos_alerts` sin ser familiar?
No. La policy `sos_read` valida que exista un vínculo confirmado entre el lector y el emisor dentro del `scope_degree` del SOS.

### ¿Y el service_role?
Puede leer todo (por diseño). Usar solo desde Edge Functions con secretos configurados. Nunca embeber la service_role key en el cliente.

---

## 💡 Preguntas frecuentes del equipo

### ¿Puedo tener la app y la web usando la misma base?
Sí. Todo el diseño está en Postgres + Auth + Realtime. Web y app comparten backend.

### ¿Puedo agregar campos custom a `persons` sin romper nada?
Sí, agrégalos con `alter table ... add column ...`. Las policies RLS no se ven afectadas.

### ¿Cómo pruebo los push sin usar dispositivos reales?
Usa la herramienta FCM Notifications Composer de Firebase Console. Envía un test a un token registrado.

### ¿Los cumpleaños funcionan si nadie está online?
Sí. `pg_cron` corre en el servidor. Envía push directamente a FCM. El cliente ni siquiera necesita estar activo.

### ¿Ceiba puede exportar el árbol de un usuario a GEDCOM?
No incluido en MVP, pero es factible: query recursiva a `relationships` + serializador. Sugerencia para versión posterior.
