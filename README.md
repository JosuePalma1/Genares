# Genares

Prototipo para gestionar la evaluación de trabajos de titulación de la Facultad de Ciencias de la Vida y Tecnologías de la ULEAM. El alcance llega hasta la evaluación y consulta de la rúbrica; no reemplaza el SGA ni genera actas institucionales.

## Estado

El repositorio combina una demostración React y un backend NestJS con PostgreSQL:

- La demostración mantiene el flujo general de trabajos en `localStorage` y usa identidades ficticias.
- Las pantallas de rúbricas y catálogos pueden conectarse al backend en desarrollo. Las escrituras requieren habilitación explícita tanto en el cliente como en la identidad local del servidor.
- El backend ofrece API versionada para rúbricas, evaluaciones, carreras y modalidades. La conexión completa del flujo de trabajo de React con la API sigue pendiente.
- No hay autenticación institucional ni integración con DIT, SGA, correo o Microsoft 365. No usar con información real ni publicar la API de identidad local.

## Frontend React

```powershell
Set-Location .\prototipo-titulacion
npm install
npm run dev
```

Vite muestra la dirección local. El modo predeterminado es el prototipo: el acceso y los roles son simulados, y los datos de demostración se guardan en el navegador.

Para usar las pantallas conectadas a la API, configura `VITE_RUBRICAS_SOURCE=api` en el archivo local de entorno y revisa las opciones de desarrollo descritas en [backend/README.md](backend/README.md). El archivo `.env.development.example` deja la API y las escrituras deshabilitadas por defecto. No agregues archivos `.env` al repositorio.

Validación del frontend:

```powershell
npm run test
npm run build
```

## Backend NestJS y PostgreSQL

El backend usa TypeORM, `synchronize: false` y migraciones versionadas. Incluye:

- Rúbricas completas versionadas, con etapas configurables y alcances `TRABAJO_COMPARTIDO` o `ESTUDIANTE_INDIVIDUAL`.
- Vigencias de versiones por carrera, modalidad y período.
- Evaluaciones por etapa, traspasos trazables de evaluaciones compartidas y consolidación individual bajo demanda. Las notas finales usan aritmética racional exacta y redondeo decimal `HALF_UP` a dos decimales; no se consolidan evaluaciones incompletas.
- Consultas y administración API de carreras y modalidades.

Las migraciones de las etapas 9H.4–9H.5A agregan vigencias, carreras, rúbricas dinámicas, alcances mixtos y traspasos. Las evaluaciones históricas conservan su estructura y no se mezclan automáticamente con los resultados nuevos.

Para desarrollo local aislado y pruebas, sigue las instrucciones y protecciones del [README del backend](backend/README.md). En particular, no apuntes las pruebas al PostgreSQL del puerto 5432 ni a la base persistente 8E; usa el entorno desechable 9D cuando corresponda.

Rutas principales bajo `/api/v1`:

- `/rubricas` y `/versiones-rubrica`: consulta, creación y edición de borradores, clonación y activación.
- `/evaluaciones`: captura, cierre, consulta y consolidación por trabajo o estudiante.
- `/carreras` y `/modalidades`: consulta y administración de catálogos.
- `/salud`: comprobación de disponibilidad.

Las rutas requieren las capacidades definidas por el backend. La identidad local de desarrollo no sustituye autenticación institucional.

## Decisiones académicas

- Un trabajo puede tener uno o más estudiantes.
- Cada etapa declara su alcance; no se deduce por el nombre de la etapa. La evaluación compartida se registra una vez por trabajo y evaluador y su traspaso a cada estudiante conserva la procedencia sin duplicar puntajes.
- Los miembros del tribunal califican de forma independiente. El requisito actual es de dos miembros.
- Para consolidar, se promedian las evaluaciones cerradas de los miembros por etapa y luego se promedian por igual todas las etapas configuradas. Los valores intermedios conservan precisión exacta; solo la presentación final se redondea a dos decimales.
- Los borradores se editan con control de revisión; las versiones activas e históricas son inmutables. Las evaluaciones guardan referencias y una instantánea de la rúbrica utilizada.
- Secretaría y Coordinación no modifican calificaciones en el prototipo.

Consulta [ESTADO_DEL_PROTOTIPO.md](ESTADO_DEL_PROTOTIPO.md) para el detalle de lo implementado y lo pendiente.

## Referencias del prototipo inicial

Los archivos HTML antiguos se conservan como referencia visual. La aplicación React se inicia desde `prototipo-titulacion/index.html`.
