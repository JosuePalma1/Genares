# Base de datos de desarrollo

Scripts para crear desde cero la base local `genares_integrado_dev` con el MER unificado (`gen`, `s1`, `s2`, `s3`, `s4`) y datos de prueba.

**Solo para desarrollo.** Todos los datos son ficticios: personas, códigos y matrículas llevan el prefijo `DEV` y los correos usan el dominio reservado `.invalid`. No representan datos institucionales ni rúbricas oficiales. Los datos de S1, S2 y S3 son simulados para que S4 pueda probarse; sus equipos siguen siendo los dueños de esos esquemas.

## Archivos

| Archivo | Contenido | ¿Se puede repetir? |
| --- | --- | --- |
| `instalacion_inicial_dev.sql` | Esquemas, las 80 tablas, claves foráneas y reglas de integración S2–S3–S4. | **No.** Solo en una base vacía. |
| `001_catalogos_y_personas_dev.sql` | Carreras, modalidad, período, roles, personas, usuarios, docentes y estudiantes. | Sí. |
| `002_integracion_s2_s3_s4_dev.sql` | Tema, bina e individual de S2; tribunal de S3; rúbrica `DEV-1` y procesos de S4. | Solo antes de instalar la retención de S4 (ver abajo). |
| `003_escenarios_evaluaciones_cronograma_dev.sql` | Evaluaciones escritas cerradas y dos sustentaciones en aulas distintas. | Solo antes de instalar la retención de S4 (ver abajo). |
| `004_rol_aplicacion_genares_dev.sql` | Rol de aplicación `genares` (sin contraseña) y su acceso básico: esquemas, lecturas y columnas de evaluaciones. | Sí. No modifica un rol existente. |

## Orden de instalación

Ejecuta todo como `postgres`, conectado a una base **nueva** llamada `genares_integrado_dev`.

1. `instalacion_inicial_dev.sql`. El archivo indica cómo ejecutarlo con `psql` en una sola transacción:
   ```powershell
   psql -X -v ON_ERROR_STOP=1 --single-transaction -U postgres -d genares_integrado_dev -f instalacion_inicial_dev.sql
   ```
2. `001_catalogos_y_personas_dev.sql`
3. `002_integracion_s2_s3_s4_dev.sql`
4. `003_escenarios_evaluaciones_cronograma_dev.sql`
5. `004_rol_aplicacion_genares_dev.sql`. Después define la contraseña del rol, la misma de `DB_PASSWORD` en `backend/.env`:
   ```sql
   ALTER ROLE genares WITH PASSWORD 'tu-contraseña-local';
   ```
6. Los scripts de S4 de `backend/fixtures`, en el orden del [README principal](../../../README.md#scripts-sql-de-backendfixtures): permisos, retención/auditoría y verificación.

Los permisos se reparten así: `004` da el acceso básico y `backend/fixtures` agrega las escrituras de rúbricas, cronograma y actas, y la retención. Juntos reproducen exactamente los permisos con los que funciona la base local.

## Detalles a tener en cuenta

- **`revision` en carreras y modalidades.** S4 usa esta columna para detectar si alguien cambió una carrera o modalidad mientras se llenaba un formulario, y rechaza valores vacíos. `001` las inserta con `revision = 1`. Si tu base se creó con una versión anterior de `001` (con `revision` en `NULL`), vuelve a ejecutar `001`: completa solo las revisiones vacías y no cambia las demás.
- **`002` y `003` no se repiten tras instalar la retención.** `s4-retencion-visibilidad-auditoria.sql` impide ampliar una rúbrica ya usada y agregar puntajes a evaluaciones cerradas. Los disparadores se ejecutan antes de que PostgreSQL resuelva `ON CONFLICT DO NOTHING`, así que volver a ejecutar `002` o `003` termina en error aunque las filas ya existan. Para regenerar esos datos, crea la base de nuevo desde el paso 1.
- **Estados de `TEXT`.** Los enumerados del MER se guardan como `TEXT` provisional hasta que cada equipo propietario defina sus valores.
