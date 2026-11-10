# Genares — Etapa 4: formulario completo conectado al MER unificado

**Empieza por `ETAPA_4_FORMULARIO_COMPLETO_MER.md`.** Esta entrega parte de la etapa 3 que ya probaste, conserva PostgreSQL local sin Docker y adapta el formulario institucional de evaluación oral.

---

> **ETAPA 3 — Rúbricas y borradores orales del MER:** comienza por [ETAPA_3_RUBRICAS_Y_BORRADORES_MER.md](./ETAPA_3_RUBRICAS_Y_BORRADORES_MER.md). La base unificada YA EXISTE: NO ejecutes las migraciones antiguas en `genares_integrado_dev`.

> **Etapa 2 disponible:** consulta [ETAPA_2_TRABAJOS_INTEGRADOS.md](./ETAPA_2_TRABAJOS_INTEGRADOS.md) para abrir la pantalla **Trabajos de titulación** con datos S2/S3/S4 del MER unificado, sin Docker y sin migraciones.

# GENARES

GENARES gestiona el flujo académico de trabajos de titulación: trabajos, tribunales, rúbricas, programación, evaluaciones, notas y actas internas. No reemplaza el SGA ni la autenticación institucional.

## Desarrollo local

La configuración activa del backend está únicamente en [`backend/.env`](backend/.env). La plantilla sin credenciales está en [`backend/.env.example`](backend/.env.example). PostgreSQL debe estar disponible según esos valores; no se crean bases automáticamente.

Instala dependencias:

```powershell
npm --prefix .\backend ci
npm --prefix .\frontend ci
```

Inicia backend y frontend:

```powershell
npm run dev
```

Inicia solo la API:

```powershell
npm run dev:api
```

**Solo para el prototipo antiguo y con una base distinta**: sus migraciones están documentadas aquí, pero NO deben ejecutarse en `genares_integrado_dev`:

```powershell
npm run db:migrate
```

TypeORM mantiene `synchronize: false` y `migrationsRun: false`; el esquema se modifica únicamente mediante migraciones explícitas.

Para usar solo la demostración web:

```powershell
npm --prefix .\frontend run dev
```

La API está disponible en `http://127.0.0.1:3001/api/v1` y su estado en `/api/salud`.

## Validación

```powershell
npm --prefix .\backend run build
npm --prefix .\backend test
npm --prefix .\frontend run test
npm --prefix .\frontend run build
```

Las pruebas automatizadas actuales son unitarias y no requieren crear bases temporales.

## Estructura

- [`backend/`](backend/) — NestJS, TypeORM, entidades y migraciones.
- [`frontend/`](frontend/) — aplicación React y Vite.
- [`backend/src/base-datos/migraciones/`](backend/src/base-datos/migraciones/) — evolución versionada del esquema.

No agregues credenciales al repositorio ni modifiques bases fuera del destino definido en `backend/.env`.

## Vista de integración S2/S3 para PostgreSQL local

Consulta [INTEGRACION_LOCAL_SIN_DOCKER.md](INTEGRACION_LOCAL_SIN_DOCKER.md) para usar la nueva vista de **solo lectura** sobre el MER de 80 tablas, sin ejecutar las migraciones antiguas.
