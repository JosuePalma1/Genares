# Genares 10.6B — resumen ejecutivo

## Qué verificamos

El repositorio declara 29 tablas en 10 migraciones y 29 entidades TypeORM con los mismos nombres. La comparación es estática: PostgreSQL 9D estaba apagado, así que no se inspeccionó la base viva ni se verificó qué migraciones aplicó. Dos columnas legacy de `versiones_rubrica` y una columna legacy de `categorias_rubrica` continúan en SQL pero no están mapeadas como columnas físicas en TypeORM. Claves compuestas, índices parciales y triggers contienen reglas que no se ven completas en los decoradores.

El modelo de programación actual solo guarda fecha, hora sin zona, sala como texto y estado, con una fila por trabajo. No tiene sesiones de agenda versionadas, duración, inventario de salas ni historial de reemplazos.

## Qué entregamos

- DER A del modelo SQL actual.
- DER B con nueve entidades propuestas `PROP_` para cronogramas, versiones, sesiones, aprobaciones, participantes, recursos y auditoría.
- DER C conceptual para dominios externos de elegibilidad académica, documentación y tribunales, más Genares.
- Flujo de integración 10.6A conservado como flowchart separado, no presentado como entidad-relación.
- Diccionario con los nombres físicos correctos, matriz comparativa y recomendaciones de compatibilidad.

## Recomendación

Conservar `programaciones_sustentacion` como antecedente legacy y migrar las futuras programaciones a sesiones versionadas mediante una fecha de corte acordada. Evitar escritura dual. Capturar evidencia de aprobación externa por versión, publicar y reservar recursos en una única transacción, y mantener eventos append-only. Las exclusiones de sala/persona son una propuesta técnica; la simultaneidad por roles debe definirla la Universidad.

La nota escrita puede corregirse antes de la sustentación y el resultado oficial se define después de sustentación y acta, con rectificación excepcional auditada. Se recomienda diseñar revisiones append-only y un evento explícito de oficialización, pero no se implementa ni se aprueba una nueva estructura en esta entrega. Se preservan las reglas de 10.5: consolidación calculable bajo demanda, dos lectores, etapas dinámicas, precisión exacta y redondeo `HALF_UP` solo en presentación final.

## Decisiones para la reunión

1. Confirmar sistemas maestros y responsables de los datos compartidos.
2. Definir fuente oficial de trabajo/integrantes y asignación de tribunal.
3. Acordar evidencia del Consejo, quién la registra y cuándo se publica.
4. Definir salas, intervalos, roles que bloquean solapamientos, zona horaria y cuándo reservar.
5. Definir revisión de nota escrita y oficialización/rectificación asociada al acta.

## Límites de la entrega

Solo se añadieron documentos en `docs/integracion-10.6b/`. No se cambió frontend, backend, migración ni base. No se ejecutaron pruebas o build. No se afirma renderizado gráfico de los Mermaid porque no había renderizador disponible. La documentación original 10.6A queda intacta.
