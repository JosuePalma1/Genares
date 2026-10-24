# 10.9D — Corrección de alcance: estudiantes sin acceso al sistema

## Resultado

Se retiraron las superficies que permitían a estudiantes actuar como usuarios del sistema. Los estudiantes permanecen como personas y entidades académicas relacionadas con trabajos y evaluaciones. No se modificaron registros académicos ni se añadió una migración.

## Acceso e identidades

- El catálogo API de demostración contiene únicamente `administracion`, `secretaria`, `evaluador-uno` y `evaluador-dos`. Las tres claves de identidad estudiantil anteriores son rechazadas.
- Se quitaron los tres actores estudiante del selector, junto con el rol simulado `ESTUDIANTE`.
- Se retiraron la ruta React `/mis-resultados`, su entrada de navegación, la pantalla que la implementaba y el cliente para consolidar al estudiante de la identidad actual.
- Se quitó `GET /api/v1/evaluaciones/estudiantes/actual/consolidado` y su método de servicio. El acceso a esa ruta ya no resuelve la identidad a un perfil estudiantil; la ruta con parámetro de UUID rechaza el segmento `actual` como identificador inválido.
- Se mantienen las consultas autorizadas de consolidación por trabajo. La suite 9D verifica lectura desde tribunal y, en modo de demostración local, desde administración y secretaría.
- Se conservan los endpoints académicos existentes por identificador de estudiante y su autorización de servidor. No tienen una pantalla de acceso estudiantil y no sustituyen la consulta por trabajo.

## Perfiles internos locales

Además de las cuatro identidades sincronizadas con la API, el modo de prototipo conserva actores internos sin identidad API: Paola Reyes y Jorge Vera (tribunal), y Esteban Quiroz (coordinación). Daniela Cedeño tiene los roles locales de administración y comisión académica, con identidad API de administración. No se cambió el comportamiento de estos perfiles locales.

## Datos, compatibilidad y base de datos

- Se conservan las personas estudiante, sus relaciones con trabajos, sus carreras y los registros de evaluaciones y resultados.
- Los módulos académicos continúan mostrando los estudiantes vinculados a cada trabajo.
- No se abrió conexión a los puertos 55440 ni 5432. No se modificaron PostgreSQL 8E ni datos persistentes, y no se ejecutó ninguna migración sobre bases existentes.
- La validación PostgreSQL utilizó únicamente el runner protegido 9D en `127.0.0.1:55441`. Las cuatro bases temporales creadas por esta ejecución quedaron preservadas. No se creó una migración para este cambio de acceso.
- No se implementó autenticación definitiva ni el CORE.

## Archivos de esta etapa

- Backend: `backend/src/comun/api/identidad-desarrollo-local.ts` y su prueba; `backend/src/evaluaciones/evaluaciones.controller.ts`, `evaluaciones.service.ts` y `evaluaciones.postgres.e2e.spec.ts`.
- Frontend: `prototipo-titulacion/src/datos/datosPrototipo.js` y su prueba; `src/configuracion/identidadSimuladaApi.test.js`; `src/estructuras/EstructuraAplicacion.jsx`; `src/Aplicacion.jsx`; `src/servicios/evaluacionesApi.js` y su prueba.
- Se retiró `prototipo-titulacion/src/paginas/PaginaMisResultados.jsx`.

## Validaciones

- Backend unitario, runner 9D: 16 suites pasaron, 106 pruebas pasaron; 4 suites y 39 pruebas PostgreSQL fueron omitidas en esa ejecución unitaria porque se ejecutan aparte.
- PostgreSQL 9D: 4 suites y 39 pruebas pasaron (carreras, vigencias por carrera, rúbricas y evaluaciones). Las pruebas cubrieron la conservación de datos de evaluación y consolidaciones, y lecturas autorizadas de resultados.
- Frontend: 41 archivos de prueba y 197 pruebas pasaron.
- Build NestJS: pasó.
- Build Vite: pasó.
- `git diff --check`: pasó.

No se creó commit ni se hizo push.
