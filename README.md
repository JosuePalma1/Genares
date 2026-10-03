# Genares

Prototipo funcional para gestionar la etapa de evaluación de trabajos de titulación de la Facultad de Ciencias de la Vida y Tecnologías de la ULEAM. El alcance inicia con el registro del trabajo y termina con la rúbrica de evaluación impresa; no integra SGA, DIT, Microsoft 365, correo ni repositorio institucional.

## Estado de esta iteración

Se reutilizó la identidad visual, los estilos institucionales, las tarjetas, tablas, formularios, navegación adaptable y la base de las pantallas HTML existentes. El prototipo ahora está migrado a React y es navegable con datos ficticios persistidos en el navegador.

El recorrido implementado es:

`Trabajo → tribunal (2 miembros) → notificación interna → revisión escrita de ambos → programación de sustentación → notificación → evaluación oral individual por estudiante → cálculo → confirmación SweetAlert2 → rúbrica imprimible`.

La Parte I se conserva por trabajo y miembro del tribunal; la Parte II se conserva por estudiante y miembro. La calificación final de cada estudiante se calcula como el promedio de las dos calificaciones finales del tribunal.

## Frontend React

```powershell
Set-Location .\prototipo-titulacion
npm install
npm run dev
```

Abra la dirección que muestre Vite. El acceso es simulado: permite cambiar entre Comisión Académica, miembros de tribunal, Secretaría y Coordinación, sin usar credenciales ni servicios institucionales.

Validación:

```powershell
npm run test
npm run build
```

## Backend NestJS + PostgreSQL

El directorio [backend](backend/README.md) contiene el modelo NestJS/TypeORM, migración PostgreSQL, restricciones de integridad y pruebas de las reglas de dominio. La interfaz del prototipo mantiene datos locales mientras se acuerda la integración API definitiva.

```powershell
Set-Location .\backend
Copy-Item .env.example .env
npm install
npm run migration:run
npm run start:dev
```

El backend expone `GET /api/salud`. No debe conectarse a infraestructura institucional sin la definición técnica correspondiente.

## Convención de nombres

El código propio del dominio utiliza nombres en español sin tildes ni `ñ`. Se conservan en inglés las APIs y convenciones exigidas por JavaScript, React, NestJS, TypeORM, HTML y npm. Por decisión del proyecto, `login`, `dashboard`, `LoginPage` y `DashboardPage` también se mantienen en inglés.

## PostgreSQL local opcional

```powershell
docker compose up -d postgres
```

Después ejecute la migración desde `backend`. Las credenciales locales están en `backend/.env.example` y no son credenciales institucionales.

## Decisiones preservadas

- Un trabajo admite uno o más estudiantes.
- Tutor y tribunal son funciones de docentes, no tipos de persona separados.
- La selección del tribunal es manual; solo se muestra carrera y carga actual como apoyo.
- Las rúbricas se versionan por modalidad y período; las evaluaciones guardan la versión/snapshot usado.
- Secretaría y Coordinación son vistas de consulta y no modifican calificaciones.
- Una evaluación cerrada queda bloqueada y la rúbrica se puede reimprimir.

Los archivos HTML originales se conservan como referencia visual del prototipo inicial; la entrada funcional actual es `prototipo-titulacion/index.html` con React.
