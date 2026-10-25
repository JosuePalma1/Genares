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

Aplica las migraciones versionadas a la base configurada:

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
