# Informe breve — Etapa 10.7D

## Resultado

Se completó la validación PostgreSQL del cronograma en el entorno desechable 9D. No se modificó el modelo ni se añadieron funcionalidades o migraciones. No se accedió a PostgreSQL 8E (`55440`), al puerto `5432` ni a bases académicas.

## Recuperación de 9D

La configuración local documenta PostgreSQL 18 nativo y el script `backend/scripts/preparar-postgres-9d-desechable.ps1`. El único `docker-compose.yml` encontrado define PostgreSQL 16, un volumen persistente y el puerto `5432`; no corresponde a 9D y no se utilizó. Docker CLI no está disponible en esta sesión. Los archivos locales requeridos para 9D ya estaban presentes.

No se pudo confirmar la causa histórica de la indisponibilidad reportada. Durante esta revisión, el proceso de PostgreSQL coincidía con el directorio de datos 9D y `pg_isready` aceptó conexiones en `127.0.0.1:55441`. El script documentado interpretó `pg_ctl status` como servidor detenido, intentó iniciar otra instancia y falló al abrir `postgres.log` por permisos. No se borraron PID, logs ni datos, y no se cambiaron permisos. La identidad consultada y el runner verificaron host, puerto y marcador `GENARES:9D:DISPOSABLE` antes de crear bases de pruebas.

## Bases y migraciones

El runner creó bases nuevas, únicas y marcadas para cada suite. La corrida final utilizó:

| Suite | Base 9D conservada |
|---|---|
| Carreras | `genares_9d_test_89e6d797` |
| Vigencias por carrera | `genares_9d_test_5244c930` |
| Rúbricas | `genares_9d_test_b9e53a0d` |
| Evaluaciones y cronograma | `genares_9d_test_8575c660` |

Las cuatro bases de esa corrida y las bases nuevas de corridas diagnósticas anteriores permanecen intactas; no se reutilizó ni eliminó ninguna base preexistente. La suite de evaluaciones ejecutó las migraciones en orden hasta 9H.5A y aplicó las migraciones `1760000010000` y `1760000011000` en la base temporal. No fue necesaria una migración nueva.

## Correcciones de validación

- La prueba de consolidación ahora localiza el trabajo consultado dentro de la lista completa de trabajos del estudiante.
- La comprobación de evaluaciones dinámicas filtra por identidad de etapa; `PERSONALIZADA` no se cuenta como `ESCRITA`.
- El fixture del cronograma crea mediante API una versión compatible explícitamente tipada `ESCRITA/ORAL`. No clasifica etapas personalizadas por nombre ni por ámbito.
- Las aserciones del detalle de impresión admiten los campos adicionales del objeto `trabajo`.
- El runner admite `-PreservarBasesPrueba`, que se usó en todas las corridas para mantener las bases nuevas.

## Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| Backend unitario | 74 aprobadas |
| PostgreSQL 9D: carreras | 4 aprobadas |
| PostgreSQL 9D: vigencias | 1 aprobada |
| PostgreSQL 9D: rúbricas | 21 aprobadas |
| PostgreSQL 9D: evaluaciones y cronograma | 10 aprobadas |
| Frontend Vitest | 36 archivos, 187 pruebas aprobadas |
| Build NestJS | Aprobado |
| Build Vite | Aprobado; bundle JS de 670.86 kB y advertencia por superar 500 kB |
| `git diff --check` | Código de salida 0; Git mostró avisos LF/CRLF, sin errores de espacios |

Las pruebas PostgreSQL cubrieron duración, conflictos y concurrencia; cancelación y liberación de sala; transiciones y marcas de tiempo; compatibilidad de evaluaciones históricas; auditoría; y consolidación exacta. Las advertencias de error del logger aparecieron en casos que provocan fallas de auditoría para verificar rollback; no hicieron fallar las suites.

## Límites pendientes

- No se hizo recorrido visual ni se generó un PDF desde navegador: Chrome no expuso el puerto de depuración remota en esta sesión. La interfaz sí pasó sus pruebas y build.
- La regla actual de elegibilidad para cronograma usa evaluaciones `ESCRITA`. Las etapas nuevas se guardan como `PERSONALIZADA`, sin un campo que indique si una etapa personalizada satisface el requisito escrito u oral. Hace falta una decisión académica explícita antes de mapear esa elegibilidad; no se infirió desde el nombre ni el ámbito.
- Aunque las pruebas técnicas pasaron, no se da por validada una causa única para la incidencia de arranque original de 9D.

No se hicieron commits ni push. Se conservaron los cambios previos del workspace.
