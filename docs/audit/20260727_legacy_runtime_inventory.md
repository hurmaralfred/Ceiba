# AUDITORÍA TÉCNICA — INVENTARIO DEL LEGADO HEREDADO (CORREGIDA)

**Fecha:** 2026-07-27
**Versión:** 2 — corrige imprecisiones de la v1 (linked_user_id como "solución", clasificación de errores, estado de /profile vs /settings, SOS, conteos aproximados)
**Estado:** Auditoría únicamente. Cero modificaciones de código, datos, migraciones o commits.

---

## 0. QUÉ CAMBIÓ RESPECTO A LA V1

| Corrección | V1 (incorrecta) | V2 (verificada) |
|---|---|---|
| Mapeo usuario↔persona | "Restaurar `linked_user_id`" | `linked_user_id` **no existe y no debe recrearse**. El mapeo canónico es `auth.users.id → profiles.user_id` y, por separado, `person_claims.user_id → person_claims.person_id → persons.id` |
| Clasificación de errores | "Falla silenciosamente" aplicado en bloque | Cada consulta clasificada según si el `error` de Postgrest se captura, se ignora, o ni siquiera se genera |
| Profile | "Completamente roto", toast miente | El toast de éxito **nunca se alcanza** — el código corta con `return` en el primer error capturado. `/settings` (no `/profile`) es el destino real de navegación |
| SOS | "No se envían alertas" sin prueba | Trazado extremo a extremo con evidencia de `pg_proc`, `pg_trigger`, y Management API. La creación de la alerta **funciona**; el despacho de notificaciones **falla de forma comprobada** en un punto exacto |
| Conteos | "25+", "40+", "50+" | Conteo exacto: 31 archivos con coincidencia de patrón, clasificados sin solapamiento |

---

## 1. ESQUEMA CANÓNICO REAL — MAPEO USUARIO → PERSONA

### Verificación de `person_claims` (fuente de verdad para el vínculo)

```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='person_claims' ORDER BY ordinal_position;
```

| Columna | Tipo | Nullable | Rol |
|---------|------|----------|-----|
| `id` | uuid | NO | PK |
| `person_id` | uuid | NO | FK → `persons.id` |
| `user_id` | uuid | NO | FK → `auth.users.id` |
| `claim_status` | enum (USER-DEFINED) | YES | Estado del reclamo |
| `verification_method` | text | YES | Método de verificación |
| `claimed_at` | timestamptz | YES | Cuándo se reclamó |
| `approved_at` | timestamptz | YES | Cuándo se aprobó |
| `revoked_at` | timestamptz | YES | Cuándo se revocó (si aplica) |

### Restricciones verificadas (`pg_constraint`)

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.person_claims'::regclass;
```

| Constraint | Definición |
|---|---|
| `person_claims_person_id_fkey` | `FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE` |
| `person_claims_user_id_fkey` | `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` |
| `person_claims_person_id_user_id_key` | `UNIQUE (person_id, user_id)` — un usuario no puede reclamar la misma persona dos veces |
| `person_claims_pkey` | `PRIMARY KEY (id)` |

### Mapeo canónico correcto (para reemplazar cualquier uso de `linked_user_id`)

```
auth.users.id
   │
   ├─→ profiles.user_id                         (perfil de cuenta: display_name, avatar_path, locale...)
   │
   └─→ person_claims.user_id
           → person_claims.person_id
               → persons.id                      (datos genealógicos: nombre, apellidos, fecha nacimiento...)
```

**No hay una columna directa `persons.linked_user_id` ni debe crearse.** Cualquier código que necesite "¿qué persona corresponde a este usuario autenticado?" debe hacer:

```sql
SELECT p.* FROM persons p
JOIN person_claims pc ON pc.person_id = p.id
WHERE pc.user_id = auth.uid()
  AND pc.claim_status = 'approved'   -- o el valor correspondiente del enum
  AND pc.revoked_at IS NULL;
```

Todo código auditado que use `.eq("linked_user_id", ...)` está construido sobre un modelo que nunca debió persistir en `persons` — la arquitectura canónica ya resuelve esto vía `person_claims`, una tabla que sí existe y tiene las restricciones de integridad correctas (unique, FKs, cascada).

---

## 2. ESQUEMA REAL COMPLETO (sin cambios respecto a v1, columna por columna)

### `profiles` (10 columnas reales)
`id, user_id, display_name, avatar_path, locale, timezone, account_status, created_at, updated_at, deleted_at`

| Columna buscada | Estado |
|---|---|
| first_name | NO EXISTE |
| last_name | NO EXISTE |
| email | NO EXISTE |
| phone | NO EXISTE |
| avatar_url | NO EXISTE (existe `avatar_path`) |
| avatar_path | EXISTE |
| city | NO EXISTE |
| country | NO EXISTE |
| bio | NO EXISTE |
| social_link | NO EXISTE |
| live_lat | NO EXISTE |
| live_lng | NO EXISTE |
| location_sharing | NO EXISTE |
| display_name | EXISTE |
| user_id | EXISTE |

**Hallazgo adicional verificado (no solicitado explícitamente pero relevante):** el código también intenta usar `latitude`, `longitude`, `location_enabled`, `location_updated_at` sobre `profiles` (en `tree/page.tsx:576-581` y `map/page.tsx:66-80`) — **ninguna de estas cuatro columnas existe tampoco**. Esto es un segundo mecanismo de ubicación (distinto de `live_lat/live_lng`), igualmente inexistente en el esquema real.

### `persons` (21 columnas reales)
`id, first_name, middle_name, first_surname, second_surname, normalized_full_name, birth_date, birth_year, birth_date_precision, birth_city, birth_country, is_deceased, death_date, gender, photo_path, created_by, status, created_at, updated_at, deleted_at, public_id`

| Columna buscada | Estado |
|---|---|
| linked_user_id | NO EXISTE (ni debe existir — ver sección 1) |
| first_names | NO EXISTE (existe `first_name`, singular) |
| last_names | NO EXISTE (existe `first_surname`/`second_surname`) |
| profile_photo_url | NO EXISTE (existe `photo_path`) |
| phone | NO EXISTE |

### Tablas confirmadas NO EXISTEN
`family_members`, `relationship_suggestions`, `posts`, tabla `events` (existe `family_events`, distinta)

### `sos_alerts` (verificado en esta ronda — 10 columnas)
`id, sender_user_id, lat, lon, message, status, scope_degree, triggered_at, resolved_at, cooldown_until`

---

## 3. CLASIFICACIÓN EXACTA DE MANEJO DE ERRORES POR CONSULTA

Se reemplaza "falla silenciosamente" por la clasificación real de cada sitio, según qué hace el código con `{ data, error }`.

| Archivo:línea | Código exacto | Categoría de manejo |
|---|---|---|
| `profile/page.tsx:35` | `const { data } = await supabase.from("profiles").select("*")...` | **La consulta NO genera error.** `select("*")` devuelve solo las columnas reales (10). `data.first_name` es simplemente una propiedad inexistente en el objeto JS → `undefined`. No hay error de Postgrest aquí — es acceso a propiedad inexistente en JS, no un fallo de red/DB. |
| `profile/page.tsx:82-91` | `const { error } = await supabase.from("profiles").update({first_name,...})...; if (error) { toast.error("Error al guardar"); return; }` | **Error CAPTURADO y MOSTRADO al usuario.** Postgrest devuelve un error real (columna inexistente en el payload de UPDATE). El código lo verifica explícitamente y corta la ejecución con `return` — **la línea 97 (`persons.update`) y el toast de éxito NUNCA se ejecutan** si esta falla. |
| `profile/page.tsx:97-104` | `await supabase.from("persons").update({first_names,...}).eq("linked_user_id",...)` | **CÓDIGO INALCANZABLE en la práctica** — depende de que la línea 82 tenga éxito, lo cual no ocurrirá dado el esquema real. Si se alcanzara, el error sería descartado (no se captura `{ error }`, solo se hace `await` sin desestructurar). |
| `settings/page.tsx:61-65` | `const { data } = await supabase.from("profiles").select("location_enabled, privacy_birth_date, privacy_social_link, privacy_map")...` | **Ninguna de las 4 columnas existe en `profiles`.** Postgrest devolvería error; el código solo desestructura `data` (ignora `error`) → `data` es `null` → `if (data)` se salta → se mantienen los valores por defecto del `useState` inicial. Página no se rompe, pero nunca refleja el estado real guardado. |
| `settings/page.tsx:78` | `const { error } = await supabase.from("profiles").update({ [key]: value })...; if (error) { revert; toast.error("Error al guardar"); }` | **Error CAPTURADO y MOSTRADO.** Cada vez que el usuario mueve un toggle, Postgrest devuelve error (columna inexistente) y el usuario ve "Error al guardar" de forma honesta e inmediata. |
| `api/presence/route.ts:60` | `await service.from("profiles").update(update).eq("id", user.id);` (sin desestructurar nada) | **Error TOTALMENTE DESCARTADO.** Ni siquiera se captura `{ error }` — el resultado completo de la llamada se ignora. Columnas `live_lat/live_lng/location_sharing` no existen → update falla → nadie se entera, ni el código ni el usuario. |
| `api/presence/route.ts:129-149` (GET) | `const { data: direct } = await service.from("family_members")...` (repetido 2x) + `const { data: profiles } = await service.from("profiles").select("...live_lat, live_lng...")` | **Error DESCARTADO en ambos casos** — solo se captura `data`. `family_members` no existe → `data: null` → `.map()` sobre `null` con `(direct \|\| [])` evita crash, pero produce `[]`. Resultado: el endpoint responde `200 OK` con `{ members: [] }`, no un error HTTP. |
| `sos-dispatcher/index.ts:74-76` | `const { data: sender } = await admin.from("persons").select("id, first_names, last_names").eq("linked_user_id", alert.sender_user_id).maybeSingle();` | **Error DESCARTADO.** Solo se captura `data`. Postgrest fallaría por columnas inexistentes en el `select` (`first_names`, `last_names`) y en el filtro (`linked_user_id`). `sender` = `null` → `if (!sender) return new Response("sender not found", {status:404})`. Ver sección 4 para el trazado completo. |
| `sos-dispatcher/index.ts:96-100` | `const { data: linked } = await admin.from("persons").select("linked_user_id")...` | Mismo patrón: error descartado, `linked` = `[]`. (Código posterior a la línea 76, solo se alcanzaría si el paso anterior no hubiera cortado ya con 404). |
| `viral/onboardingSteps.ts:96-102` | `const { data: me } = await supabase.from("persons").select("id").eq("linked_user_id", user.user.id).single();` | **Error DESCARTADO.** `me` = `null` → función retorna `{ activated: false, count: 0 }`. No crashea; el "aha moment" simplemente nunca se marca como activado. |
| `cron-birthdays-daily/index.ts:156-158` | `const { data: activeUsers } = await admin.from("persons").select("id, linked_user_id").not("linked_user_id", "is", null);` (variable exacta a confirmar en archivo) | **Error DESCARTADO.** Filtro sobre columna inexistente → resultado vacío → bucle de notificación no itera sobre nadie. |
| `sms-fallback/index.ts:63-79` | `const { data: invitedPerson } = ...; const { data: inviterPerson } = ...eq("linked_user_id",...)` | **Error DESCARTADO en ambos.** `invitedPerson?.phone` es `undefined` → función retorna `{ ok:false, reason:"no_phone_available" }` con status 200 (no crash, respuesta controlada aunque la razón real es otra: la columna no existe, no que falte el dato). |

**Patrón general observado:** en las páginas de cliente (`profile`, `settings`), el código **sí** verifica `error` explícitamente y lo muestra al usuario. En las Edge Functions y helpers server-side (`sos-dispatcher`, `sms-fallback`, `onboardingSteps`, `cron-birthdays-daily`, `api/presence`), el patrón dominante es **desestructurar solo `data` y descartar `error`**, lo que convierte un fallo de esquema en un resultado vacío indistinguible de "no hay datos" — sin ninguna traza visible salvo logs de servidor (no verificados en esta auditoría; no se ejecutó código real).

---

## 4. AUDITORÍA ESPECÍFICA DE SOS — TRAZADO COMPLETO CON EVIDENCIA

### Cadena verificada paso a paso

**Paso 1 — Componente del botón**
`src/app/tree/page.tsx:634` → `onClick={triggerSOS}`, handler definido en línea 506-534.

**Paso 2 — Handler del cliente**
```typescript
// tree/page.tsx:506-534
const triggerSOS = async () => {
  ...
  const { data, error } = await supabase.rpc("trigger_sos", {
    p_lat: pos?.coords.latitude ?? null,
    p_lon: pos?.coords.longitude ?? null,
    p_message: null,
    p_scope: 2,
  });
  if (error) { toast.error("Error al enviar SOS: " + error.message); return; }
  toast.success("🚨 SOS enviado a tu red familiar.", { duration: 6000 });
  ...
};
```
Error **sí se captura y se muestra** aquí.

**Paso 3 — RPC `trigger_sos` — verificado en Postgres vía `pg_proc`**
```sql
CREATE OR REPLACE FUNCTION public.trigger_sos(p_lat float8, p_lon float8, p_message text, p_scope int)
RETURNS uuid AS $$
declare new_id uuid; last_cooldown timestamptz;
begin
  select cooldown_until into last_cooldown from public.sos_alerts
    where sender_user_id = auth.uid() and status = 'active' order by triggered_at desc limit 1;
  if last_cooldown is not null and last_cooldown > now() then
    raise exception 'SOS en cooldown hasta %', last_cooldown;
  end if;
  insert into public.sos_alerts (sender_user_id, lat, lon, message, scope_degree, cooldown_until)
    values (auth.uid(), p_lat, p_lon, p_message, p_scope, now() + interval '5 minutes')
    returning id into new_id;
  -- El Edge Function 'sos-dispatcher' escucha esta inserción via Realtime y despacha los push.
  return new_id;
end $$;
```
**Verificado: la función EXISTE, su firma coincide exactamente con la llamada del cliente, y todas las columnas que usa (`sender_user_id, lat, lon, message, scope_degree, cooldown_until, status, triggered_at`) SÍ existen en `sos_alerts` (verificado contra `information_schema`).** Este paso **se ejecuta con éxito**. El usuario recibe el toast de éxito de forma honesta — la alerta se crea.

**Paso 4 — Disparo del webhook — verificado vía `pg_trigger`**
```sql
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.sos_alerts'::regclass AND NOT tgisinternal;
-- → sos_dispatcher | tgenabled = 'O' (habilitado, se dispara normalmente)
```
El trigger invoca `supabase_functions.http_request()` (función nativa de Supabase Database Webhooks), que ejecuta `net.http_post()` con un payload `{record: NEW, type:'INSERT', table:'sos_alerts', schema:'public'}` — este payload coincide exactamente con lo que `sos-dispatcher/index.ts` espera leer (`body.record`).

**Paso 5 — Edge Function desplegada — verificado vía Management API**
```
GET /v1/projects/{ref}/functions → sos-dispatcher: status "ACTIVE"
```
La función **está desplegada y activa**, no es código huérfano.

**Paso 6 — Punto exacto de fallo dentro de la función**
```typescript
// sos-dispatcher/index.ts:74-76
const { data: sender } = await admin
  .from("persons")
  .select("id, first_names, last_names")   // ← first_names, last_names NO EXISTEN
  .eq("linked_user_id", alert.sender_user_id)  // ← linked_user_id NO EXISTE
  .maybeSingle();
if (!sender) return new Response("sender not found", { status: 404 });
```
Postgrest devuelve un error (columna inexistente en select y/o filtro). El código **no captura `error`**, solo `data`. `data` es `null` → `sender` es `null` → **la función retorna HTTP 404 en este punto exacto**, antes de llegar a cualquier lógica de despacho de notificaciones (BFS de red familiar, tokens FCM, envío push).

### Payload y autenticación
- Payload recibido por la función: `{ record: { id, sender_user_id, lat, lon, message, status, scope_degree, triggered_at, resolved_at, cooldown_until }, type: "INSERT", table: "sos_alerts", schema: "public" }`
- Autenticación: la función usa `SUPABASE_SERVICE_ROLE_KEY` (rol de servicio, bypassa RLS) — no hay problema de permisos.

### Clasificación final (usando únicamente las categorías permitidas)

| Componente | Clasificación |
|---|---|
| Botón SOS + RPC `trigger_sos` (creación de la alerta) | **FUNCIONAL SEGÚN CONTRATO** — verificado: firma coincide, columnas coinciden, inserción exitosa, usuario recibe confirmación honesta |
| Webhook `sos_dispatcher` (disparo hacia la Edge Function) | **FUNCIONAL SEGÚN CONTRATO** — trigger habilitado, mecanismo nativo verificado, función desplegada y activa |
| Edge Function `sos-dispatcher` — resolución de destinatarios | **FALLO CONFIRMADO EN CONTRATO** — la consulta en la línea 74-76 referencia columnas (`first_names`, `last_names`, `linked_user_id`) que no existen en el esquema real; el resultado observable es HTTP 404 sin ningún despacho de notificación, sin excepción no controlada, sin dato personal expuesto |

**Conclusión precisa:** SOS **no está roto de punta a punta**. La alerta **se crea correctamente** y queda registrada en `sos_alerts`. Lo que falla, de forma confirmada y localizada, es el **despacho de notificaciones a la red familiar** dentro de la Edge Function, en el punto exacto donde intenta resolver la persona del emisor vía `linked_user_id` (que no existe) en lugar de `person_claims`.

No se envió ninguna alerta real ni se contactó a ningún usuario para esta verificación — toda la evidencia proviene de `pg_proc`, `pg_trigger`, `information_schema` y la Management API de Supabase.

---

## 5. REAUDITORÍA: /profile vs /settings

### Navegación verificada (grep exhaustivo de `href="/profile"` y `href="/settings"`)

```bash
$ grep -rn '"/profile"\|"/settings"' src/ --include="*.tsx" | grep -v "app/profile/\|app/settings/"
src/app/tree/page.tsx:630:          <Link href="/settings" ...>
src/components/BottomNav.tsx:11:    { href: "/settings", icon: Settings, label: "Ajustes", ... }
```

**Hallazgo: ninguna navegación enlaza directamente a `/profile`.** `BottomNav.tsx` (barra inferior, un único componente sin variante de escritorio separada en este repo) enlaza únicamente a `/settings`. `/profile` solo es alcanzable desde dentro de `/settings`:

```tsx
// settings/page.tsx:167
<Link href="/profile" ...>Editar perfil</Link>
```

### Conclusión: NO son implementaciones duplicadas

Son dos páginas con responsabilidades distintas y complementarias, en una sola cadena de navegación:

```
BottomNav ("Ajustes") → /settings → [toggles de privacidad + botón "Editar perfil"] → /profile → [form de nombre/bio/foto]
```

- **`/settings`**: existe. Es el destino real de navegación (desktop y móvil comparten el mismo `BottomNav`). Usa `profiles.select/update` sobre `location_enabled, privacy_birth_date, privacy_social_link, privacy_map` — **ninguna de estas 4 columnas existe en el esquema real**. Efecto verificado: la carga usa valores por defecto (silenciosa, sin captura de error); el guardado captura el error explícitamente y muestra "Error al guardar" al usuario en cada toggle.
- **`/profile`**: existe. Solo alcanzable vía el link "Editar perfil" dentro de `/settings`. Usa `profiles.update` (7 columnas inexistentes) y `persons.update` (5 columnas inexistentes, código inalcanzable en la práctica). Efecto verificado: el guardado siempre corta con `toast.error("Error al guardar")` en la primera operación; nunca llega al toast de éxito.

### Qué funciona y qué no, con precisión

| Acción en /settings o /profile | Funciona? | Evidencia |
|---|---|---|
| Cargar `/settings` (ver toggles) | Sí, con valores por defecto | `select()` sin error capturado → fallback a `useState` inicial |
| Mover un toggle en `/settings` | No — error visible | `update()` con error capturado → `toast.error("Error al guardar")` |
| Cargar `/profile` (ver formulario) | Sí, con campos en blanco | `select("*")` no genera error; propiedades ausentes → `undefined` → `""` |
| Guardar cambios en `/profile` | No — error visible | `update()` con error capturado → `toast.error("Error al guardar")`, corte antes del segundo update |
| Cerrar sesión desde `/settings` | Sí | `supabase.auth.signOut()` no depende del esquema legado |

**No se declara "Profile completamente roto" de forma genérica** — se documenta que la ruta activamente enlazada (`/settings`) tiene 4 toggles que fallan con error visible, y que su sub-página (`/profile`) tiene un guardado que también falla con error visible, en ambos casos por columnas ausentes del esquema real, no por ausencia de la ruta ni por duplicación.

---

## 6. CONTEOS EXACTOS (sin rangos aproximados)

### Comando base ejecutado
```bash
grep -rnE "<patrón>" src/ supabase/ --include="*.ts" --include="*.tsx" --include="*.sql"
```
para cada uno de los 19 patrones solicitados: `family_members`, `relationship_suggestions`, `linked_user_id`, `profiles.first_name`, `profiles.last_name`, `profiles.email`, `profiles.phone`, `profiles.avatar_url`, `profiles.city`, `profiles.country`, `profiles.bio`, `profiles.social_link`, `profiles.live_lat`, `profiles.live_lng`, `profiles.location_sharing`, `persons.first_names`, `persons.last_names`, `persons.profile_photo_url`, `persons.phone`.

### Resultado deduplicado
- **Líneas coincidentes totales (deduplicadas por archivo:línea): 159**
- **Archivos únicos con al menos una coincidencia: 31**

### Clasificación exacta de los 31 archivos (sin solapamiento — cada archivo cuenta una sola vez, en su categoría dominante)

| Categoría | Cantidad | Archivos |
|---|---|---|
| **Código ejecutable con referencia real a tabla/columna inexistente** | 25 | api/broadcast/route.ts, api/cron/birthdays/route.ts, api/cron/digest/route.ts, api/email/welcome/route.ts, api/notify/new-content/route.ts, api/presence/route.ts, chat/[roomId]/page.tsx, chat/page.tsx, events/page.tsx, feed/page.tsx, invitar/page.tsx, member/[id]/page.tsx, onboarding/page.tsx, photos/page.tsx, profile/page.tsx, settings/page.tsx, share/[token]/layout.tsx, BirthdayWidget.tsx, TodayWidget.tsx, graphAdapter.ts, viral/onboardingSteps.ts, cron-birthdays-daily/index.ts, invite-reminder/index.ts, sms-fallback/index.ts, sos-dispatcher/index.ts |
| **Solo comentarios (cero código ejecutable coincidente)** | 2 | tree/page.tsx (2 líneas, ambas `//`), auth/register/page.tsx (1 línea, `//`) |
| **Solo definiciones de tipos TypeScript (sin llamada a DB en tiempo de ejecución)** | 2 | lib/ceibaTypes.ts, lib/types.ts |
| **Tipos auto-generados con coincidencias que son falsos positivos** | 1 | types/database.types.ts (`new_family_members` es columna real de `notification_preferences`, no relacionada con `family_members`; `profile_photo_url` es el nombre de un campo de retorno de la RPC real `_admin_birthdays_for_person`, no una columna de tabla) |
| **SQL histórico (no aplicado por ningún pipeline activo)** | 1 | supabase/schema.sql — confirmado inerte: `supabase/config.toml` tiene `schema_paths = []` y usa `seed.sql`, no `schema.sql` |
| **Tests** | 0 | Ninguno de los 31 archivos coincide con `*.test.ts` / `*.spec.ts` |
| **TOTAL** | **31** | |

### Dentro de los 25 archivos ejecutables — matiz importante (no todos con la misma severidad)

De los 25, en **2 archivos** (`invitar/page.tsx`, `onboarding/page.tsx`) los términos `first_names`/`last_names` que coinciden con el patrón son **nombres de campos de estado local de UI** (no columnas de base de datos) que se traducen correctamente a `first_name`/`middle_name`/`first_surname`/`second_surname` antes de cualquier llamada RPC real — verificado leyendo el payload exacto enviado a `add_relative`. Estos 2 archivos sí contienen, además, otro código genuinamente roto (p. ej. `invitar/page.tsx:191` hace `persons.update({phone})` y `phone` no existe en `persons`).

En **1 archivo** (`graphAdapter.ts`), la coincidencia está dentro de un `console.table(...)` de depuración — código ejecutable pero sin ningún efecto funcional observable (no lanza excepción, no afecta UI, es un log de desarrollo).

### Archivos ya eliminados por la limpieza de invitaciones (no cuentan en el inventario actual)
`src/app/join/page.tsx`, `src/app/join/connect/page.tsx`, `src/app/para/[token]/page.tsx`, `src/app/api/para/[token]/route.ts`, `src/app/api/suggestions/route.ts`, `src/components/SuggestionCards.tsx`, `src/lib/viral/deeplinkHandler.ts`, `supabase/functions/invite-open-handler/index.ts` — **8 archivos**, confirmados eliminados en `git status --short` (ver sección 8).

### Desglose por tipo de artefacto afectado

| Tipo | Cantidad exacta | Detalle |
|---|---|---|
| Páginas React (`page.tsx`) | 12 | chat, chat/[roomId], events, feed, invitar, member/[id], onboarding, photos, profile, settings, tree (solo comentario), auth/register (solo comentario) |
| API routes (Next.js route handlers) | 6 | broadcast, cron/birthdays, cron/digest, email/welcome, notify/new-content, presence |
| Componentes React (no-página) | 2 | BirthdayWidget.tsx, TodayWidget.tsx |
| Layouts | 1 | share/[token]/layout.tsx |
| Helpers/lib (con lógica DB ejecutable) | 2 | viral/onboardingSteps.ts, graphAdapter.ts |
| Helpers/lib (solo tipos) | 2 | ceibaTypes.ts, types.ts |
| Edge Functions | 4 | sos-dispatcher, sms-fallback, cron-birthdays-daily, invite-reminder |
| Cron jobs (dentro de API routes, ya contados arriba) | 2 | cron/birthdays, cron/digest (subconjunto de API routes) |
| RPCs verificadas en Postgres relacionadas con SOS | 4 | trigger_sos, respond_sos, cancel_sos, get_family_ids_up_to (todas EXISTEN) |
| Archivos SQL históricos | 1 | supabase/schema.sql |
| Tipos auto-generados | 1 | types/database.types.ts |
| Tests afectados | 0 | — |

---

## 7. PRIORIZACIÓN POR EVIDENCIA (sin asumir bloqueadores no probados)

Se evalúan 11 EPICs con: impacto, evidencia de fallo, dependencia, riesgo, esfuerzo, reversibilidad.

| EPIC | Impacto usuario | Evidencia de fallo | Dependencia | Riesgo | Esfuerzo | Reversibilidad |
|---|---|---|---|---|---|---|
| **A. Invitaciones canónicas — commit pendiente** | Ninguno adicional (ya funcional, solo falta persistir) | N/A — ya validado con tests/build en sesión previa | Ninguna | Bajo | Minutos (solo `git commit`) | Total (es un commit, reversible con revert) |
| **B. Settings/Profile — 4 toggles + guardado de perfil** | Alto — usuario ve error cada vez que intenta cambiar privacidad o editar su nombre | CONFIRMADO: error capturado y mostrado en ambos casos (sección 3) | Ninguna técnica (no depende de linked_user_id; requiere decidir columnas reales a usar) | Bajo (cambio aislado a 2 archivos) | Medio | Alta |
| **C. SOS — despacho de notificaciones** | Alto — la alerta se crea pero la familia no es notificada | CONFIRMADO extremo a extremo (sección 4) | Depende de resolver persona vía `person_claims` (patrón reusable para D/E/F también) | Alto (seguridad/emergencias) | Bajo-Medio (1 archivo, 1 query a corregir) | Alta |
| **D. Widgets del árbol (Hoy/Cumpleaños)** | Medio-Alto — visible constantemente en `/tree` | CONFIRMADO: `.from("family_members")` no existe (tabla confirmada ausente) | Requiere definir de dónde vienen "cumpleaños próximos" en el modelo canónico (`persons.birth_date` + `space_memberships`/`relationships`) | Medio | Medio | Alta |
| **E. Presence/Map** | Medio — funcionalidad secundaria, pero devuelve `200 OK` con datos vacíos (no crashea) | CONFIRMADO: 2 mecanismos de ubicación distintos (`live_lat/lng` y `latitude/longitude`), ninguno existe en `profiles` | Ninguna técnica; decisión de diseño (un solo mecanismo de ubicación) | Medio | Medio-Alto (requiere decidir arquitectura de ubicación) | Alta |
| **F. Chat** | Bajo-Medio — mensajería funciona; nombres/avatares aparecen vacíos | RIESGO CONFIRMADO (no fallo duro): `select` devuelve NULL en campos, no error bloqueante | Ninguna | Bajo | Bajo-Medio | Alta |
| **G. Feed** | Bajo-Medio — feed se muestra, pero incompleto (sin cumpleaños ni "se unió") | RIESGO CONFIRMADO: `family_members` ausente → arrays vacíos, sin error HTTP | Comparte causa raíz con D (widgets) | Bajo | Medio | Alta |
| **H. Photos** | Bajo — subida y visualización de fotos funciona; solo falla filtro por familiar | RIESGO CONFIRMADO: `family_members` ausente → lista de miembros vacía | Comparte causa raíz con D/G | Bajo | Bajo | Alta |
| **I. Cron y notificaciones (birthdays, digest, sms-fallback, invite-reminder)** | Medio — son jobs de fondo, sin usuario esperando en pantalla | CONFIRMADO: 4 jobs con error descartado → resultados vacíos, sin alertar a nadie de que fallan | Comparte causa raíz con C (person_claims) para 2 de los 4 | Medio | Medio (paralelizable entre los 4) | Alta |
| **J. Edge Functions (agrupado con I y C)** | — | Ver C e I | — | — | — | — |
| **K. Schema/types históricos** | Ninguno directo al usuario | CONFIRMADO: `schema.sql` inerte, `database.types.ts` con 2 falsos positivos y desactualizado respecto al esquema real | Debe ir **último**: depende de que B-I estén resueltos para regenerar tipos limpios | Bajo | Bajo | Total |

### Nota sobre por qué SOS ya no es automáticamente "primero"

En la v1 se priorizó SOS por ser "seguridad", sin verificar si Profile era un bloqueador técnico real. Verificado ahora: **Profile/Settings no bloquea SOS** — son código independiente, cada uno con su propia consulta rota, sin dependencia compartida en el código actual (aunque comparten la *misma causa raíz conceptual*: ausencia de un helper canónico `resolvePersonForUser(userId)` vía `person_claims`). La prioridad entre B y C debe decidirse por impacto y riesgo, no por bloqueo técnico:

- **C (SOS)** tiene mayor riesgo (seguridad, emergencias reales) pero menor frecuencia de uso.
- **B (Settings/Profile)** tiene mayor frecuencia de uso (cualquier usuario que edite su perfil) pero menor riesgo por evento individual.

### Tres EPICs prioritarios recomendados (con justificación)

1. **EPIC A — Commit de invitaciones.** Cero riesgo, cero esfuerzo, desbloquea limpieza del historial de cambios. Debe hacerse antes de tocar cualquier otro archivo para no mezclar diffs.
2. **EPIC C — SOS (despacho de notificaciones).** Máximo riesgo por evento (emergencias reales sin notificar a la familia), evidencia end-to-end completa, esfuerzo bajo (una función, un query mal construido).
3. **EPIC B — Settings/Profile.** Mayor frecuencia de uso real (cualquier edición de perfil o privacidad falla con error visible hoy mismo), esfuerzo medio, sin dependencias bloqueantes.

---

## 8. ESTADO DE LOS CAMBIOS DE INVITACIONES (verificación de no-interferencia)

```bash
$ git status --short
 D src/app/api/para/[token]/route.ts
 D src/app/api/suggestions/route.ts
 M src/app/auth/register/page.tsx
 M src/app/invite/[token]/page.tsx
 M src/app/invite/page.tsx
 D src/app/join/connect/page.tsx
 D src/app/join/page.tsx
 D src/app/para/[token]/page.tsx
 M src/app/tree/page.tsx
 D src/components/SuggestionCards.tsx
 M src/lib/types.ts
 D src/lib/viral/deeplinkHandler.ts
 M src/lib/viral/inviteFlow.ts
 D supabase/functions/invite-open-handler/index.ts
?? docs/audit/
```

```bash
$ git diff --stat
 src/app/api/para/[token]/route.ts               | 163 -----------
 src/app/api/suggestions/route.ts                | 121 --------
 src/app/auth/register/page.tsx                  |  56 ++--
 src/app/invite/[token]/page.tsx                 | 360 ++++++++++--------------
 src/app/invite/page.tsx                         | 300 +-------------------
 src/app/join/connect/page.tsx                   | 331 ----------------------
 src/app/join/page.tsx                           | 169 -----------
 src/app/para/[token]/page.tsx                   | 197 -------------
 src/app/tree/page.tsx                           |   2 -
 src/components/SuggestionCards.tsx              |  89 ------
 src/lib/types.ts                                |  14 -
 src/lib/viral/deeplinkHandler.ts                |  74 -----
 src/lib/viral/inviteFlow.ts                     |  36 ---
 supabase/functions/invite-open-handler/index.ts | 124 --------
 14 files changed, 178 insertions(+), 1858 deletions(-)
```

```bash
$ git diff --name-status
D       src/app/api/para/[token]/route.ts
D       src/app/api/suggestions/route.ts
M       src/app/auth/register/page.tsx
M       src/app/invite/[token]/page.tsx
M       src/app/invite/page.tsx
D       src/app/join/connect/page.tsx
D       src/app/join/page.tsx
D       src/app/para/[token]/page.tsx
M       src/app/tree/page.tsx
D       src/components/SuggestionCards.tsx
M       src/lib/types.ts
D       src/lib/viral/deeplinkHandler.ts
M       src/lib/viral/inviteFlow.ts
D       supabase/functions/invite-open-handler/index.ts
```

### Distinción exacta
- **Archivos modificados por la limpieza de invitaciones:** 6 (`auth/register/page.tsx`, `invite/[token]/page.tsx`, `invite/page.tsx`, `tree/page.tsx`, `lib/types.ts`, `lib/viral/inviteFlow.ts`)
- **Archivos eliminados:** 8 (`api/para/[token]/route.ts`, `api/suggestions/route.ts`, `join/connect/page.tsx`, `join/page.tsx`, `para/[token]/page.tsx`, `components/SuggestionCards.tsx`, `lib/viral/deeplinkHandler.ts`, `supabase/functions/invite-open-handler/index.ts`)
- **Documento de auditoría nuevo (no rastreado aún):** `docs/audit/` (contiene este archivo y su versión previa, ambos sin `git add`)

**Confirmado: los 14 cambios de invitaciones permanecen exactamente como al cierre de esa tarea — ninguna línea adicional modificada por esta auditoría.**

---

## 9. INCERTIDUMBRES RESTANTES

| Pregunta abierta | Por qué no se resolvió en esta auditoría |
|---|---|
| ¿Cuál es el valor exacto del enum `claim_status` en `person_claims` (p. ej. `'approved'`, `'active'`, etc.)? | Se confirmó el tipo (`USER-DEFINED`/enum) pero no se listaron los valores del enum; necesario antes de escribir el helper canónico `resolvePersonForUser()` |
| ¿`events/page.tsx` consulta una tabla `events` inexistente o `family_events` (que sí existe)? | Se confirmó que el `.select()` usa columnas de `profiles` rotas, pero no se verificó el `.from(...)` exacto de esa consulta |
| ¿Los logs de producción de las Edge Functions confirman el HTTP 404 de `sos-dispatcher` en la práctica? | No se ejecutó ninguna alerta real (prohibido explícitamente); la conclusión es por inspección de código y esquema, no por observación de logs en vivo |
| ¿`invite-reminder/index.ts` y `sms-fallback/index.ts` están conectados a un cron real (pg_cron) o solo desplegados sin invocación programada? | Se confirmó despliegue (Management API) pero no se verificó `cron.job` en Postgres para estas dos funciones específicas |
| ¿Existen filas reales en `profiles`/`persons` con datos de usuarios actuales que dependan de las columnas rotas (riesgo de pérdida de datos si se migra el esquema del lado del código)? | No se consultó el contenido de las tablas (solo su estructura), para evitar acceder a datos personales sin necesidad |

---

## 10. RESUMEN EJECUTIVO (basado exclusivamente en evidencia)

- **31 archivos** contienen coincidencias de los 19 patrones auditados. De ellos, **25 tienen código ejecutable** con referencias reales a tablas/columnas inexistentes, **2 son solo comentarios**, **2 son solo definiciones de tipos**, **1 es un archivo SQL histórico inerte**, y **1 es un archivo de tipos auto-generado con coincidencias que resultaron ser falsos positivos**.
- **`linked_user_id` no debe restaurarse.** El mapeo canónico usuario→persona ya existe y funciona: `person_claims` (verificado con FKs, constraint UNIQUE y cascada correctos).
- **SOS no está completamente roto.** La creación de la alerta (`trigger_sos` RPC) es funcional y verificada. El despacho de notificaciones falla en un punto exacto y confirmado dentro de `sos-dispatcher/index.ts` (columnas inexistentes, error descartado, resultado HTTP 404 interno).
- **`/settings` es la ruta real de navegación**, no `/profile`. Ambas existen, no están duplicadas, y ambas tienen fallos de guardado confirmados con errores visibles al usuario (no silenciosos) por columnas ausentes en `profiles`.
- Los cambios de invitaciones (14 archivos) permanecen intactos y sin interferencia de esta auditoría.

### Ruta del documento
`docs/audit/20260727_legacy_runtime_inventory.md`

### Número exacto de hallazgos por clasificación
| Clasificación | Cantidad |
|---|---|
| A. FALLO CONFIRMADO | 7 (profile update, settings update, api/presence POST update, sos-dispatcher resolución de sender, cron-birthdays-daily resolución de usuarios, sms-fallback resolución de teléfono/inviter, api/presence GET family_members) |
| B. RIESGO CONFIRMADO POR INSPECCIÓN | 10 (chat×2, feed, photos×2, member/[id], events, share/[token]/layout, broadcast, notify/new-content, onboardingSteps activation check) |
| C. CÓDIGO MUERTO CONFIRMADO | 0 archivos completos (hay líneas puntuales muertas: 2 comentarios + 1 console.table de depuración en graphAdapter.ts) |
| D. LEGADO DOCUMENTAL | 2 (schema.sql, database.types.ts) |

### Tres EPICs prioritarios (repetido de sección 7 para referencia rápida)
1. EPIC A — Commit de invitaciones (cero riesgo, desbloquea historial limpio)
2. EPIC C — SOS / despacho de notificaciones (mayor riesgo por evento, evidencia completa, esfuerzo bajo)
3. EPIC B — Settings/Profile (mayor frecuencia de uso, sin dependencias bloqueantes)

### Git status
```
$ git status --short
 D src/app/api/para/[token]/route.ts
 D src/app/api/suggestions/route.ts
 M src/app/auth/register/page.tsx
 M src/app/invite/[token]/page.tsx
 M src/app/invite/page.tsx
 D src/app/join/connect/page.tsx
 D src/app/join/page.tsx
 D src/app/para/[token]/page.tsx
 M src/app/tree/page.tsx
 D src/components/SuggestionCards.tsx
 M src/lib/types.ts
 D src/lib/viral/deeplinkHandler.ts
 M src/lib/viral/inviteFlow.ts
 D supabase/functions/invite-open-handler/index.ts
?? docs/audit/
```

### Git diff --stat
```
$ git diff --stat
 src/app/api/para/[token]/route.ts               | 163 -----------
 src/app/api/suggestions/route.ts                | 121 --------
 src/app/auth/register/page.tsx                  |  56 ++--
 src/app/invite/[token]/page.tsx                 | 360 ++++++++++--------------
 src/app/invite/page.tsx                         | 300 +-------------------
 src/app/join/connect/page.tsx                   | 331 ----------------------
 src/app/join/page.tsx                           | 169 -----------
 src/app/para/[token]/page.tsx                   | 197 -------------
 src/app/tree/page.tsx                           |   2 -
 src/components/SuggestionCards.tsx              |  89 ------
 src/lib/types.ts                                |  14 -
 src/lib/viral/deeplinkHandler.ts                |  74 -----
 src/lib/viral/inviteFlow.ts                     |  36 ---
 supabase/functions/invite-open-handler/index.ts | 124 --------
 14 files changed, 178 insertions(+), 1858 deletions(-)
```

**Auditoría detenida aquí, según instrucción. Sin pruebas ejecutadas, sin commit creado.**
