# 04 — Revisión de concurrencia

## Estrategia existente

Las escrituras de creación y edición llaman a `pg_advisory_xact_lock(hashtext(lower(btrim(sala))))` dentro de su transacción. La consulta de solapamiento se ejecuta después de adquirir el lock, con una sentencia independiente bajo `READ COMMITTED`. Esto serializa las escrituras del servicio para salas equivalentes tras normalizar espacios y mayúsculas. Una colisión del hash puede serializar salas adicionales, pero no relaja la consulta de conflicto.

La suite PostgreSQL existente incluye un `Promise.all` entre actualizar una programación y crear otra en la misma sala; espera que una sola operación resulte exitosa. Ese caso no es una prueba de dos solicitudes POST concurrentes. No se ejecutó en 10.7C.

## Límites y escenarios pendientes

- Dos creaciones simultáneas, con trabajos distintos, sala igual y horario solapado.
- Creaciones simultáneas en salas diferentes.
- Actualizaciones simultáneas de una misma programación.
- Cambio de sala mientras otra sesión reserva la sala antigua o nueva.
- Cancelación concurrente con una creación en el intervalo que se libera.
- Confirmar en el servidor que no quedan dos filas vigentes solapadas después de cada carrera.

El advisory lock solo protege escrituras que pasan por estas rutas del servicio. Las escrituras SQL directas no adquieren este lock; la inspección no encontró una restricción de exclusión por rango que sustituya esa estrategia. No se presentan esos locks como protección ante SQL que los omita.

La cancelación actual cambia el estado dentro de una transacción y no elimina la fila. Bajo concurrencia podría producir un rechazo conservador si una creación consulta antes de que se confirme la cancelación; se requiere una prueba PostgreSQL para caracterizarlo. No se encontró evidencia estática de una doble reserva causada por las rutas de servicio revisadas.
