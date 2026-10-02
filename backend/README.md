# Backend de Genares

Base NestJS + TypeORM + PostgreSQL para el flujo de evaluación. No implementa autenticación institucional, correo, SGA ni Microsoft 365.

## Desarrollo

1. Copiar `.env.example` a `.env` y apuntar a una base PostgreSQL local.
2. Ejecutar `npm install`.
3. Ejecutar `npm run migration:run`.
4. Iniciar con `npm run start:dev`.

El endpoint de vida es `GET /health`. Las migraciones nunca usan `synchronize`; las restricciones del modelo viven tanto en PostgreSQL como en las reglas puras de dominio.

## Validación

- `npm run build`
- `npm test`

Las pruebas unitarias no requieren una base de datos y cubren topes de indicadores, sumatorias, habilitación de sustentación, independencia de evaluaciones orales y promedio de los dos miembros.
