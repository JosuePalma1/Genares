# 10.9D — Sistema abierto sin usuarios ni roles

## Resultado

El modo local permite recorrer las pantallas académicas sin seleccionar una cuenta o perfil. No hay inicio de sesión ni menú de usuarios. Los estudiantes siguen siendo registros académicos y no tienen acceso propio al sistema. La API conserva cerrada la operación cuando no se cumplen las condiciones de desarrollo local.

## Cambios realizados

- Se retiraron del frontend la pantalla de acceso, la administración simulada de usuarios y la ruta de resultados personales de estudiante. La ruta obsoleta cae en la página de ruta no encontrada.
- Se conserva la navegación a trabajos, evaluaciones, resultados académicos, documentos, catálogos, secretaría y coordinación, sin compuertas por perfil en la interfaz.
- Se eliminó la selección de miembros ficticios para evaluar. En el flujo de evaluación, la API ofrece el tribunal confirmado del trabajo y valida que el miembro seleccionado pertenezca a él. La selección del evaluador identifica la asignación académica, no una cuenta de usuario.
- Los datos locales antiguos se migran al cargarse: se quitan los campos de perfiles simulados y se conservan estudiantes, docentes y demás registros académicos.
- En backend, el acceso abierto se instala solo con `NODE_ENV=development`, `LOCAL_DEV_OPEN_ACCESS=true`, conexión loopback y coincidencia de la huella de la base local 10.9B (`127.0.0.1:55442/genares_dev_10_9`, marca `GENARES:10.9B:DEVELOPMENT`). Se rechaza el encabezado de identidad simulada. Las escrituras exigen origen loopback permitido, `Sec-Fetch-Site: same-origin`, JSON e intención local explícita.
- El actor técnico `GENARES:LOCAL_DEVELOPMENT` se conserva para auditoría; no representa a una persona ni a un estudiante. Las validaciones académicas, pertenencia al tribunal, cierre y consistencia siguen ejecutándose en el backend.
- Las evaluaciones y consultas institucionales continúan disponibles mediante sus rutas académicas; no se ofrece un endpoint de consulta con identidad propia de estudiante.

## Migración y datos

Se añadió `1760000014000-actor-tecnico-programaciones-locales.ts`. Permite registrar programaciones locales con actor técnico, mantiene la referencia histórica a cuenta nullable y exige exactamente uno de los dos actores. La reversión se detiene si ya existen programaciones auditadas con el actor técnico, para evitar perder esa atribución.

La migración se aplicó solo a la base local autorizada 10.9B, comprobando host, puerto, nombre y marca. No se reescribieron migraciones anteriores ni se modificaron notas, rúbricas, estudiantes, trabajos o actas históricos. Las pruebas 9D utilizaron el runner protegido con `-PreservarBasesPrueba`; las bases temporales creadas quedaron preservadas.

## Inicio y detención

Desde la raíz del repositorio:

```powershell
npm run dev
```

Este comando valida e inicia la base de desarrollo 10.9B si hace falta, luego inicia Vite (`http://127.0.0.1:5173`) y NestJS (API en `http://127.0.0.1:3001/api/v1`). Detén los procesos con `Ctrl+C`. La base PostgreSQL que ya estuviera encendida antes del comando permanece encendida.

Comandos separados:

```powershell
npm run dev:web
npm run dev:api
```

`dev:web` es el prototipo frontend sin API institucional; `dev:api` inicia NestJS y su base local verificada. 9D se reserva para integración y no se necesita para el uso diario. No se usa la base 8E ni se conecta a los puertos 55440 o 5432.

En producción, no habilitar `LOCAL_DEV_OPEN_ACCESS`. El arranque normal no instala el middleware local y las rutas protegidas responden sin identidad verificada con `401`; la identidad técnica tampoco se admite con `NODE_ENV=production`. La autenticación institucional sigue pendiente antes de exponer la API en una red de producción.

## Datos de demostración y acoplamientos

Se conservaron las carreras TI y SOFT y los registros académicos sintéticos existentes. La consulta local confirmó dos trabajos de ejemplo: uno de TI con dos estudiantes y uno de SOFT con un estudiante; ambos tienen tribunal de dos miembros y rúbrica asociada. El evaluador utilizado se obtiene del tribunal confirmado. Estos son fixtures de desarrollo, no una verificación de expedientes históricos reales.

La identidad técnica está acoplada temporalmente a la inicialización HTTP de NestJS, a una lista de capacidades locales y a la auditoría de programaciones. Para la futura integración CORE convendrá sustituir esa inicialización por una identidad institucional verificada y un contrato compartido de trabajo/persona. No se creó CORE, autenticación real ni administración definitiva de roles.

## Validaciones ejecutadas

- Backend unitario: 16 suites, 88 pruebas aprobadas.
- PostgreSQL 9D protegido: cuatro suites y 40 pruebas aprobadas (carreras, vigencias, rúbricas y ciclo de evaluaciones/programaciones/documentos); el runner preservó las bases temporales.
- Frontend: 40 archivos de prueba, 192 pruebas aprobadas.
- Build NestJS: aprobado.
- Build Vite: aprobado.
- `npm run dev`: frontend y backend iniciaron; peticiones sin encabezados de identidad a salud, carreras, modalidades, rúbricas, trabajos, estudiantes y tribunales recibieron respuestas correctas desde la base local 10.9B.
- Producción: las pruebas unitarias/API verifican que la configuración de desarrollo local se rechaza en `production` y que las rutas protegidas sin identidad reciben `401`.
- `git diff --check`: aprobado; Git mostró únicamente avisos de conversión LF/CRLF en archivos existentes.

## Pendientes

- Integrar autenticación institucional antes de desplegar el backend fuera del equipo local.
- Definir con CORE el contrato de identidad técnica y las referencias de persona/trabajo compartidas.
- Completar pruebas visuales manuales de los flujos desde navegador; las comprobaciones de esta entrega fueron de API, pruebas automatizadas e inicio local.
