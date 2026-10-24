# 03 — Escenarios de horarios

## Comportamiento inspeccionado

`ProgramacionesSustentacionService.exigirSalaDisponible` toma un advisory lock transaccional a partir de la sala normalizada y en una sentencia posterior revisa intervalos semiabiertos. La condición compara fecha y hora con la duración y excluye filas `CANCELADA`. La creación y edición usan esta validación en transacción; la edición excluye su propia fila. Las validaciones de DTO y dominio limitan duración a enteros entre 1 y 240.

La suite existente `evaluaciones.postgres.e2e.spec.ts` contiene un flujo que prueba un solapamiento parcial, otra sala, un horario consecutivo, la liberación tras cancelación y un cambio de sala/fecha. La suite **no se ejecutó** en esta etapa: sus resultados previos no se atribuyen a esta ejecución.

## Matriz requerida y situación

| Caso | Evidencia disponible | Resultado 10.7C |
|---|---|---|
| 09:00–10:00 seguido de 10:00–11:00, misma sala | Caso consecutivo en la suite PostgreSQL existente | Pendiente de ejecución |
| Solapamiento parcial | Caso 11:30 contra reserva 11:00 de 90 min | Pendiente de ejecución |
| Solapamiento con reserva más larga | Código compara ambas duraciones | Inspección estática; pendiente SQL |
| Sala diferente | Caso en otra sala | Pendiente de ejecución |
| Cancelación libera intervalo | Flujo de cancelación y nueva reserva | Pendiente de ejecución |
| Cambiar duración y detectar conflicto | Edición invoca validación con nueva duración; no hay aserción dedicada identificada | Pendiente de prueba de regresión |
| Cambiar sala o fecha y revalidar | Edición invoca la validación para los datos nuevos | Pendiente de ejecución |
| Duración menor que 1 o mayor que 240 | Validadores unitarios cubren límites; prueba PostgreSQL cubre 241 | Unitarias aprobadas; caso SQL pendiente |

No se declaró ningún escenario PostgreSQL como aprobado. El detalle de la cobertura concurrente queda en [04](04-pruebas-concurrencia.md).
