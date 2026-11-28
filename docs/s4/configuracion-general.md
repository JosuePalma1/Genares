# Configuración general de S4

Abre **Control → Configuración general** con una cuenta autorizada. Desde esta pantalla se administran las reglas de evaluación, la trazabilidad del expediente y los permisos de operación. Las reglas se pueden preparar por carrera, modalidad y período. Para cada proceso nuevo se usa la versión con más coincidencias específicas y, en empate, la publicación más reciente.

| Opción | Qué administra y cuándo usarla |
| --- | --- |
| **Aprobación y redondeo** | Define el porcentaje mínimo y cómo se publica la nota a dos decimales. Con un mínimo de 70 % sobre 10, una nota original de 6,995 aprueba con redondeo a 7,00 y reprueba con truncamiento a 6,99. |
| **Flujo académico** | Ordena los pasos del expediente. Un paso automático combina hechos, como dos escritas cerradas y una corrección aprobada. Un paso manual puede asignarse a un rol y requerir el visto bueno de otra persona. |
| **Programación** | Permite advertir o bloquear cuando faltan requisitos para programar una sustentación. Una excepción autorizada registra el motivo y quién la aplicó. |
| **Horario de programación** | Permite bloquear fechas pasadas y fijar la primera y última hora de inicio por carrera, modalidad y período. Por defecto, bloquea fechas pasadas y permite iniciar entre 06:00 y 23:00, hora de Ecuador continental. La publicación aplica al crear o reprogramar. |
| **Sustentaciones simultáneas** | El máximo inicial es 2 en el cupo «Todas las carreras». Para dar un cupo independiente a una carrera, selecciónala, deja modalidad y período en «Cualquiera» e indica su máximo. Si dejas vacío el máximo de esa carrera y guardas, vuelve al cupo compartido. Dos sesiones simultáneas siguen necesitando salas distintas. |
| **Nombre de las actas** | Consulta el último código emitido y el siguiente previsto para la carrera y el período elegidos. Los dos formatos PAT comparten el consecutivo. El número previsto se asigna al emitir el acta. |
| **Permisos por rol** | Controla las operaciones que habilita cada rol. La autorización también se comprueba en el servidor y sigue sujeta al ámbito del usuario. |
| **Convocatorias individuales** | Decide si se permite repetir en el mismo período, continuar en otro o enviar el caso a revisión. Configura el plazo y si corresponde conservar la escrita. Desde **Solicitudes** se abre el intento de un estudiante y desde su evaluación se consultan y califican las etapas. |
| **Correcciones** | Establece el plazo y si una solicitud necesita evidencia. |
| **Vista previa** | Ensaya un caso para revisar cómo quedarían el flujo, la programación y el resultado antes de publicar. |

## Qué información conserva el sistema

**Permitir calificar oral sin sustentación programada** viene desactivada. Si se activa en una versión del flujo, el tribunal puede calificar sin programar la defensa y el historial registra la excepción. La política de escrita completa se aplica por separado. Esta opción se consulta en las reglas vigentes para trabajos nuevos y existentes, según su carrera, modalidad y período.

Cada proceso conserva la versión de flujo, el mínimo y el redondeo asignados. En una bina, la evaluación compartida corresponde al trabajo y las etapas individuales corresponden a cada estudiante. Una nueva convocatoria conserva su propio estado, nota y fechas. Cuando se reutiliza la escrita, queda registrada la evaluación de origen.

Los reemplazos se registran por etapa desde la evaluación. El historial conserva el evaluador anterior, el reemplazo, el motivo, quién hizo el cambio y la fecha. Los pasos manuales también conservan el historial de solicitudes y decisiones.

## Ejemplos de uso

- Puedes crear en **Rúbricas** una versión con Escrita de 2,5 puntos, Oral de 2,5 y Producto de 5. Marca Producto como etapa personalizada y elige si su nota es compartida o individual.
- Si un estudiante de una bina reprueba, abre **Solicitudes** y selecciona su caso. Si la política permite conservar la escrita, puedes abrir la nueva convocatoria con esa nota y repetir la oral. El historial permite consultar ambos intentos.
- Para exigir dos escritas cerradas antes de la defensa, agrega ese requisito en el flujo y aplícalo a la programación. Usa la vista previa para comprobar qué ocurre cuando falta un cierre.

Para habilitar estas pantallas en una base existente, sigue la [guía de instalación local](instalacion/local.md).
