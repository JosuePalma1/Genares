# 10.6A — Resumen para reunión institucional

## Qué muestra la auditoría

- El backend actual tiene 29 tablas declaradas por las migraciones y 29 entidades TypeORM con los mismos nombres. Hay restricciones SQL importantes (triggers, índices parciales y claves compuestas) que no se expresan completamente en decoradores.
- Rúbricas, etapas, evaluaciones, transferencias y auditoría ya son dinámicas. Las etapas expresan explícitamente si se califican por trabajo o por estudiante.
- La consolidación actual se calcula al consultar, de forma exacta y con `HALF_UP` a dos decimales. Exige dos lectores. Si falta un cierre, identifica pendientes y no emite final. No mezcla el modelo legacy y no persiste resultados derivados.
- La programación existente solo registra fecha, hora, sala textual y estado por trabajo. No es un sistema de cronogramas versionados: faltan catálogo/choque de salas, duración, zona, agenda de varias carreras, aprobación externa y reprogramación auditable.
- La base 9D está configurada como desechable, pero se encontraba apagada. Por seguridad, esta etapa no ejecutó SQL ni alteró bases.

## Nueva regla que requiere diseño

La nota escrita puede ser preliminar y corregirse en subsanación; la nota definitiva se determina después de sustentación y acta; excepcionalmente se rectifica con auditoría. Hoy `CERRADA` hace inmutable la evaluación y la consolidación completa no es oficial. No se debe reabrir o sobrescribir la historia: se recomienda diseñar revisiones append-only enlazadas a la nota anterior y un evento de oficialización asociado al acta.

## Propuesta de cronograma

Añadir de manera futura entidades de cronograma, relación con carreras, versiones, salas, sesiones, constancia de aprobación y eventos append-only. Publicación requiere evidencia externa del Consejo; no crear cuenta del Consejo. Reprogramar crea nueva versión. Chequeo de solapamiento de sala debe ser transaccional; reglas de simultaneidad por personas y cuándo reservar se definen con la institución.

## Decisiones que necesitamos de la Universidad

1. Dueño y contrato de datos de cada uno de los cuatro sistemas; confirmar si equipos 2 y 3 comparten responsabilidad.
2. Contenido de constancia de aprobación del Consejo y quién registra/publica.
3. Duración/pausas y política de conflictos para salas, lectores, presidencia y secretaría.
4. Reglas de revisión escrita, quién autoriza rondas, evidencia y plazo.
5. Evento exacto que hace oficial la nota y rol/documento del acta; proceso excepcional de rectificación.
6. Zona horaria y canales de notificación.

## Límite de la entrega

Esta entrega contiene únicamente análisis, diccionario, tres diagramas editables y requisitos/preguntas. No cambia React, backend, migraciones, base de datos ni documentos institucionales y no ejecuta pruebas o build. No implementa 10.6B/cronograma ni nuevas reglas de evaluación.
