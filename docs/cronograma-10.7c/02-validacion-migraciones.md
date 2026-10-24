# 02 — Revisión de migraciones

## Alcance de la revisión

Se inspeccionó el orden de las migraciones versionadas. Las dos relevantes al cronograma son:

1. `1760000010000-conflicto-exacto-sala-programacion.ts`
2. `1760000011000-duracion-y-estados-operativos-sustentaciones.ts`

La inspección fue estática. No se afirma que el SQL haya sido aceptado por PostgreSQL.

## Comportamiento observado en el código

- La migración 1000 verifica conflictos vigentes con la misma fecha, hora y sala normalizada antes de crear un índice único parcial que excluye `CANCELADA`.
- La migración 1100 reemplaza ese índice mientras amplía la validación histórica a intervalos usando la duración inicial de 60 minutos.
- Añade `duracion_estimada_minutos` (por defecto 60 y rango 1–240), `inicio_real_en` y `finalizacion_real_en` nullable.
- Convierte el enum `COMPLETADA` a `FINALIZADA`; no genera horas reales para filas anteriores.
- Recrea el índice de inicios idénticos y la definición base conserva la unicidad de `id_trabajo` y la FK de programación.
- El down-migration conserva una protección que impide revertir mientras haya filas `EN_SUSTENTACION`.

## Pendiente en PostgreSQL

- Aplicar las doce migraciones desde una base 9D nueva y exclusiva, en orden.
- Inspeccionar en PostgreSQL columnas, tipos, defaults, índices, claves foráneas y triggers después de migrar.
- Crear un caso sintético con dos intervalos históricos solapados y comprobar que 1100 falla de manera transaccional, sin dejar cambios parciales.
- Comprobar la conversión de una fila histórica `COMPLETADA` y confirmar que ambas horas reales continúan `NULL`.
- Comparar `UNIQUE(id_trabajo)` y triggers de evaluación antes y después.

No se modificó ni aplicó ninguna migración en esta etapa.
