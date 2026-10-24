# 05 — Regresión de evaluaciones académicas

## Revisión estática

- El estado operativo de sustentación es independiente de `evaluaciones` en el servicio: las transiciones actualizan la fila de programación y sus horas reales.
- Cancelar cambia el estado a `CANCELADA`; no borra evaluaciones.
- La tabla base conserva FKs restrictivas para programación y evaluaciones; la migración 1100 solo cambia el enum operativo y agrega campos de cronograma.
- Las funciones/triggers de evaluación permanecen declarados en las migraciones anteriores. Sus consultas que excluyen `CANCELADA` se apoyan en el enum y no nombran exclusivamente `COMPLETADA`.
- La suite `evaluaciones.postgres.e2e.spec.ts` toma una instantánea de las evaluaciones escritas y del estado del trabajo antes de gestionar una programación y compara esos valores al final.
- El mismo flujo crea una evaluación oral y verifica que no se pueda cambiar la programación después de iniciarla.

## Resultado y límites

La revisión no demuestra comportamiento en una instancia PostgreSQL: la suite E2E no se ejecutó. Por ello quedan pendientes la comprobación de que los cierres, calificaciones, consolidaciones, permisos y triggers se mantienen en ejecución real, así como que cancelar una programación con evaluaciones asociadas no cambia las notas.

Los resultados académicos históricos no fueron leídos ni modificados. No se afirma que se hayan probado datos históricos reales; las pruebas del repositorio usan fixtures.
