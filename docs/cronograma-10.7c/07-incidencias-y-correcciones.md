# 07 — Incidencias y correcciones

## Bloqueo de validación

No estaba disponible una instancia que se pudiera demostrar como PostgreSQL 9D: el puerto permitido `55441` no tenía listener y los recursos locales de conexión esperados estaban ausentes. Otros procesos PostgreSQL no se atribuyeron a 9D. Conforme a las salvaguardas, no se conectó a ellos, no se inició un clúster no identificado y no se intentó crear una base o modificar roles.

Esto deja sin evidencia ejecutada las migraciones, las restricciones reales, la concurrencia, la regresión PostgreSQL y las consultas API contra persistencia.

## Hallazgos de cobertura

- No hay una aserción identificada que pruebe específicamente que aumentar la duración de una reserva hasta producir solapamiento devuelve conflicto.
- La suite actual prueba una actualización concurrente frente a una creación, no dos creaciones simultáneas.
- No hay evidencia ejecutada de la reversión transaccional de 1100 ante un solapamiento histórico sintético.
- La pantalla del cronograma no tiene una prueba de componente dedicada identificada; el build y las pruebas generales sí pasaron.

## Correcciones

No se encontró un defecto reproducible que pudiera corregirse y verificarse sin la base requerida. No se modificaron lógica, pruebas existentes o migraciones en esta etapa. Se añadieron solamente los nueve documentos de validación solicitados. No se hizo commit ni push; todos los cambios preexistentes se conservaron.
