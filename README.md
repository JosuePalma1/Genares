# Genares · Subsistema S4

Genares contiene el subsistema S4 de calificaciones, rúbricas, evaluaciones, resultados, sustentaciones y documentos. Consulta los datos académicos administrados por S1, S2 y S3 en el MER compartido; no crea estudiantes, temas, tutores ni tribunales.

## Estructura

```text
backend/src/
  common/                    API, identidad y salud
  config/                    PostgreSQL y configuración segura
  modules/
    s1-requisitos/            espacio del subsistema S1
    s2-temas/                 espacio del subsistema S2
    s3-documentos/            espacio del subsistema S3
    s4-calificaciones/        funcionalidades de Genares

frontend/src/
  shared/                    contexto y estilos compartidos
  modules/
    s1-requisitos/
    s2-temas/
    s3-documentos/
    s4-calificaciones/        rutas, páginas y componentes de Genares

backend/fixtures/             SQL de prueba y permisos del MER
docs/s4/                      instalación e historial de las etapas
```

Los espacios S1–S3 reservan la estructura común. Sus funciones siguen siendo propiedad de esos subsistemas.

## Requisitos

- Node.js y npm.
- PostgreSQL local con la base unificada `genares_integrado_dev` preparada por el proyecto común.
- El rol de PostgreSQL `genares` con los permisos S4 correspondientes.

Este repositorio no crea la base ni ejecuta migraciones. No ejecutes migraciones del prototipo: S4 consume `s2.asignacion_tema`, `s3.asignacion_tribunal` y las tablas de `s4` existentes.

## Instalación local en Windows

El procedimiento extendido, incluida la verificación de puertos y permisos, está en [Ejecutar Genares localmente](docs/s4/instalacion/local.md).

Desde PowerShell, en la carpeta raíz del repositorio:

```powershell
npm --prefix .\backend ci
npm --prefix .\frontend ci
Copy-Item .\backend\.env.example .\backend\.env
```

Edita `backend/.env` con las credenciales locales de PostgreSQL. Conserva `DB_NAME=genares_integrado_dev`, `NODE_ENV=development` y el puerto local `3001`. El archivo `.env` está excluido de Git; no publiques la contraseña.

Para las pruebas locales del MER, el ejemplo activa `LOCAL_DEV_OPEN_ACCESS=true` y `ENABLE_INTEGRACION_DEV=true`. Úsalos únicamente en este equipo: backend y frontend enlazan a loopback y rechazan conexiones remotas.

Inicia ambos servicios desde la raíz:

```powershell
npm run dev
```

Abre `http://127.0.0.1:5173/trabajos`. El API local usa `http://127.0.0.1:3001/api/v1`. Detén los servicios con `Ctrl+C`.

También puedes iniciarlos en dos ventanas de PowerShell:

```powershell
npm --prefix .\backend run start:dev
```

```powershell
npm --prefix .\frontend run dev
```

## Compilación y pruebas

```powershell
npm --prefix .\backend run build
npm --prefix .\backend test
npm --prefix .\frontend run build
npm --prefix .\frontend test
```

## Datos de prueba

Los archivos de `backend/fixtures` son operaciones manuales para la base local. No se ejecutan durante el arranque. Las evaluaciones existentes se conservan; el fixture de rúbrica de etapa 5 agrega estructura de prueba sin sustituir `DEV-1`.

## Documentación de S4

Las instrucciones locales y el material histórico de las etapas 2–4 están en [`docs/s4`](docs/s4). El historial documenta entregas previas; el código vigente vive bajo `backend/src/modules/s4-calificaciones` y `frontend/src/modules/s4-calificaciones`.
