# 04 — Modelo recomendado

## Principios

Este es un modelo propuesto, no un esquema creado. La recomendación es la alternativa C de `03-comparacion-alternativas.md`:

1. Una serie de cronograma contiene versiones completas.
2. Cada versión contiene una instantánea de sus sesiones.
3. `programaciones_sustentacion` evoluciona para representar esas sesiones y conserva IDs/datos legacy.
4. La versión publicada referencia la aprobación externa que cubre su contenido exacto.
5. Las reservas activas son una proyección operativa; los eventos append-only conservan decisiones e historia.
6. Se reutilizan trabajo, carrera, periodo, tribunal, miembros, personas y cuentas existentes. No se duplica identidad académica.

## Entidades del subconjunto recomendado

Las columnas descritas son candidatas para el diseño/migración futuros. Tipos, obligatoriedad, nombres definitivos y retención deben revisarse con la Universidad y la implementación.

| Tabla/entidad | Estado en este documento | Datos y relaciones candidatas | Integridad propuesta |
|---|---|---|---|
| `cronogramas_sustentacion` | Nueva propuesta | `id`, `id_periodo`, código/título, `creado_por`, fechas de creación. Es la identidad estable de una agenda; puede incluir trabajos de varias carreras. | FK al período y a cuenta creadora. Código único dentro del ámbito acordado. No duplicar el estado publicado aquí. |
| `versiones_cronograma` | Nueva propuesta | `id`, `id_cronograma`, número de versión, `id_version_previa`, estado, fecha de propuesta/publicación, referencia/folio/fecha de aprobación, cuenta que registra evidencia, motivo. | Número único por cronograma; FK de predecesora dentro del mismo cronograma; evidencia obligatoria antes de publicar; una versión publicada activa por cronograma mediante índice parcial. Una vez congelada, inmutable. |
| `programaciones_sustentacion` | Existente; se propone evolucionar como sesión | Mantener `id`, `id_trabajo`, `fecha_programada`, `hora_programada`, `sala` textual, `estado`, `scheduled_by_id_cuenta`, `creado_en`, `actualizado_en`; agregar referencia a versión, intervalo completo/zona o campos que se acuerden, referencia de sesión previa y, si procede, `id_sala`. | Cambiar unicidad por trabajo solo después de confirmar cardinalidad. FKs a trabajo y versión. Índice único de sesión dentro de versión/trabajo según regla final. Conservar valor/ID histórico de cada fila. |
| `salas_sustentacion` | Nueva propuesta | Identificador estable, código y nombre, ubicación/capacidad si el inventario lo ofrece, estado, referencia externa. | Código único según institución. Eliminar o desactivar no debe invalidar reservas históricas. FK desde la reserva, o desde sesión si así se resuelve. |
| `participantes_sesion` | Nueva propuesta | Sesión, rol en esa sesión, y referencia a `miembros_tribunal` o `personas`; snapshot mínimo solo si la política exige conservar el nombre visible al publicar. | `CHECK` de exactamente una referencia de identidad; unicidad por sesión/persona/rol; validar que un miembro pertenece al tribunal del trabajo. No crear otra identidad de estudiante/docente. |
| `reservas_recurso_sesion` | Nueva propuesta | Sesión, tipo y clave del recurso (sala/persona/miembro/asignación de tribunal/trabajo, según política), inicio/fin con zona, estado activa/liberada. | XOR de recurso tipado; `inicio < fin`; FKs normalizadas para cada tipo preferible a IDs polimórficos; exclusión temporal GiST parcial para estados que bloquean. |
| `eventos_cronograma` | Nueva propuesta | Cronograma, versión opcional, sesión opcional, actor/cuenta, instante, tipo, motivo, resumen antes/después y correlación. | Append-only; FKs a objetos locales; no almacenar secretos ni replicar documentos; insertar en la misma transacción de cada transición relevante. |

## Cardinalidades candidatas

- Cronograma `1:N` versiones.
- Versión `1:N` sesiones (instantánea completa).
- Trabajo `1:N` sesiones a través de las versiones, sujeto a confirmar si un trabajo puede tener más de una sustentación/sesión en una versión.
- Sala `1:N` reservas históricas; como máximo una reserva bloqueante en el mismo intervalo.
- Sesión `1:N` participantes y reservas.
- Cronograma/versión/sesión `1:N` eventos.
- Las carreras del cronograma se obtienen de `sesión → trabajo → carrera`. Añadir `cronograma_carreras` solo si el alcance declarado incluye carreras sin sesiones o no equivale a las carreras presentes en los trabajos.

## Aprobación externa

Para el caso base, guardar en la versión inmutable: referencia verificable al documento, folio o identificador, fecha de aprobación, actor interno que asentó evidencia, fecha de registro y, si existe, hash/ubicación documental gobernada. No se crea identidad de usuario del Consejo. No marcar una versión como aprobada solo por una bandera sin evidencia.

Si la Universidad confirma varias aprobaciones independientes o evidencia documental separada con ciclo de vida propio, reconsiderar `aprobaciones_externas_cronograma` como entidad hija. Observaciones y rechazos se conservan como eventos, sin borrar intentos previos.

## Estados candidatos

- Versión: `BORRADOR`, `PROPUESTO`, `APROBADO_EXTERNAMENTE`, `PUBLICADO`, `REEMPLAZADO`, `CANCELADO`, `FINALIZADO`.
- Sesión: conservar inicialmente `PROGRAMADA`, `COMPLETADA`, `CANCELADA`, sujeto a determinar cómo se expresa que una sesión de una versión anterior fue reemplazada. No añadir `REEMPLAZADA` a la sesión si el reemplazo es un estado de la versión.
- Reserva: candidatos `ACTIVA` y `LIBERADA`; definir si hace falta `PENDIENTE`.

Los estados son una propuesta de diseño, no reglas institucionales aprobadas. La versión es dueña del ciclo de publicación; no duplicar `estado_cronograma` en su cabecera.

## Restricciones que deben aterrizarse en una migración posterior

1. Reutilizar UUIDs y no borrar ni convertir silenciosamente filas actuales.
2. Reemplazar el índice único actual `uq_programaciones_sustentacion_work` únicamente tras resolver cardinalidad y datos duplicados potenciales fuera de este análisis estático.
3. Cambiar la relación TypeORM de trabajo desde `OneToOne` a la cardinalidad aprobada; actualizar las consultas y funciones SQL que asumen una fila única.
4. Mantener compatibilidad de lectura temporal mediante vista/adaptador si consumidores no se despliegan a la vez; nunca mantener escritura dual sin idempotencia y un dueño de verdad.
5. Registrar migración/adopción legacy y evento de corte. No fabricar evidencia de Consejo para programaciones anteriores.
6. La migración debe ser nueva y aditiva; no reescribir migraciones aplicables.
7. `synchronize: false`; triggers/índices no expresables en TypeORM permanecen definidos por SQL.

## Seguridad y acceso

Separar permisos para leer, proponer, registrar evidencia, publicar, cancelar y administrar salas. Aplicar autorización en servidor y dentro del servicio transaccional. Los detalles sobre estudiantes y contactos solo se entregan a actores autorizados. Los eventos registran actor y motivo sin guardar datos personales superfluos.
