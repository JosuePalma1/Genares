# Requisitos actualizados y estado

## Claves de estado

- **Implementado según código:** inspección estática encuentra el comportamiento; no significa que se comprobó en una base viva en esta etapa.
- **Regla confirmada:** aclaración institucional comunicada en las etapas anteriores.
- **Propuesta:** solución de diseño por validar.
- **Pendiente:** requiere contrato o decisión de la Universidad.

## Evaluación, notas y oficialización

| Requisito | Estado | Evidencia/pendiente |
|---|---|---|
| Rúbricas dinámicas con ámbito compartido/individual explícito | Implementado según código | Migraciones hasta `1760000008000`; ámbito no se deduce del nombre. |
| Dos evaluadores | Implementado según código y regla vigente | Asignación en posiciones 1/2; triggers de cierre del tribunal. No se cambia este número. |
| Escrita compartida transferida a cada integrante sin duplicar puntaje | Implementado según código | Asociación trazable en `traspasos_evaluacion_estudiante`; la consolidación toma origen mediante esa relación. |
| Oral individual | Implementado según código | Selección por ámbito de etapa y estudiante. |
| Consolidación variable por número de etapas | Implementado según código | Se calcula bajo demanda; promedio exacto por etapa y promedio aritmético entre etapas. Sin ponderaciones nuevas. |
| Precisión académica y redondeo | Regla confirmada e implementada según código | Aritmética racional exacta y `HALF_UP` a dos decimales en representación final; no redondea promedios intermedios. |
| No finalizar con cierres faltantes | Implementado según código | Distingue sin evaluaciones, en progreso, cerradas incompletas y completas; informa etapas/evaluadores pendientes. |
| No mezclar calificaciones legacy con consolidación dinámica | Implementado según código | Los datos legacy conservan su recorrido y no se adaptan automáticamente. |
| Lectura autorizada y pertenencia estudiante/trabajo | Implementado según código | Consulta exige capacidad de lectura y verifica la pertenencia. |
| Consulta de consolidación sin mutación | Implementado según código | Lectura transaccional; sin persistir derivados ni cambiar estado, puntaje o auditoría. |
| Escrito preliminar corregible antes de sustentación | Regla confirmada; implementación pendiente | Hoy una evaluación cerrada es inmutable. Diseñar revisión append-only, autorizaciones, evidencia, límite/plazo y causa. |
| Resultado oficial tras sustentación oral y acta | Regla confirmada; implementación pendiente | Consolidación actual es calculable, no oficial. Falta evento de oficialización y referencia documental. |
| Rectificación excepcional auditada | Regla confirmada; diseño pendiente | Definir rol, motivo/evidencia, acta rectificatoria y enlace a resultado previo. No sobrescribir historia. |
| Cronogramas y sesiones versionados | Propuesta técnica | Alternativa A de compatibilidad recomendada en `07-decisiones-cronograma.md`; exige autorización e implementación futura. |
| Consejo aprueba fuera de Genares | Regla institucional confirmada | Guardar futura evidencia externa; no crear usuario/cuenta Consejo. |
| Conflictos de sala/persona concurrentes | Propuesta técnica; política pendiente | Intervalo y exclusiones transaccionales recomendados. Definir estados y roles que bloquean. |
| Presidencia y secretaría en sesiones | Pendiente | Confirmar si presidencia forma parte del panel y si secretaría se agenda por sesión o bloque. |
| Zona horaria | Pendiente de confirmación | Guardar `timestamptz` y zona IANA. `America/Guayaquil` es candidata, no decisión. |
| Integración con Sistemas 1–3 | Pendiente de contrato | Dueño, claves, eventos/endpoints, permisos y recuperación ante fallas. |
| Esquema PostgreSQL vivo 9D | No verificado | Puerto 55441 estaba cerrado. Los hallazgos son comparación estática de SQL/TypeORM. |

## Límites de esta etapa

10.6B verifica y prepara modelos editables. No modifica código ni base, no cambia el modelo 10.5, no crea persistencia de resultados/actas/revisiones, no convierte notas históricas y no incorpora ponderaciones, decisiones de aprobación/reprobación o reglas de ausencia. No se ejecutaron pruebas ni build por ser documentación solamente.
