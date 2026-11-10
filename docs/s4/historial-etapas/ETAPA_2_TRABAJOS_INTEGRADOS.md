> **Documento histórico de la etapa 2.** En la etapa 3 se eliminó el filtro por nombre `DEV` y se añadió el catálogo de rúbricas y el editor de borradores orales. Consulta `ETAPA_3_RUBRICAS_Y_BORRADORES_MER.md`.

# Genares · Etapa 2: Trabajos de titulación integrados (sin Docker)

Esta etapa usa el **código actual de Genares** y la misma base PostgreSQL `genares_integrado_dev` que ya validaste. **No instala otra base, no ejecuta migraciones y no cambia tablas.**

## Qué se modificó

- En **modo de desarrollo de Vite**, la opción **Operación → Trabajos de titulación** (`/trabajos`) ahora consulta el endpoint local de solo lectura que ya funcionó en **Integración S2/S3**.
- La lista muestra **tema y asignación de S2**, estudiantes, **evaluadores de S3**, rúbrica/proceso de S4, evaluaciones escritas cerradas y número de sesiones.
- Puedes buscar por tema, estudiante o evaluador, y filtrar por si existe un tribunal asignado.
- **Ver expediente** abre `/trabajos/:idTrabajo` y muestra participantes, tribunal, versión de rúbrica y programación. **Ver tribunal** permite consultar sus docentes sin editarlos.
- La pantalla **Integración de prueba S2/S3** conserva su función anterior y ahora enlaza al expediente correspondiente.
- **No se han modificado las entidades, migraciones, endpoints de escritura ni las páginas antiguas de rúbricas y calificaciones.** Las rutas antiguas de trabajos quedan en el código para una adaptación posterior. La ruta `/trabajos/nuevo` redirige al listado en modo de desarrollo para evitar que se intente crear un expediente con el modelo antiguo.

## Instalación local en Windows

1. **Cierra el backend/frontend actuales** con Ctrl+C y conserva una copia de tu carpeta anterior.
2. Descomprime el ZIP nuevo en **otra carpeta** (no encima del proyecto anterior).
3. Copia tu configuración privada **`backend/.env`** desde el proyecto que ya funcionó a `backend/.env` en esta nueva carpeta. **No compartas esa contraseña.** Deja `NODE_ENV=development`, `ENABLE_INTEGRACION_DEV=true` y `DB_NAME=genares_integrado_dev`.
4. En PowerShell, desde la carpeta que contiene `backend` y `frontend`:

   ```powershell
   npm --prefix .\backend ci
   npm --prefix .\frontend ci
   npm --prefix .\backend run start:dev
   ```

   **En otra ventana de PowerShell** (misma carpeta):

   ```powershell
   npm --prefix .\frontend run dev
   ```

5. Abre **http://127.0.0.1:5173/trabajos** y entra a uno de los expedientes, por ejemplo «DEV - Tema de bina TI».
6. También puedes entrar a **http://127.0.0.1:5173/integracion-dev** y pulsar **Ver expediente en Trabajos**.

## Qué debes ver

- **DEV - Tema de bina TI**: Juan y María; tribunal de dos integrantes; rúbrica `DEV-1`; dos evaluaciones escritas cerradas; sustentación conjunta en DEV-AULA-101, 15/12/2026 a las 09:00.
- **DEV - Tema individual Software**: Pedro; tribunal de dos integrantes; rúbrica `DEV-1`; dos evaluaciones escritas cerradas; sustentación individual en DEV-AULA-102, 15/12/2026 a las 09:00.
- Las consultas se realizan al **mismo PostgreSQL local**. S1, S2 y S3 no necesitan ejecutar sus aplicaciones.

## Alcance y seguridad

- Los datos presentados **siguen siendo de los seeders DEV**, no expedientes institucionales reales. El endpoint `/api/v1/integracion-dev/resumen` filtra títulos `DEV -` y está habilitado solo para desarrollo local.
- Se usa el **ID de `s2.asignacion_tema`**, no el identificador de una tabla redundante `trabajos_titulacion`.
- El detalle no ofrece botones de escritura sobre rúbricas, evaluaciones ni cronograma: la adaptación de esos flujos corresponde a las etapas siguientes.
- **No ejecutes** `npm run migration:run` ni migraciones antiguas en la base unificada, y no habilites este endpoint de demostración en un servidor accesible desde Internet.
- Los otros módulos del prototipo permanecen intactos, pero **no están todavía adaptados** a las nuevas tablas de S4. No debes asumir que guardar o cerrar evaluaciones desde sus pantallas funciona con este MER.

## Pruebas

Desde la carpeta del proyecto, cuando estén instaladas las dependencias:

```powershell
npm --prefix .\frontend run test
npm --prefix .\frontend run build
npm --prefix .\backend run build
```

Esta etapa reutiliza el endpoint que ya comprobaste funcionando en tu equipo. La nueva pantalla y las rutas deberán verificarse en tu entorno local.
