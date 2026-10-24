# 06 — Frontend e impresión

## Pruebas y build ejecutados

- Vitest: 36 archivos aprobados, 187 pruebas aprobadas.
- Vite producción: build aprobado. Emitió una advertencia porque el bundle JS minificado es 670.86 kB, sobre el umbral predeterminado de 500 kB.
- Los tests del servicio de programaciones cubren serialización de filtros, mapeo de creación/edición, actualización de estado operativo, adaptación del estado legacy y respuestas inválidas.

## Inspección de `PaginaCronograma.jsx`

La pantalla está conectada a los servicios API cuando `VITE_PROGRAMACIONES_SOURCE=api`; en otro caso informa que la API está deshabilitada y no presenta datos de demostración como persistidos. Permite consultar, buscar y filtrar por carrera, período y estado; con permiso y escritura activada permite crear, editar y cambiar estados. El formulario valida duración de 1 a 240 minutos, presenta errores y confirmaciones con SweetAlert2 y refresca la lista después de la respuesta del servidor.

La impresión consulta `/impresion` con los filtros actuales y usa la respuesta del servidor para la vista de impresión del navegador. La tabla imprimible incluye carrera, período, trabajo, estudiantes, tribunal, fecha, horario, sala y duración estimada; permite imprimir o guardar como PDF. Hay estilos de impresión A4 horizontal y reglas responsive para anchos pequeños.

## Límites

Los tests Vitest pasaron, pero no se identificó una prueba de componente dedicada que monte y recorra `PaginaCronograma`. No se hizo una sesión de navegador, impresión física ni guardado real a PDF; esos puntos quedan pendientes de validación manual. La fuente de datos y la impresión se revisaron estáticamente.
