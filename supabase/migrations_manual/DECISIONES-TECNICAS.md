# Decisiones técnicas — Ceiba

Este documento explica **por qué** cada pieza está como está, para que tu equipo pueda extender la arquitectura con criterio.

---

## 1. ¿Por qué Supabase y no Firestore?

Ceiba requiere:
- **Consultas recursivas** (red familiar hasta N grados).
- **Integridad referencial** real (FKs).
- **Restricciones biológicas** (`CHECK` para fechas).
- **RLS granular** por vínculo confirmado.
- **Realtime** para chat y SOS.

Todo esto PostgreSQL lo hace nativamente. Firestore obligaría a mover la lógica pesada al cliente o a Cloud Functions y perdería garantías de integridad.

## 2. ¿Por qué una tabla `persons` separada de `auth.users`?

Porque una persona puede existir **sin cuenta**. Ejemplos:
- Un abuelo fallecido.
- Un bebé recién nacido.
- Un familiar que aún no se ha registrado.

Si `persons = auth.users`, el grafo no puede crecer hasta que cada persona se registre. Con la separación, Ceiba crece **antes** de que cada familiar entre.

## 3. ¿Por qué las relaciones se guardan una sola vez?

Guardar `A → B` y `B → A` como dos filas separadas duplica información y crea riesgo de inconsistencia (¿qué pasa si borro una y la otra no?).

Se guarda una sola arista con **dirección canónica**:
- Para `parent_of`: `person_a` es el padre, `person_b` el hijo.
- Para simétricas (`sibling_of`, `partner_of`, `half_sibling_of`): el trigger `normalize_symmetric_relationship` ordena `person_a_id < person_b_id` alfabéticamente.

El motor de inferencia deriva la inversa en tiempo de consulta.

## 4. ¿Por qué no guardar abuelos, tíos, primos?

Explota en tamaño. Con solo 100 personas y 4 generaciones, hay potencialmente cientos de relaciones derivadas que no aportan información nueva.

Se calculan al vuelo con `get_my_family_graph`. Si el performance se vuelve un problema, se puede materializar una vista `mv_family_graph_per_person` y refrescarla vía trigger.

## 5. ¿Por qué `SECURITY DEFINER` en `is_in_my_family`?

Esta función se usa dentro de las policies RLS de `persons` y `relationships`. Si fuera `SECURITY INVOKER`, entraría en un loop:
- Para saber si puedo leer un `person`, se llama `is_in_my_family(person_id)`.
- Esa función consulta `relationships`.
- Pero para leer `relationships` la RLS pregunta si `is_in_my_family` del extremo... etc.

Con `SECURITY DEFINER`, la función corre con permisos elevados pero **solo devuelve un boolean**, no expone filas. Es seguro.

## 6. ¿Por qué RLS con `is_in_my_family(id, 4)`?

Grado 4 cubre:
- Grado 1: padres, hijos, hermanos, pareja
- Grado 2: abuelos, nietos, tíos, sobrinos, suegros
- Grado 3: primos, bisabuelos, bisnietos
- Grado 4: primos segundos, tatarabuelos

Más allá casi nadie sabe quién es quién. Ajustable por producto.

## 7. ¿Por qué el motor de matching devuelve top-10?

Para dar al cliente flexibilidad de mostrar sugerencias secundarias. En la UI mostramos solo el #1 si su score es alto. Si el usuario dice "no es ese", el #2 puede ofrecerse.

## 8. ¿Por qué SOS con cooldown de 5 min?

Para evitar tanto:
- Accidentes (tap accidental repetido).
- Abuso (spamear a la familia).

Se puede ajustar. La UI puede ofrecer un botón "cancelar alerta" que también cancela el cooldown.

## 9. ¿Por qué chats derivados y no libres?

Diferenciador clave de Ceiba: los chats son **producto del grafo, no configuración manual**. Si guardamos chat_rooms como configurables, se convierte en WhatsApp Groups.

En su lugar, un cron horario materializa los chats basados en el estado del grafo:
- Si hay ≥ 2 hermanos confirmados → existe chat "Hermanos".
- Si hay padre + hijos confirmados → existe chat "Con mis hijos".

El usuario nunca crea uno arbitrario. Puede silenciar.

## 10. ¿Por qué `pg_cron` y no un servicio externo?

`pg_cron` corre dentro del propio Postgres. Cero infraestructura adicional. Perfecto para jobs de bajo volumen como cumpleaños diarios y limpieza de SOS.

Para jobs de alto volumen (envío de push masivo) delegamos a Edge Functions, que sí escalan horizontalmente.

## 11. ¿Por qué webhooks para SOS y no llamada directa?

Al insertar un `sos_alerts`, un **webhook de Supabase** dispara la Edge Function `sos-dispatcher`. Ventaja: la lógica de dispatch **no bloquea** la RPC `trigger_sos`. El usuario recibe respuesta inmediata y el push se envía en background.

Alternativa: `NOTIFY` de Postgres + suscripción en la Edge Function. Ambas funcionan.

## 12. ¿Por qué `citext` para emails?

Emails deben tratarse case-insensitive (`juan@correo.com` = `Juan@Correo.com`). `citext` lo maneja automáticamente sin necesidad de `lower()` en cada consulta.

## 13. ¿Por qué `photo_hash` en persons?

Para el motor de matching. Un `pHash` permite comparar fotos aunque estén en resoluciones distintas o con compresión distinta. Si dos personas tienen un pHash cercano (Hamming distance < 8), es probable que sean la misma persona. Se implementa client-side al subir la foto.

## 14. ¿Por qué `unaccent` + `pg_trgm`?

Para comparar nombres en español, "José" y "Jose" deben coincidir. `unaccent` quita acentos; `pg_trgm` calcula similitud de trigramas (0-1). Umbral típico: `similarity > 0.6` = matches.

## 15. ¿Por qué soft delete y no delete físico?

Un `person` puede tener años de historia (relaciones, mensajes, eventos, fotos etiquetadas). Borrarlo rompería la memoria familiar. En su lugar: `status = 'deleted'` + `deleted_at`. Los queries de dominio filtran por `status = 'active'`.

Excepción: por GDPR / privacidad, un usuario puede pedir borrado real de **sus datos personales**. En ese caso: anonimizar (borrar nombres, email, foto) pero mantener la conexión estructural. Ver ruta futura de "borrado por solicitud".

## 16. ¿Por qué no guardar la dirección exacta en el mapa?

Privacidad. Se guarda solo ciudad. Es suficiente para "quién vive cerca" sin exponer domicilio. Si el usuario quiere compartir ubicación exacta, lo hace *a demanda* en un SOS.

## 17. ¿Por qué el flujo de reclamación de perfil (`claim_requests`)?

Alguien pudo haber sido agregado por su madre hace 5 años. Cuando se registra, la app detecta que ya existe. En vez de crear otro perfil:
1. Se pide confirmación a un familiar directo (la madre, por ejemplo).
2. La madre aprueba.
3. El perfil pasa a estar `linked_user_id` = nueva cuenta.
4. Todas las conexiones se mantienen.

Este proceso vale la ligera fricción porque **evita duplicados** que serían muy caros de resolver después.

## 18. ¿Por qué `audit_logs`?

Ceiba maneja información sensible (fallecimientos, adopciones, familias reconstruidas). Cualquier cambio en `is_living`, `death_date` o borrado de relaciones queda registrado. Si alguien reporta "mi tío borró la relación con mi papá", hay trazabilidad.

## 19. ¿Cómo escalar a millones de usuarios?

Si Ceiba crece:
1. **Índice materializado del grafo por usuario:** cachear los person_ids hasta grado 4 en una tabla `family_cache_by_user`, refrescada por trigger.
2. **Particionar `audit_logs`, `chat_messages`, `broadcasts`** por mes.
3. **Reemplazar FCM directo** por Firebase Admin SDK o un proveedor con retries.
4. **Full-text search** con Meilisearch/Algolia si la búsqueda por nombre se vuelve lenta.
5. **Read replicas** en Supabase (feature paga) para las queries de árbol.
