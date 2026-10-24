# 10.7A — Resumen ejecutivo

## Hallazgo

El sistema actual no implementa un módulo de cronogramas versionados. En PostgreSQL existe `programaciones_sustentacion`, una fila por trabajo con fecha, hora sin zona, sala textual, estado y cuenta que programa. No hay duración, salas normalizadas, agenda para varias carreras, publicación versionada, aprobación del Consejo ni auditoría específica de cambios. React permite editar datos en el prototipo local; la auditoría estática no encontró un módulo NestJS/API que gestione esa programación.

Hay dependencias SQL sensibles: un trigger exige dos evaluaciones escritas cerradas antes de insertar/cambiar el trabajo de una programación; otro crea notificaciones cuando cambia fecha/hora/sala; las reglas de evaluación oral consultan la programación y descartan la cancelada. Por ello, alterar la tabla exige migrar de manera coordinada triggers y funciones SQL, además de actualizar TypeORM y consumidores.

## Simplificación evaluada

El DER de 10.6B propone nueve responsabilidades. Se recomienda mantener seis tablas nuevas (cronograma, versiones, salas, participantes, reservas y eventos); fusionar sesiones en la tabla actual evolucionada; guardar evidencia externa en la versión; y aplazar `cronograma_carreras`, porque las carreras pueden derivarse de los trabajos de cada sesión. El esquema final considerado tiene seis tablas nuevas y una existente reutilizada; no implica borrar ni eliminar historial.

## Recomendación

Adoptar **Alternativa C** como objetivo: evolucionar `programaciones_sustentacion` para que sea la fuente única de sesiones versionadas. Cada nueva versión es una copia completa e inmutable; aprobación externa, publicación, reemplazo y reservas se conservan con evidencia/eventos. Publicar y reemplazar debe ser atómico, con restricciones temporales PostgreSQL que protejan frente a carreras concurrentes.

La recomendación es condicional. Cambiaría la relación uno-a-uno con trabajo, el índice único y SQL dependiente. Antes se necesita inventariar consumidores, preservar IDs/datos, definir corte y decidir el tratamiento de filas vigentes cuya aprobación no conste. Si no se puede hacer un corte coordinado, la alternativa B puede ser una transición explícita, pero conserva dos tablas de sesiones y requiere una fecha de retiro del legado.

## Decisiones que faltan

La Universidad debe definir el destino de programaciones legacy; quién aprueba y qué documento acredita aprobación; cardinalidad trabajo/sesión; periodo y alcance por carrera; duración y zona horaria; inventario de salas; roles/personas cuyo solapamiento bloquea; momento de reserva; contratos externos y notificaciones. Las preguntas están detalladas en `09-preguntas-institucionales.md`.

## Estado de esta entrega

Solo se preparan documentos y dos diagramas Mermaid bajo `docs/cronograma-10.7a/`. No se modifican React, backend, migraciones, configuración, documentación 10.6A/10.6B ni base de datos. No se abrió PostgreSQL, no se ejecutaron pruebas, build o migraciones, no se creó commit y no se hizo push. El DER representa diseño propuesto y no aprobación institucional.
