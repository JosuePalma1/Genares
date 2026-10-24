# 08 — Informe final de 10.7C

## Estado: parcialmente completada

La revisión estática, las pruebas backend sin PostgreSQL, las pruebas frontend y los builds se realizaron. El criterio de aceptación de migraciones, integridad en PostgreSQL y concurrencia no puede considerarse satisfecho porque el entorno 9D no estaba disponible y no se realizaron escrituras.

## PostgreSQL

- No se preparó una base nueva.
- No se conectó a PostgreSQL, incluido 9D; no había listener en `127.0.0.1:55441` y faltaban `.env.9d.local` y los archivos locales esperados.
- No se verificó marcador, nombre/usuario dentro del servidor, permisos ni vaciedad, por lo que no se ejecutó SQL ni se aplicaron migraciones.
- Las migraciones 1000 y 1100 se revisaron en el código, no se ejecutaron.
- No se accedió a PostgreSQL 8E (`55440`) ni al puerto `5432`. No se borró ninguna base ni se cambiaron roles.

## Pruebas y builds

| Validación | Resultado |
|---|---|
| Backend Jest | 74 aprobadas; 4 suites y 36 pruebas PostgreSQL omitidas |
| Frontend Vitest | 36 archivos y 187 pruebas aprobados |
| Build NestJS | Aprobado |
| Build Vite | Aprobado; bundle JS 670.86 kB con advertencia sobre 500 kB |
| `git diff --check` | Aprobado; solo avisos informativos LF/CRLF en cambios preexistentes |
| Suites PostgreSQL | Omitidas: no hubo conexión de escritura segura |

En frontend se observaron advertencias de `useLayoutEffect` de React Router durante renderizado de pruebas; no hicieron fallar Vitest. La advertencia de tamaño del bundle no bloqueó el build. Los nueve documentos nuevos también se revisaron por espacios al final de línea: cero encontrados.

## Compatibilidad y comportamiento

- La migración 1100 mapea `COMPLETADA` a `FINALIZADA` y deja horas reales sin poblar. Este comportamiento se confirmó leyendo el SQL; la transformación de filas no se ejecutó.
- El esquema base declara `UNIQUE(id_trabajo)`, FKs restrictivas y triggers para evaluaciones. La inspección estática no sustituye comparar el esquema migrado en PostgreSQL.
- El servicio de cronogramas actualiza solo los estados/tiempos de programación. La suite de integración existente compara notas y estado de trabajo antes y después, pero quedó omitida en esta ejecución.
- React permite gestionar agenda por API y genera una vista imprimible basada en la respuesta del servidor. Hubo build y tests generales, no recorrido de navegador ni PDF real.

## Archivos de esta entrega

- `docs/cronograma-10.7c/README.md`
- `docs/cronograma-10.7c/01-entorno-postgresql.md`
- `docs/cronograma-10.7c/02-validacion-migraciones.md`
- `docs/cronograma-10.7c/03-pruebas-horarios.md`
- `docs/cronograma-10.7c/04-pruebas-concurrencia.md`
- `docs/cronograma-10.7c/05-regresion-evaluaciones.md`
- `docs/cronograma-10.7c/06-validacion-frontend-impresion.md`
- `docs/cronograma-10.7c/07-incidencias-y-correcciones.md`
- `docs/cronograma-10.7c/08-informe-final.md`

No se añadieron migraciones, cambios de código ni pruebas en esta etapa porque no se confirmó un defecto reproducible. Los cambios previos del workspace quedaron preservados; no se hizo commit ni push.

## Pendiente para cerrar el criterio de aceptación

Preparar una instancia 9D exclusiva y verificable con permisos existentes; conservar la base temporal creada. Entonces ejecutar migraciones desde vacío, comprobar la falla segura ante traslape histórico, los casos de intervalo, las creaciones concurrentes y la regresión académica. Completar un recorrido de navegador y guardar una impresión PDF. Hasta entonces 10.7C permanece parcial.
