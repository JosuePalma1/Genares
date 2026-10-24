# Genares — Etapa 10.7A

## Estado

**Completada como propuesta documental; no implementada.** Se contrastaron los DER 10.6A/10.6B con migraciones, entidades, módulos, servicios, rutas y consumidores React del repositorio. No se consultó PostgreSQL.

## Decisión recomendada

Se recomienda la **Alternativa C: evolucionar `programaciones_sustentacion` para que conserve el rol de sesión**, agregando seis tablas nuevas: `cronogramas_sustentacion`, `versiones_cronograma`, `salas_sustentacion`, `participantes_sesion`, `reservas_recurso_sesion` y `eventos_cronograma`.

No crear una segunda tabla de sesiones ni una tabla separada de aprobaciones para el caso base. La evidencia de una aprobación externa se guarda en la versión inmutable; las carreras se obtienen desde los trabajos de sus sesiones. La decisión requiere una migración futura revisada y un plan para filas vigentes cuya aprobación externa no consta en la base.

La recomendación queda condicionada a las decisiones institucionales listadas en [preguntas pendientes](09-preguntas-institucionales.md), especialmente el tratamiento de programaciones activas al corte, zona horaria, salas y roles con bloqueo de agenda.

## Entregables

- [01 — Auditoría de programación actual](01-auditoria-programacion-actual.md)
- [02 — Matriz de simplificación de las nueve entidades](02-matriz-simplificacion.md)
- [03 — Comparación de alternativas](03-comparacion-alternativas.md)
- [04 — Modelo recomendado](04-modelo-recomendado.md)
- [05 — Ciclo de vida y versiones](05-ciclo-vida-y-versiones.md)
- [06 — Conflictos y reservas](06-conflictos-y-reservas.md)
- [07 — Integración externa](07-integracion-externa.md)
- [08 — Casos de prueba conceptuales](08-casos-prueba.md)
- [09 — Preguntas institucionales](09-preguntas-institucionales.md)
- [10 — Resumen ejecutivo](10-resumen-ejecutivo.md)
- [11 — DER simplificado para compartir](11-der-cronograma-simplificado.mmd)
- [12 — DER técnico del subconjunto](12-der-cronograma-tecnico.mmd)

## Límites

Se añadieron únicamente documentos nuevos en `docs/cronograma-10.7a/`. Los archivos originales de 10.6A/10.6B permanecen intactos. No se modificó código, esquema, migraciones, configuración o base de datos; no se ejecutaron builds ni pruebas; no se creó commit ni se hizo push. Se verificaron los destinos de enlaces locales y las referencias de entidades/nodos Mermaid; los diagramas no se renderizaron.
