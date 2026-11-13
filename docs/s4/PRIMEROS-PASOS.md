# Primeros pasos con Genares S4

Guía para poner el proyecto en marcha en un PC con Windows y entender cómo está organizado.
Lo que falta por hacer está en [PENDIENTES.md](PENDIENTES.md).

## 1. Qué instalar

- **Node.js** (versión LTS) y **Git**.
- **PostgreSQL** con **pgAdmin**, el programa para administrar la base de datos.
- Solo si vas a probar la app del tribunal en Android: **Android Studio** y un **JDK 21**.

## 2. Descargar el proyecto

En PowerShell:

```powershell
git clone https://github.com/JosuePalma1/Genares.git
cd Genares
git checkout feature/mer-unificado-pasos-3-4
npm --prefix .\backend ci
npm --prefix .\frontend ci
```

Si GitHub te niega el acceso, pide permiso al dueño del repositorio.

## 3. Crear la base de datos de prueba

Todos los datos son inventados: no hay estudiantes ni docentes reales.

En pgAdmin, conectado como el usuario `postgres`:

1. Crea una base vacía llamada `genares_integrado_dev`.
2. Ejecuta estos archivos de `docs/s4/base-datos-dev/`, en este orden:
   1. `instalacion_inicial_dev.sql`: crea las tablas. Ejecútalo con `psql` como explica el [README de esa carpeta](base-datos-dev/README.md).
   2. `001_catalogos_y_personas_dev.sql`
   3. `002_integracion_s2_s3_s4_dev.sql`
   4. `003_escenarios_evaluaciones_cronograma_dev.sql`
   5. `004_rol_aplicacion_genares_dev.sql`
3. Ponle una contraseña al usuario que usa la aplicación:
   ```sql
   ALTER ROLE genares WITH PASSWORD 'elige-una-contraseña';
   ```
4. Ejecuta estos archivos de `backend/fixtures/`, en este orden:
   1. `permisos-consulta-mer.sql`
   2. `permisos-operacion-s4.sql`
   3. `s4-retencion-visibilidad-auditoria.sql`
   4. `s4-correccion-calificaciones.sql`
   5. `s4-sesion-evaluacion-oral.sql`
   6. `s4-asignacion-rubrica-proceso.sql`
   7. `s4-indices-rendimiento.sql`: recomendado, hace más rápidas las consultas.
   8. `verificar-retencion-visibilidad-auditoria.sql`: solo comprueba que todo quedó bien; no cambia nada.

**Opcional:** `s4-carga-volumen-dev.sql` añade 200 trabajos de prueba. Para quitarlos de las pantallas después, usa `s4-carga-volumen-dev-ocultar.sql`.

**Si algo sale mal:** después del archivo de retención (el 3 del paso 4) no se pueden repetir `002` ni `003`. Lo más simple es borrar la base y empezar de nuevo.

## 4. Configurar el backend

```powershell
Copy-Item .\backend\.env.example .\backend\.env
```

Abre `backend/.env` y pon en `DB_PASSWORD` la contraseña del paso 3.3. No cambies el usuario (`genares`) ni el nombre de la base. Este archivo no se sube a GitHub.

## 5. Arrancar

```powershell
npm run dev
```

Abre **http://127.0.0.1:5173/trabajos** en el navegador. Deberías ver 2 trabajos de prueba, o 202 si cargaste el volumen. Para detenerlo, pulsa `Ctrl+C`.

No hay inicio de sesión: se usa una identidad de prueba que ve todas las pantallas.

## 6. Comprobar que todo funciona

```powershell
npm --prefix .\backend test
npm --prefix .\frontend test
```

Las dos órdenes deben terminar sin pruebas fallidas.

## 7. App del tribunal (opcional)

Es la misma aplicación empaquetada para Android. Los pasos están en [apk-tribunal.md](apk-tribunal.md). En resumen:

```powershell
cd frontend
npm run android:build
cd android
.\gradlew assembleDebug
```

Después instálala en el teléfono o la tablet, conectado por USB, con `adb install -r` y deja el puerto conectado con `adb reverse tcp:3001 tcp:3001`.

## Cómo está organizado

- `frontend/src/modules/s4-calificaciones/`: las pantallas de S4.
- `backend/src/modules/s4-calificaciones/`: el servidor de S4.
- `backend/fixtures/`: scripts SQL que se ejecutan a mano en pgAdmin. El proyecto **no usa migraciones automáticas**, porque la base la comparten varios equipos y los cambios deben revisarse antes.
- `docs/s4/`: documentación. Lo más útil para empezar:
  - [estado-paso-1.md](estado-paso-1.md): qué requisitos están cumplidos.
  - [planificacion-integracion-s4/](planificacion-integracion-s4/): los requisitos (Paso 1) y el plan de trabajo (Pasos 2 a 5).
  - [decisiones/](decisiones/): decisiones tomadas y por qué.

## Reglas importantes

Están completas en los `AGENTS.md` de `backend/src/modules/s4-calificaciones/` y de `frontend/src/modules/s4-calificaciones/`. Las principales:

- **S4 solo trabaja en sus carpetas.** No se tocan los módulos de S1, S2 ni S3, ni los archivos compartidos, sin acordarlo con el resto de equipos.
- **En S4 no se borra nada.** Los registros se ocultan con `estado_registro = 0` y cada cambio queda en el historial.
- **Los cambios en la base van como scripts SQL** en `backend/fixtures/`, y los ejecuta una persona en pgAdmin.
- **No se suben** contraseñas, datos reales ni el archivo `.env`.
