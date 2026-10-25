# 10.6A — Requisitos actualizados y estado

“Implementado en código” refleja lectura estática del repositorio. Los resultados históricos de pruebas informados por 10.5A/10.5B no fueron reejecutados en esta auditoría. No hubo comprobación de esquema vivo PostgreSQL: el entorno 9D configurado estaba apagado.

| Requisito | Estado | Evidencia o acción pendiente |
|---|---|---|
| Rúbricas con etapas dinámicas y ámbito explícito compartido/individual | Implementado en repositorio | Migraciones hasta `1760000008000`; valida 10.00 por etapa y conserva inmutabilidad. |
| Tribunal de dos evaluadores | Implementado, regla histórica vigente | Servicio de consolidación exige dos; miembros ocupan posiciones 1/2. |
| Evaluación compartida una vez por trabajo/evaluador y traspaso trazable | Implementado en repositorio | Asociación evaluación/estudiante; consolidación lee la fuente original vía traspaso sin duplicar puntajes. |
| Evaluación individual por estudiante/evaluador | Implementado en repositorio | Scope de etapa gobierna selección; no depende del nombre. |
| Cálculo dinámico y exacto bajo demanda | Implementado en repositorio | Racionales BigInt; promedios exactos por etapa y final; HALF_UP a dos decimales solo para presentación. |
| No producir resultado definitivo si faltan cierres | Implementado en repositorio | Respuesta incluye estados, etapas y evaluadores pendientes. Solo CLOSED evaluaciones alimentan consolidación. |
| No mezclar evaluaciones legacy y dinámicas | Implementado en repositorio | Legacy se marca `LEGACY_NO_CONSOLIDADA`/excluida; no se adapta automáticamente. |
| Consulta individual y por trabajo con autorización | Implementado en repositorio | Capacidades de lectura de evaluación y validación de pertenencia al trabajo. |
| Consulta no modifica estado/nota/auditoría | Implementado en código | Transacción de lectura `REPEATABLE READ`; sin tabla consolidada persistida ni transición de estado. |
| Nota escrita puede ser preliminar y corregirse durante subsanación | Regla confirmada, implementación pendiente | Contradice editar una evaluación cerrada, hoy prohibido. Definir flujo de nueva revisión enlazada, actores, límites, motivo y evidencia. |
| Resultado oficial definitivo solo tras sustentación y acta | Regla confirmada, implementación pendiente | Consolidación actual es resultado calculable, no resultado oficial; falta evento/registro explícito de oficialización y vínculo al acta. |
| Rectificación excepcional del resultado oficial auditada | Regla confirmada, diseño pendiente | Preservar versión oficial previa; nueva revisión append-only con autorización, causa, evidencia y acta rectificatoria. |
| Acta y documento institucional | Fuera del alcance del esquema actual | Confirmar si Sistema 2 almacena documento, firma, referencia y estados. |
| Cronogramas por carrera/periodo versionados | Propuesta técnica, no implementada | Validar cardinalidad, roles, aprobación externa, duración y publicación. |
| Consejo aprueba el cronograma fuera de Genares | Regla institucional confirmada | Guardar en futuro referencia y fecha; no crear login del Consejo. |
| Conflictos simultáneos de sala y personas | Pendiente de política | Determinar qué estados bloquean y qué roles/personas pueden coincidir; aplicar constraint transaccional. |
| Integración con sistemas 1–3 | Pendiente de contrato | Dueño de carrera, periodo, trabajo/estudiantes, documento y tribunal; claves y eventos. |
| Zona horaria Ecuador continental | Propuesta técnica | Confirmar zona IANA y tratamiento de cambios horario/DST; persistir instantes `timestamptz`. |

## Distinciones obligatorias para la futura API

- `evaluación cerrada`: snapshot individual inmutable bajo el modelo actual.
- `consolidación calculable`: agregación exacta que cumple etapas/evaluadores obligatorios.
- `resultado oficial`: resultado académico confirmado al completarse sustentación y acta, todavía no modelado.
- `rectificación oficial`: nuevo evento/resultante que conserva trazabilidad, no un `UPDATE` del histórico.

La decisión de redondeo `HALF_UP`, a dos decimales, aplica a presentación final según regla académica. No se debe cambiar precisión de indicadores ni redondear promedios intermedios.
