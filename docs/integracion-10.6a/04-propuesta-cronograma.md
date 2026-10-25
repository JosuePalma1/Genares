# 10.6A — Propuesta de modelo para cronograma de sustentaciones

## Propósito

Propuesta para revisión; no es decisión de implementación ni migración. Extiende la tabla básica actual sin mutar ni borrar `programaciones_sustentacion`. Busca ordenar sesiones por periodo y carrera, publicar versiones auditables, enlazar trabajo/tribunal existentes y resolver disponibilidad de salas.

## Entidades nuevas propuestas

| Tabla propuesta | Campos principales | Claves/relaciones y reglas candidatas |
|---|---|---|
| `cronogramas_sustentacion` | `id uuid`, código, nombre, periodo, zona horaria IANA, revisión, estado de cabecera?, creador, creado_en | Periodo FK; código único dentro del periodo; zona horaria explícita (propuesta inicial `America/Guayaquil`); la lista de carreras queda en la relación siguiente. |
| `cronograma_carreras` | `id_cronograma`, `id_carrera`, asociado_en | PK compuesta cronograma+carrera; FKs restrict. Permite reunir una o varias carreras según decisión institucional. |
| `versiones_cronograma` | `id`, cronograma, número, versión anterior?, estado, revisión, creado_por, propuesto_en?, aprobado_en?, publicado_en? | Cronograma FK; número único por cronograma; self-FK para clonación; cambios de borrador editables; estados publicados/finalizados inmutables; toda corrección crea versión nueva. |
| `salas_sustentacion` | `id`, código, nombre, ubicación?, activa | Código único normalizado; el catálogo es transversal a carreras para encontrar conflictos físicos globales. Edificio/campus requieren inventario institucional confirmado. |
| `sesiones_sustentacion` | `id`, versión, trabajo, tribunal confirmado, sala, inicio/fin `timestamptz`, estado, perfil docente presidente?, cuenta/persona de secretaría?, revisión | Trabajo único por versión; FKs restrict; `fin > inicio`; intervalo semiabierto `[inicio, fin)`; tribunal debe pertenecer al trabajo y seguir confirmado. Hora se guarda como instante y se presenta en zona del cronograma. |
| `aprobaciones_externas_cronograma` | `id`, versión única, órgano, referencia/acta, fecha de aprobación, referencia documental?, registrado_por, registrado_en | FK versión; captura evidencia emitida fuera del sistema. El Consejo no recibe cuenta/rol dentro de Genares por esta propuesta. |
| `eventos_cronograma` | `id`, versión, sesión?, actor, acción, antes/después JSONB, motivo?, correlación?, ocurrido_en | FKs restrict; JSON objeto; append-only; cambios de sala/horario, propuesta, aprobación, publicación, cancelación y reemplazo trazables. |

Los campos `presidente` y `secretaría` son una simplificación inicial que debe validarse: el tribunal ya contiene dos lectores y el esquema actual no identifica presidencia. Si hay participantes o recursos adicionales, incorporar una tabla de asignaciones genérica tras acordar roles; no inventarlos aquí.

## Estados y flujo propuestos

Estados candidatos de `versiones_cronograma`: `BORRADOR → PROPUESTO → APROBADO_EXTERNAMENTE → PUBLICADO → FINALIZADO`; `CANCELADO` puede finalizar una propuesta anulada y `REEMPLAZADO` señala una publicación sustituida. Aprobación se registra como evidencia y no como autenticación del Consejo en Genares.

1. Secretaría/Comisión arma un borrador desde trabajos habilitados externamente, asignación confirmada del sistema 3 y candidatos de sala/disponibilidad.
2. Comisión revisa y envía propuesta al órgano externo; se congela la versión candidata para aprobación.
3. Comisión registra referencia y fecha de aprobación externa, publica esa versión y se envían avisos según canales por definir.
4. Reprogramar una publicación clona versión y genera eventos; no sobreescribe horarios previamente publicados. Una sesión realizada referencia las evaluaciones existentes y su cierre, sin recalcular/editar nota.
5. Cierre de cronograma no cambia automáticamente estados académicos ni genera actas.

## Integridad, concurrencia y seguridad candidatas

- Toda sesión referencia un trabajo, su tribunal confirmado y una sala; trigger o servicio transaccional valida que el tribunal corresponde al trabajo. Una pareja compuesta `(id_asignacion_tribunal,id_trabajo)` requeriría `UNIQUE` en la tabla padre o validación SQL explícita.
- Las colisiones de sala se comprueban globalmente entre carreras. Se recomienda exclusión PostgreSQL sobre `(id_sala, tstzrange(inicio, fin, '[)'))` en una tabla de reservas activas; `btree_gist`/disponibilidad de extensión deben confirmarse. La comprobación debe incluir bloqueo transaccional para evitar carreras de concurrencia. Una alternativa es reserva materializada por sesión con constraint `EXCLUDE` y liberar al cancelar/reemplazar.
- No decidir todavía si borradores/propuestas reservan sala, si solo publicación bloquea, ni qué roles humanos no pueden solaparse. El solapamiento de presidente/lectores/secretaría requiere política por función y simultaneidad permitida; no bloquear todas las coincidencias de persona sin regla académica.
- Usar intervalos semiabiertos (`[inicio, fin)`) para permitir sesiones consecutivas sin falso solapamiento. No fijar duración, pausa ni aforo sin confirmación.
- `timestamptz` representa instante UTC; retener la zona IANA del cronograma para visualización y cambios horarios. No usar una hora local sin zona como única verdad.
- Autorizar endpoints en backend según capacidad y alcance de carrera, revalidando alcance al guardar/publicar; el cliente no decide aprobaciones ni conflictos.
- Auditoría append-only con actor autenticado, motivo para reprogramación/cancelación, correlación, valores previos/nuevos; no guardar secretos o documentos completos en JSON.

## Integración con el flujo institucional

- Sistema 1 entregaría identidad canónica de carrera/periodo, estudiantes y trabajos elegibles.
- Sistema 2 entregaría estado de revisión documental y referencias documentales.
- Sistema 3 entregaría asignación confirmada y miembros del tribunal (incluida presidencia si realmente la mantiene).
- Genares es dueño de la propuesta/versión de agenda, sala, hora publicada, notificación de convocatoria y evaluación ya cubierta por el backend.
- Consejo de Facultad aprueba externamente; Genares registra la constancia.

No hay contratos de integración documentados en el repo. Se requiere decidir identificadores canónicos, responsables y mecanismo de sincronización antes de diseñar FK/UUID/tabla de correspondencia.

## Relación con evaluaciones y regla de calificación nueva

La tabla actual `programaciones_sustentacion` seguirá siendo histórico compatible. El mapeo de filas antiguas al nuevo concepto debe ser de solo lectura o migración explícita y reversible; no actualizar historial automáticamente.

La regla externa nueva entra en tensión con la inmutabilidad de evaluación cerrada. Opción técnica recomendada para análisis posterior: cada evaluación cerrada conserva su snapshot inmutable y cualquier corrección se registra como revisión nueva enlazada a la previa, con actor, motivo y evidencia; la etapa escrita puede ser preliminar y solo una consolidación aprobada tras sustentación/acta se declara oficial. Para rectificar un resultado oficial, agregar revisión append-only que refiera resultado anterior y acta rectificatoria, nunca sobrescribirlo.

Antes de implementarlo, la Universidad debe determinar cuándo se permite corregir, quién autoriza, cómo intervienen los dos lectores, qué acta es fuente final, y si la calificación oficial guarda el detalle por estudiante o solo resultado colegiado. No tocar notas cerradas, resultados o estados históricos en esta etapa.

## Fuera de alcance y migración futura

Esta propuesta no altera código, API, tablas, documentos ni migraciones. Si se aprueba, el trabajo futuro requiere nueva migración aditiva posterior a `1760000009000`, API y autorización, contratos externos y pruebas concurrentes. No usar `synchronize`.
