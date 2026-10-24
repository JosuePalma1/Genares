# Genares

Prototipo para gestionar la evaluación de trabajos de titulación de la Facultad de Ciencias de la Vida y Tecnologías de la ULEAM. No reemplaza el SGA ni genera actas institucionales; las actas internas archivadas no son documentos oficiales de la Universidad.

## Estado

El repositorio combina una demostración React y un backend NestJS con PostgreSQL:

- La demostración mantiene el flujo general de trabajos en `localStorage` y usa identidades ficticias. El selector cambia de perfil directamente; Daniela inicia con la perspectiva de administración de demostración.
- Las pantallas de rúbricas y catálogos pueden conectarse al backend en desarrollo. Las escrituras requieren habilitación explícita tanto en el cliente como en la identidad local del servidor.
- El backend ofrece API versionada para rúbricas, evaluaciones, carreras y modalidades. La conexión completa del flujo de trabajo de React con la API sigue pendiente.
- El modo con identidades y datos ficticios se ejecuta solo en desarrollo. El build de producción muestra una pantalla de disponibilidad y no carga la demostración.
- No hay autenticación institucional ni integración con DIT, SGA, correo o Microsoft 365. No usar con información real ni publicar la API de identidad local.

## Frontend React

En Windows se requiere Node/npm, las dependencias de ambos paquetes y PostgreSQL 18 instalado en `C:\Program Files\PostgreSQL\18\bin`. Los scripts no instalan PostgreSQL por su cuenta.

```powershell
# Instala una vez si faltan dependencias
npm --prefix .\prototipo-titulacion install
npm --prefix .\backend install

# Primera preparación de la base local de desarrollo
npm run db:prepare

# Uso diario: inicia PostgreSQL local, NestJS y Vite
npm run dev
```

`npm run db:prepare` prepara únicamente la base local aprobada, aplica las migraciones actuales y carga datos sintéticos de TI/SOFT. Al terminar, detiene el PostgreSQL que inició y conserva los datos. Luego `npm run dev` inicia PostgreSQL, NestJS y Vite juntos; detén el entorno con `Ctrl+C`. `npm run dev:web` permite recorrer la demostración de React sin PostgreSQL. `npm run dev:api` inicia solo NestJS y la base local preparada.

La demostración de React usa TI y SOFT; los perfiles se cambian desde el selector de la cabecera, sin autenticación. En el modo API, el servidor usa una identidad local fija de solo lectura y el cliente no puede elegir permisos. El selector de React no autentica ni cambia esa identidad. Los datos propios de la demostración local del navegador quedan en `localStorage`.

El entorno API utiliza exclusivamente `127.0.0.1:55442/genares_dev_10_9` y los archivos locales ignorados `.local-postgres-10.9/` y `backend/.env.10.9`. La configuración separada no sobrescribe `backend/.env`. El modo API está configurado en solo lectura por defecto. PostgreSQL 9D queda reservado para pruebas de integración. No uses la base persistente 8E ni el puerto 5432 para estas tareas; no agregues secretos al repositorio.

Validación del frontend:

```powershell
npm --prefix .\prototipo-titulacion run test
npm --prefix .\prototipo-titulacion run build
```

## Backend NestJS y PostgreSQL

El backend usa TypeORM, `synchronize: false` y migraciones versionadas. Incluye:

- Rúbricas completas versionadas, con etapas configurables y alcances `TRABAJO_COMPARTIDO` o `ESTUDIANTE_INDIVIDUAL`.
- Vigencias de versiones por carrera, modalidad y período.
- Evaluaciones por etapa, traspasos trazables de evaluaciones compartidas y consolidación individual bajo demanda. Las notas finales usan aritmética racional exacta y redondeo decimal `HALF_UP` a dos decimales; no se consolidan evaluaciones incompletas.
- Consultas y administración API de carreras y modalidades.

Las migraciones de las etapas 9H.4–9H.5A agregan vigencias, carreras, rúbricas dinámicas, alcances mixtos y traspasos. Las evaluaciones históricas conservan su estructura y no se mezclan automáticamente con los resultados nuevos.

Para validación local, sigue las instrucciones y protecciones del [README del backend](backend/README.md). La suite de integración PostgreSQL usa el entorno desechable 9D con verificación de identidad y bases temporales; no forma parte del arranque diario.

La preparación, los datos ficticios, los comandos y las comprobaciones de la etapa 10.9B están detallados en [docs/entorno-10.9b-informe.md](docs/entorno-10.9b-informe.md).

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
