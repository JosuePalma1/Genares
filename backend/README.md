# Backend de Genares

API NestJS del subsistema S4 sobre el MER PostgreSQL compartido.

## Configuración local

Desde la raíz del repositorio instala dependencias con `npm --prefix .\backend ci`. Copia `backend/.env.example` a `backend/.env` y configura las credenciales de la base local `genares_integrado_dev`.

El backend escucha en `127.0.0.1:3001` en desarrollo. No habilites el acceso abierto local en un servidor compartido o accesible desde Internet.

## Comandos

```powershell
npm --prefix .\backend run start:dev
npm --prefix .\backend run build
npm --prefix .\backend test
```

El comando de desarrollo se puede iniciar junto con Vite desde la raíz usando `npm run dev`.

## Organización

- `src/common`: API versionada, controles de identidad/capacidades y endpoint de salud.
- `src/config`: conexión PostgreSQL y controles de entorno.
- `src/modules/s4-calificaciones`: expedientes de consulta, rúbricas, evaluaciones, sustentaciones, resultados, documentos y consulta de la bitácora de cambios (`auditoria/`).
- `src/modules/s1-requisitos`, `s2-temas` y `s3-documentos`: espacios reservados a los módulos de sus respectivos equipos.
- `fixtures`: SQL local de permisos, retención/auditoría y datos de prueba. Se ejecutan a mano y no son migraciones; el orden está en el [README principal](../README.md#scripts-sql-de-backendfixtures).

TypeORM usa `synchronize: false` y `migrationsRun: false`. El backend no contiene comandos para aplicar el esquema antiguo. S4 no administra los registros de S1, S2 ni S3.

Con el fixture de retención aplicado, la base rechaza `DELETE`/`TRUNCATE` en `s4`. Los servicios ocultan registros con `estado_registro = 0` y fijan `s4.actor_id` en cada transacción para que la bitácora `s4.eventos_cambio_registro` registre quién hizo cada cambio.
