# 05 — Ciclo de vida y versiones

## Unidad de versionado

La unidad que recibe revisión y aprobación es la **versión completa del cronograma**. Una reprogramación crea una versión sucesora con una copia completa de las sesiones: las que cambian y las que permanecen. Así, cada publicación identifica una instantánea inequívoca; la aprobación no cubre una agenda que se modifica en sitio.

La copia de una sesión enlaza con su antecedente mediante `id_sesion_previa` (candidato), conserva el trabajo y deja un evento con diferencia/motivo. No se muta la sesión publicada. Las reservas son la proyección operativa de la versión publicada, no el historial oficial.

## Transiciones candidatas

| Estado de origen | Acción | Estado de destino | Condiciones propuestas |
|---|---|---|---|
| — | Crear | `BORRADOR` | Usuario con permiso de planificación; calendario y periodo válidos. |
| `BORRADOR` | Enviar | `PROPUESTO` | Validaciones internas, sesiones completas y motivo registrado. |
| `PROPUESTO` | Registrar aprobación | `APROBADO_EXTERNAMENTE` | Evidencia verificable registrada por rol autorizado; fecha y referencia obligatorias. |
| `PROPUESTO` | Rechazar/devolver | `BORRADOR` o nueva revisión | No borrar evidencia/evento del rechazo; decisión sobre si se permite retomar el mismo borrador queda pendiente. |
| `APROBADO_EXTERNAMENTE` | Publicar | `PUBLICADO` | Aprobación corresponde exactamente al contenido; revalidar datos fuente y conflictos; reservar recursos de forma atómica. |
| `PUBLICADO` | Reprogramar | versión sucesora `BORRADOR` | Copiar la instantánea publicada; no alterar la versión original. La sucesora requiere aprobación/publicación según política. |
| `PUBLICADO` | Reemplazar | `REEMPLAZADO` | Solo en la misma transacción que publica la sucesora y cambia reservas; conservar eventos. |
| `BORRADOR`/`PROPUESTO` | Cancelar propuesta | `CANCELADO` | Motivo; no hay reserva activa, salvo que la política permita reservas previas. |
| `PUBLICADO` | Cancelar agenda o sesiones | `CANCELADO` (alcance por definir) | Autorización, motivo, notificación definida y liberación atómica de reservas. |
| `PUBLICADO` | Concluir | `FINALIZADO` | Solo si se define el criterio institucional para todas las sesiones y sus resultados. |

La tabla no autoriza por sí sola estos flujos. Roles, firmas, rechazo, notificación y cuándo se permite cancelar requieren decisión institucional. No se implementan transiciones en 10.7A.

## Inmutabilidad y auditoría

- Una versión publicada o reemplazada es inmutable, incluidos sus datos de aprobación y el conjunto de sesiones.
- Una revisión se agrega como nueva versión enlazada, con actor, instante, motivo y correlación.
- Los eventos son append-only; no se corrige un evento borrándolo. Una rectificación agrega otro evento.
- Una sesión completada o una evaluación asociada no se edita para reflejar un cambio del calendario. La relación entre evaluación, versión de agenda y acto académico debe definirse en el diseño posterior.
- La nota calculada no se hace oficial ni se modifica por publicar una agenda; actas y oficialización no forman parte de esta etapa.

## Publicación atómica

En una sola transacción:

1. Bloquear el cronograma y los recursos afectados con una estrategia consistente.
2. Confirmar que la versión está en `APROBADO_EXTERNAMENTE` y que la evidencia se refiere a esa versión.
3. Revalidar trabajo, periodo, tribunal, miembros y cualquier elegibilidad cuya fuente se integre.
4. Verificar intervalos y restricciones de conflicto en PostgreSQL.
5. Insertar nuevas reservas y liberar las de la versión anterior que ya no aplican.
6. Publicar la nueva versión y marcar la previa reemplazada.
7. Registrar eventos y notificaciones de outbox/auditoría, si se adopta ese patrón.

Un error revierte el conjunto: no debe quedar versión publicada sin reservas, reservas huérfanas ni estado anterior reemplazado sin sucesora publicada. Los detalles de bloqueo dependen de la clave definitiva de cada recurso.

## Versiones vigentes e históricas

- Proponer índice único parcial que permita como máximo una versión `PUBLICADO` por cronograma.
- La sucesora no se considera vigente hasta que la publicación transaccional termine.
- Consultas históricas deben poder reconstruir el contenido aprobado sin leer reservas actuales como sustituto.
- No convertir automáticamente cada fila legacy en una versión aprobada. La presencia de una fecha/hora y estado no prueba que el Consejo aprobó esa agenda.
- Para programaciones ya existentes, la Universidad debe elegir entre archivo legacy, adopción con nueva aprobación, regularización documental u otra fecha de corte. Ninguna opción se presupone.

## Cancelación y notificación

La cancelación debe conservar quién, cuándo y por qué; definir si afecta el cronograma entero o algunas sesiones; y liberar solamente reservas afectadas en la misma transacción. Las notificaciones actuales se generan con un trigger al cambiar fecha/hora/sala. Al evolucionar la tabla, se debe evitar que el trigger emita mensajes duplicados o por ediciones de borrador; definir destinatarios, evento publicable, idempotencia y reintento antes del corte.
