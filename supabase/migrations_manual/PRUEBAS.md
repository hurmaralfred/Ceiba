# Ceiba — Pruebas de aceptación

Checklist de validación tras aplicar la migración. Ejecutar en orden.

---

## 1. Pruebas de esquema

```sql
-- Todas las tablas creadas
select tablename from pg_tables
where schemaname = 'public'
  and tablename in (
    'persons','relationships','match_candidates','claim_requests',
    'merge_history','audit_logs','person_locations','broadcasts',
    'broadcast_recipients','sos_alerts','sos_responses','chat_rooms',
    'chat_room_members','chat_messages','family_events','photos',
    'photo_tags','push_tokens','notification_preferences'
  )
order by tablename;
-- Esperado: 19 filas
```

- [ ] Todas las 19 tablas existen.

```sql
-- Todas las funciones RPC
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'is_in_my_family','find_person_matches','get_my_family_graph',
    'trigger_sos','respond_sos','cancel_sos','upcoming_birthdays',
    'confirm_match','reject_match','add_relative',
    'get_family_ids_up_to','_admin_birthdays_for_person'
  )
order by proname;
-- Esperado: 12 filas
```

- [ ] Las 12 funciones RPC existen.

```sql
-- RLS activa en todas
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'persons','relationships','sos_alerts','chat_messages'
  );
-- Esperado: rowsecurity = true
```

- [ ] RLS activa en tablas críticas.

---

## 2. Pruebas funcionales manuales

### 2.1 Registro completo
- [ ] Puedo crear una cuenta nueva en la app.
- [ ] Al completar mi perfil se crea una fila en `persons` con `linked_user_id = auth.uid()`.

### 2.2 Agregar familiar sin coincidencia
- [ ] Como usuario A, agrego a "María López" con datos únicos.
- [ ] Se crea `persons` nueva y `relationships` con status = confirmed.
- [ ] `get_my_family_graph(3)` devuelve a María.

### 2.3 Agregar familiar con coincidencia
- [ ] Como usuario B, intento agregar a "María López" con los mismos datos.
- [ ] `add_relative` devuelve `needs_confirmation: true`.
- [ ] Se crea una `match_candidates` con score >= 100.

### 2.4 Confirmar coincidencia
- [ ] Ejecuto `confirm_match(candidate_id)`.
- [ ] Se crea `relationships` sin duplicar el `persons`.
- [ ] Ambos usuarios ven a María en su árbol.

### 2.5 Trigger de coherencia
- [ ] Intento crear una relación `parent_of` donde el padre nació después que el hijo.
- [ ] La inserción falla con error "padre no puede haber nacido después que el hijo".

### 2.6 Trigger anti-ciclo
- [ ] Creo A padre de B.
- [ ] Intento crear B padre de A.
- [ ] Falla con error "ciclo padre/hijo detectado".

---

## 3. Pruebas de RLS

```sql
-- Como usuario 'ana@ceiba.com':
-- (usar Supabase Dashboard → SQL Editor → cambiar rol a authenticated con JWT)

-- 3.1 No puedo leer persons fuera de mi red
select count(*) from public.persons;
-- Esperado: solo yo + mis familiares hasta grado 4.

-- 3.2 No puedo leer SOS de usuarios no relacionados
select count(*) from public.sos_alerts;
-- Esperado: 0 salvo SOS enviados por mí o por familiares dentro de scope_degree.

-- 3.3 No puedo insertar relationships involucrando personas ajenas
insert into public.relationships
  (person_a_id, person_b_id, relationship_type, declared_by_user_id, status)
values
  ('<uuid-persona-ajena-1>','<uuid-persona-ajena-2>','sibling_of', auth.uid(), 'confirmed');
-- Esperado: error de RLS ("new row violates row-level security policy")
```

- [ ] RLS bloquea lectura de datos ajenos.
- [ ] RLS bloquea inserciones ajenas.

---

## 4. Pruebas de SOS

### 4.1 Trigger inicial
```sql
select public.trigger_sos(4.6097, -74.0817, 'Prueba SOS', 2);
```
- [ ] Devuelve un UUID.

### 4.2 Cooldown
- [ ] Intento un segundo SOS inmediato.
- [ ] Falla con "SOS en cooldown hasta ...".

### 4.3 Dispatch (Edge Function)
- [ ] En los logs de la Edge Function `sos-dispatcher` veo la inserción procesada.
- [ ] Los tokens FCM de mis familiares reciben el push (verificar en el dispositivo).

### 4.4 Respuesta
```sql
select public.respond_sos('<sos-id>', 'coming', 'En 10 min llego');
```
- [ ] Se crea fila en `sos_responses`.
- [ ] El emisor puede verla via RLS `sos_resp_read`.

### 4.5 Cancelar
```sql
select public.cancel_sos('<sos-id>');
```
- [ ] `sos_alerts.status = 'cancelled'`.

---

## 5. Pruebas de cumpleaños

### 5.1 Query directa
```sql
select * from public.upcoming_birthdays(30);
```
- [ ] Devuelve los cumpleaños próximos en la red del usuario logueado.

### 5.2 Cron job
- [ ] `select * from cron.job where jobname = 'ceiba_birthdays_daily';` muestra el job activo.
- [ ] Manualmente ejecuto la Edge Function y verifico en logs que hace fetch a FCM.

---

## 6. Pruebas de chat

### 6.1 Materializador
- [ ] Ejecuto la Edge Function `chat-room-materializer` manualmente.
- [ ] Aparecen `chat_rooms` con `kind = 'siblings'` para grupos de hermanos existentes.

### 6.2 Realtime
- [ ] Cliente A y B ambos suscritos al mismo chat_room.
- [ ] A envía mensaje → B lo recibe vía Realtime en < 1 segundo.

---

## 7. Pruebas de Realtime en SOS

- [ ] El cliente se suscribe a `sos_alerts`.
- [ ] Se inserta un SOS.
- [ ] El cliente recibe el evento en su handler.

---

## 8. Verificación final de auditoría

```sql
select count(*) from public.audit_logs
where action in ('INSERT','UPDATE','DELETE','person.status_change')
  and created_at > now() - interval '1 hour';
```
- [ ] `audit_logs` está registrando cambios.

---

## 9. Rollback de emergencia

- [ ] `sql/99_rollback.sql` está listo para ejecutarse.
- [ ] Backup del Paso 0 conservado en Supabase Backups.

---

## 10. Aceptación de producto

- [ ] Tu equipo de producto pudo agregar 5 familiares reales sin errores.
- [ ] Un familiar registrado a posteriori puede reclamar su perfil sin duplicarlo.
- [ ] Un SOS de prueba llegó a todos los dispositivos de la red familiar en < 30 segundos.
- [ ] La app carga el árbol en < 2 segundos para un usuario con 50 familiares.
