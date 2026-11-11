# S4-16 · Validación en Chrome y PostgreSQL

Fecha de prueba: 10 de noviembre de 2026, hora de Bogotá.

Se utilizó Chrome con el modo Offline de DevTools, que bloqueó las solicitudes reales de la pestaña. Genares se ejecutó con Vite y NestJS locales, conectados a PostgreSQL `genares_integrado_dev`. La segunda pestaña permaneció conectada para simular otro dispositivo.

| Escenario | Resultado observado |
| --- | --- |
| RF-29, RF-30 y RF-32: edición durante el corte | En la rúbrica oral DEV-1 de Pedro, con Lucía como evaluadora, se guardaron localmente la nota 7.25 y su observación. Chrome informó `navigator.onLine=false` y el formulario mostró «Pendiente de sincronización». |
| Recarga desde el formulario | El botón «Recargar» recuperó el expediente, la nota y la observación desde el dispositivo. El botón «Cerrar evaluación oral» estaba deshabilitado incluso con el indicador completo. |
| RF-31: reconexión | El formulario sincronizó automáticamente y mostró «Guardado en servidor · revisión 1». La lectura de la API respaldada por PostgreSQL devolvió el borrador, la nota y la observación. |
| RF-31 y RN-22: reintento | Dos POST con el mismo identificador de operación devolvieron el mismo ID y la misma revisión 3. |
| RF-47 y RN-29: revisión concurrente | La pestaña offline editó sobre la revisión 2. La pestaña conectada guardó la revisión 3 con nota 8. Al reconectar, el formulario mostró conflicto y conservó la observación local. La revisión 3 y su observación remota permanecieron en el servidor. |
| Separación por evaluador | Al cambiar a David para el mismo estudiante, la nota y la observación del formulario estaban vacías. La prueba de navegador usó un solo estudiante. |
| Recarga completa y reapertura offline | Una recarga de Chrome ignorando caché abrió la página de error. Se cerró la pestaña de Genares y se intentó abrir la ruta en otra pestaña del mismo perfil aislado, también offline. Chrome devolvió `ERR_INTERNET_DISCONNECTED`. Al reconectar y abrir la ruta, reaparecieron la observación local y el conflicto. |

Se compararon las cinco evaluaciones DEV preexistentes antes y después y sus respuestas fueron idénticas. La prueba dejó un único borrador ficticio nuevo en revisión 3, con ID `8e43f2ff-9645-45f8-bc54-79721b7df7c3`. No se cerró ninguna evaluación.

## Pendiente en S4-15 · APK del tribunal con Capacitor

La aceptación de arranque en frío sin Internet depende de probar la futura APK con la interfaz empaquetada. En una tablet, se deberá descargar previamente el expediente, editar sin red, cerrar por completo la aplicación y abrirla aún sin red. El formulario debe cargar el expediente y el borrador, mantener el cierre bloqueado y sincronizar tras reconectar. La prueba en Chrome confirma que el borrador persiste al cerrar la pestaña y reaparece cuando vuelve a cargar la aplicación. El arranque offline de la APK sigue pendiente.
