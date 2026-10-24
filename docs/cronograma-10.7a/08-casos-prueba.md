# 08 — Casos de prueba conceptuales

Estos casos describen criterios para una implementación futura. No son pruebas ejecutadas; en 10.7A no se conectó a PostgreSQL ni se ejecutó build o suite funcional. La preparación de fixtures debe usar una base desechable verificada y las salvaguardas 9D.

| ID | Caso | Preparación/acción | Resultado esperado |
|---|---|---|---|
| C01 | Crear calendario con más de una carrera | Borrador con trabajos de carreras diferentes en el mismo periodo | La carrera se deriva por sesión/trabajo; no se requiere tabla puente salvo decisión institucional. |
| C02 | Propuesta incompleta | Enviar una versión con sesión sin hora, duración/fin, trabajo o evidencia requerida | Se rechaza con errores por campo; no cambia estado ni crea reservas. |
| C03 | Evidencia de aprobación | Registrar evidencia referida a versión A y tratar de publicar versión B | Se rechaza; la evidencia debe cubrir el contenido exacto publicado. |
| C04 | Publicación y reservas atómicas | Publicar una versión válida con sala disponible | Versión, reservas y eventos se confirman en conjunto; fallo de cualquier inserción revierte todo. |
| C05 | Choque de sala | Incluir dos sesiones con rangos solapados y la misma sala bloqueante | Restricción de PostgreSQL impide la publicación; no queda publicación parcial. |
| C06 | Intervalos contiguos | Sesiones consecutivas con fin e inicio iguales | Resultado conforme a convención `[inicio, fin)` aprobada; no hay choque si no se exige pausa. |
| C07 | Choque de tribunal/persona | Colocar un lector confirmado en dos sesiones simultáneas | Bloquea solo si la política institucional define ese recurso como exclusivo; si no, informa aviso y registra decisión. |
| C08 | Carrera concurrente por la misma sala | Dos transacciones intentan publicar reservas solapadas simultáneamente | Exactamente una confirma; la otra falla por exclusión/serialización, sin duplicar agenda publicada. |
| C09 | Reprogramar | Copiar una versión publicada, mover una sesión y publicar sucesora | Nueva versión contiene instantánea completa; original permanece idéntica; se reemplaza solo en transacción atómica. |
| C10 | Sesiones que no cambian | Crear una sucesora sin cambios en cierto trabajo | La sesión queda copiada y vinculada al antecedente; el diff/evento muestra que no cambió. |
| C11 | Cancelar propuesta | Cancelar borrador/propuesta con motivo | Evento append-only y estado conforme al flujo aprobado; ninguna reserva publicada se libera por accidente. |
| C12 | Cancelar versión publicada | Cancelar con reservas activas | Autorización y alcance validados; reservas pertinentes liberadas atómicamente, notificaciones idempotentes y versión conservada. |
| C13 | Preservar filas legacy | Migrar fixtures que representan registros programados, completados y cancelados | UUID, fecha, hora, sala, estado, actor y relaciones sobreviven; ningún dato se interpreta como aprobación externa sin evidencia. |
| C14 | Integridad de cardinalidad | Intentar agregar dos sesiones para el mismo trabajo en una versión | La regla se aplica exactamente como la Universidad resuelva si es una sesión por trabajo o por estudiante. |
| C15 | Cambio de tribunal tras aprobar | Cambiar la fuente del tribunal antes de publicar | Se revalida dentro de la transacción; se bloquea o exige nueva aprobación según regla acordada, sin mutar versión previa. |
| C16 | Auditoría | Publicar, reemplazar, cancelar y liberar una reserva | Cada transición tiene actor, fecha, motivo y correlación; eventos previos no se actualizan/eliminan. |
| C17 | Permisos | Actor sin autorización intenta proponer, cargar evidencia, publicar, cancelar o administrar sala | Cada acción se deniega por separado en servidor y no produce mutaciones ni eventos de éxito. |
| C18 | Integridad de FK e identidad | Asociar miembro que no pertenece al tribunal del trabajo o persona inexistente | La transacción se rechaza; identidad/persona no se duplica ni queda referencia huérfana. |
| C19 | Notificación única | Publicar/reemplazar una versión con cambios de sesión | Se notifica a destinatarios aprobados una vez por evento; no hay duplicación por trigger legacy más nuevo servicio. |
| C20 | Lectura histórica | Consultar versión anterior después de reprogramar/cancelar | Se devuelven datos y eventos de esa versión; no se confunden con reservas operativas actuales ni se exponen a actor no autorizado. |

## Preparación y protección PostgreSQL

Para una etapa de implementación, validar identidad del servidor/base/puerto antes de migrar o probar; usar solo PostgreSQL 9D desechable y bases temporales verificadas. No ejecutar pruebas contra 5432 ni la base persistente 8E, no borrar bases temporales antiguas y no recrear ambientes ajenos. Este documento no ejecutó SQL.
