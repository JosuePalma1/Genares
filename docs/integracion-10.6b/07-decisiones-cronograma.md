# Decisiones de diseño para un cronograma versionado

## Estado

Todo lo descrito aquí es propuesta para discusión. No se crean entidades TypeORM, migraciones, endpoints ni cambios de base en 10.6B.

## Programación legacy: dos alternativas

### A. Mantener el registro legacy como histórico y migrar la operación futura — recomendada

1. Conservar `programaciones_sustentacion` sin borrar ni reescribir datos.
2. Para trabajos ya programados, tratar su fila como antecedente legacy. Si se requiere trazabilidad estructurada, importar una sola vez a una primera versión/sesión y registrar el `id_programacion_legado` nullable con unicidad; esa migración requeriría revisión de conteos y equivalencia antes de autorizarla.
3. Definir una fecha de corte. A partir de ella, la fuente de verdad operativa es la versión/sesión publicada.
4. Mantener lectura compatible mediante adaptador o vista que devuelva la forma antigua desde la sesión publicada cuando exista, y fallback a la fila legacy para el histórico todavía no importado.
5. Retirar escrituras legacy después del corte. Evitar escritura doble entre tablas.
6. En una etapa de implementación, revisar el trigger que hoy valida evaluaciones ORAL contra la programación legacy para aceptar una sesión publicada nueva y conservar lectura/cierre histórico.

Esta alternativa protege evaluaciones y trabajos antiguos y permite un corte explícito. La tabla legacy permanece como fuente histórica de sus registros antiguos; no debe competir con nuevas sesiones publicadas.

### B. Evolucionar la tabla legacy

Se podría agregar versión/estado a `programaciones_sustentacion`, quitar la unicidad por trabajo y añadir detalles de sala y participantes. Reduce tablas, pero mezcla el registro de una programación actual con las propuestas, cancelaciones e historia; aumenta el riesgo de afectar consumidores y triggers legacy. No se recomienda salvo que el inventario de clientes muestre que no hay dependencia incompatible.

**Decisión propuesta:** elegir A y autorizar por separado contrato de compatibilidad, fecha de corte, carga inicial y cambio del trigger de evaluación. No implementar todavía.

## Entidades futuras candidatas

El diagrama B presenta nueve entidades `PROP_`:

1. `cronogramas_sustentacion`: conjunto de agenda, período y estado general.
2. `cronograma_carreras`: relación del cronograma con una o más carreras.
3. `versiones_cronograma`: revisiones inmutables propuestas/publicadas.
4. `salas_sustentacion`: catálogo local, idealmente con referencia estable al inventario institucional.
5. `sesiones_sustentacion`: trabajo, asignación confirmada, intervalo y estado por sesión.
6. `aprobaciones_externas_cronograma`: evidencia de la aprobación del Consejo asociada a la versión.
7. `eventos_cronograma`: decisiones, reemplazos, publicación y cancelación append-only.
8. `participantes_sesion`: personas y roles para participantes no cubiertos como miembros lectores.
9. `reservas_recurso_sesion`: proyección transaccional para detectar conflictos de sala/persona.

Las referencias a personas, carreras, períodos, trabajos y asignación de tribunal se proponen contra identidades ya presentes en Genares. No se declara que Sistemas 1–3 tengan estas tablas o llaves.

## Ciclo de vida propuesto

Un borrador pasa a propuesta; recibe evidencia externa de aprobación; después puede publicarse. Una nueva programación crea nueva versión y enlaza la anterior como reemplazada; una cancelación genera evento y libera reservas. Los estados candidatos son:

| Versión | Significado propuesto |
|---|---|
| `BORRADOR` | Edición administrativa sin publicación. |
| `PROPUESTA` | Enviada a revisión/aprobación externa. |
| `APROBADA_EXTERNAMENTE` | Se registró evidencia verificable de la aprobación. |
| `PUBLICADA` | Horario confirmado y notificaciones autorizadas. |
| `REEMPLAZADA` | Sustituida por versión posterior, conservada para auditoría. |
| `CANCELADA` | Retirada explícitamente con actor, momento y motivo. |
| `FINALIZADA` | Todas las sesiones concluidas, si la institución adopta este estado. |

Estados candidatos de sesión: `PROGRAMADA`, `CANCELADA`, `REEMPLAZADA`, `REALIZADA`. Son vocabulario de diseño, no reglas institucionales aprobadas.

La aprobación es evidencia de una entidad externa. Guardar referencia de documento/acta, versión aprobada, fecha de aprobación y actor interno que registró la evidencia. No crear cuenta de Consejo ni hacer que un estado de versión sustituya la evidencia. Conservar eventos de rechazo, ajuste, sustitución, publicación y cancelación.

## Conflictos y concurrencia

- Representar el período como intervalo `tstzrange` semiabierto `[inicio, fin)`, de forma que una sesión que termina a las 10:00 no choque con otra que empieza a las 10:00.
- Guardar instantes con `timestamptz` y zona IANA de presentación. `America/Guayaquil` es candidata técnica, no decisión aprobada; confirmar con la Universidad.
- La sala debe tener catálogo y clave estable; el nombre textual no basta para evitar colisiones.
- Reservar recursos dentro de la misma transacción que publica la versión. Una reserva activa debe señalar exactamente una sala o una persona; una restricción `CHECK` lo exigiría.
- Restricciones `EXCLUDE USING gist` con rangos solapados para sala y, según política, persona. `btree_gist` puede ser necesario para combinar identificadores con `tstzrange`.
- Mantener índice parcial/exclusión solo sobre reservas activas. Al publicar reemplazo o cancelar, liberar reservas anteriores y activar nuevas en la misma transacción, dejando eventos inmutables.
- Proteger el proceso de publicación con locks por agenda/recurso y revalidación dentro de la transacción. Dos publicaciones concurrentes no deben validar contra el mismo estado y reservar simultáneamente.
- La política de si un borrador o una propuesta reserva capacidad debe decidirse. Como punto de partida se propone que solo publicación reserve.

Pendiente institucional: qué roles/personas bloquean simultaneidad. Lectores del tribunal podrían ser obligatorios; presidencia puede ser un miembro o un rol aparte; secretaría podría o no bloquear. No incluir `bloquea_solapamiento=true` por suposición ni inventar reglas de suplencia/ausencia.

## Participantes: presidencia y secretaría

Se recomienda modelar participantes de sesión con persona y rol, con referencia opcional a `miembros_tribunal` para lectores del panel ya confirmado. Esto evita duplicar la identidad de una persona. La presidencia podría ser una asignación dentro del panel o una persona distinta; debe confirmarse. La secretaría podría asignarse a cada sesión o a un bloque de sesiones; también está pendiente. No se debe usar un rol global de cuenta como sustituto de una participación concreta.

## Relación con evaluaciones y notas

Se preserva el modelo 10.5: las evaluaciones cerradas actuales son inmutables; los puntajes compartidos se consultan a través de transferencias; la consolidación es bajo demanda y no es resultado oficial persistido. No se registra acta en esta fase.

La regla institucional posterior permite corregir nota escrita antes de la sustentación y oficializar nota final después de oral y acta, con rectificación excepcional auditada. Esto entra en conflicto con la inmutabilidad actual si se entiende como actualizar la evaluación cerrada. Futuro diseño recomendado: revisiones append-only enlazadas a la anterior, con autorización, causa y evidencia; y evento explícito de oficialización que referencia el acta. Estos no son entidades aprobadas ni se modelan como estructura actual en los DER físicos. Definir quién inicia y autoriza cada revisión, ronda/plazo, evidencia válida y registro de rectificación antes de implementar.
