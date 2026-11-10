# Backend GENARES

Backend NestJS con TypeORM y PostgreSQL para trabajos de titulación, tribunales, rúbricas, programación, evaluaciones, notas y actas internas.

## Configuración

El backend carga exclusivamente [`backend/.env`](.env). Usa [`backend/.env.example`](.env.example) como plantilla sin credenciales.

Variables principales:

```dotenv
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=genares
DB_PASSWORD=REEMPLAZAR_LOCALMENTE
DB_NAME=genares
DB_SSL=false
```

No se crean bases automáticamente. El destino debe existir antes de iniciar la API.

## Comandos

Desde la raíz:

```powershell
npm run dev:api
npm run db:migrate
```

Desde `backend`:

```powershell
npm run start:dev
npm run build
npm test
npm run migration:run
npm run migration:revert
```

Las migraciones son el único mecanismo para crear o actualizar tablas. TypeORM mantiene `synchronize: false` y `migrationsRun: false`.

## API local

- Estado: `GET /api/salud`
- API versionada: `/api/v1`
- La identidad local solo funciona en desarrollo y permanece protegida por defecto.
- Las escrituras requieren la configuración explícita de origen y las protecciones del backend.

Las entidades están organizadas por módulo en `src/`; las migraciones están en `src/base-datos/migraciones/`.
