# Ceiba — Guía de Ejecución de Migración
### Adaptada al esquema real de Ceiba (profiles + family_members)

Ejecuta cada archivo en **Supabase Dashboard → SQL Editor**.
Copia el contenido del archivo, pégalo, y corre. Guarda los resultados.

---

## Paso 0 — Backup obligatorio

Ve a **Supabase Dashboard → Database → Backups → Create backup manual**.

No continúes sin hacer el backup.

---

## Paso 1 — Auditoría del estado actual

Ejecuta: `00_audit.sql`

Guarda los resultados. Te dice cuántas filas hay en cada tabla y la estructura actual.

---

## Paso 2 — Pre-migración: renombrar tablas conflictivas

⚠️ Este paso es crítico. La nueva migración crea una tabla `relationships` con
estructura diferente a la que ya tienes. Hay que renombrarla primero.

Ejecuta: `00b_pre_migration.sql`

Resultado esperado: verás `relationships_legacy` y `photo_tags_legacy` en la lista.

---

## Paso 3 — Extensiones y enums

Ejecuta: `01_extensions_enums.sql`

Habilita `pgcrypto`, `unaccent`, `pg_trgm`, `citext` y crea los enums del sistema.

---

## Paso 4 — Tablas núcleo del grafo familiar

Ejecuta: `02_core_tables.sql`

Crea las tablas nuevas: `persons`, `relationships`, `match_candidates`,
`claim_requests`, `merge_history`, `audit_logs`.

Se crean **vacías** — no toca nada de lo que ya tienes.

---

## Paso 5 — Tablas sociales

Ejecuta: `03_social_tables.sql`

Crea: `person_locations`, `broadcasts`, `sos_alerts`, `chat_rooms`,
`chat_messages`, `family_events`, `photos`, `photo_tags` (nueva versión), etc.

---

## Paso 6 — Triggers de integridad

Ejecuta: `04_triggers.sql`

Instala reglas que previenen ciclos padre/hijo, fechas incoherentes y duplicados.

---

## Paso 7 — Backfill de datos existentes

⚠️ Este es el paso más importante: migra todos tus datos actuales a la nueva estructura.

### Primero: prueba con LIMIT

Antes de ejecutar el backfill completo, abre `05_backfill_ceiba.sql` y agrega
`LIMIT 5` al final de cada INSERT para verificar que los datos se ven bien.

### Luego: ejecuta completo

Ejecuta: `05_backfill_ceiba.sql`

Lo que hace:
- **Bloque A**: copia `profiles` → `persons` (usuarios registrados)
- **Bloque B**: copia personas no registradas de `family_members` → `persons`
- **Bloque C**: copia relaciones BASE de `family_members` → `relationships`
  (padre, madre, hijo/a, hermano/a, pareja — omite abuelos/tíos/primos que son derivados)
- **Bloque D**: copia relaciones confirmadas de `relationships_legacy` → `relationships`

Al final muestra:
- Cuántos usuarios quedaron sin persona (debe ser 0)
- Distribución de tipos de relación migrados
- Muestra de personas creadas

---

## Paso 8 — Funciones RPC

Ejecuta: `06_rpc_functions.sql`

Instala las funciones que tu app llama desde el cliente:
`add_relative`, `find_person_matches`, `get_my_family_graph`,
`trigger_sos`, `upcoming_birthdays`, `confirm_match`, `reject_match`.

Luego ejecuta: `06b_helper_functions.sql`

Instala funciones auxiliares para las Edge Functions:
`get_family_ids_up_to`, `_admin_birthdays_for_person`.

**Prueba rápida** (ejecuta en SQL Editor):
```sql
select public.get_my_family_graph(3);
```
Debe devolver JSON con `me`, `nodes`, `edges`.

---

## Paso 9 — Row Level Security

Ejecuta: `07_rls_policies.sql`

⚠️ Si algo deja de cargar en la app tras activar RLS, descomenta el bloque
`-- MODO DIAGNÓSTICO` al final del archivo y vuelve a ejecutar para relajar
temporalmente las policies mientras depuras.

---

## Paso 10 — Realtime

Ejecuta: `08_realtime.sql`

Activa Realtime en `chat_messages`, `sos_alerts`, `broadcasts` y `relationships`.

---

## Paso 11 — Cron jobs (cumpleaños + limpieza SOS)

Abre `09_cron_jobs.sql` y reemplaza:
- `<tu-project-ref>` → tu referencia (la ves en la URL de Supabase)
- `<tu-service-role-key>` → Settings → API → service_role key

Luego ejecuta el archivo.

---

## Paso 12 — Edge Functions

Desde tu terminal (en la raíz del proyecto Ceiba):

```bash
supabase login
supabase link --project-ref <tu-project-ref>

supabase functions deploy cron-birthdays-daily --no-verify-jwt
supabase functions deploy sos-dispatcher       --no-verify-jwt
supabase functions deploy chat-room-materializer --no-verify-jwt

supabase secrets set FCM_SERVER_KEY="tu-clave-de-firebase"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="tu-service-role"
```

---

## Paso 13 — Webhook para SOS

En Supabase Dashboard → **Database → Webhooks → Create webhook**:
- Table: `sos_alerts`
- Events: INSERT
- Type: HTTP Request
- URL: `https://<tu-project-ref>.functions.supabase.co/sos-dispatcher`
- Headers: `Authorization: Bearer <service-role>`

---

## Paso 14 — Validación

Ejecuta las pruebas de `PRUEBAS.md`.

Checklist mínimo:
- [ ] `SELECT COUNT(*) FROM persons WHERE linked_user_id IS NOT NULL` → mismo número que `SELECT COUNT(*) FROM profiles`
- [ ] `SELECT COUNT(*) FROM relationships WHERE status = 'confirmed'` → mayor que 0
- [ ] `SELECT * FROM get_my_family_graph(3)` devuelve datos
- [ ] La app carga y muestra el árbol
- [ ] Al agregar un familiar que ya existe, aparece el modal de coincidencia
- [ ] El SOS se puede activar

---

## Si algo sale mal

Ejecuta `99_rollback.sql` (descomenta el bloque de DROP de tablas al final si necesitas limpiar completamente).

Las tablas `relationships_legacy` y `photo_tags_legacy` NO se tocan en el rollback — tus datos originales están seguros ahí.

---

## Orden de ejecución (resumen)

```
00_audit.sql               ← revisar estado actual
00b_pre_migration.sql      ← renombrar conflictos
01_extensions_enums.sql    ← extensiones y tipos
02_core_tables.sql         ← tablas del grafo
03_social_tables.sql       ← tablas sociales
04_triggers.sql            ← integridad
05_backfill_ceiba.sql      ← migrar datos
06_rpc_functions.sql       ← funciones RPC
06b_helper_functions.sql   ← helpers para Edge Functions
07_rls_policies.sql        ← seguridad
08_realtime.sql            ← realtime
09_cron_jobs.sql           ← cron (requiere edición manual)
```
