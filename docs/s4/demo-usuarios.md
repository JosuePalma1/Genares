# Demostración por roles: usuarios de prueba

**Solo en la rama `demo/accesos-por-rol`.** Sirve para mostrar qué ve y qué puede hacer cada actor de S4 mientras no exista el inicio de sesión institucional. **No es autenticación real** y no debe llevarse al repositorio común: la rama de integración sigue siendo `feature/mer-unificado-pasos-3-4`.

## Usuarios

Contraseña común para todos: **`Demo2026!`**

| Usuario | Persona | Rol | Qué ve |
| --- | --- | --- | --- |
| `tribunal.ti` | María Docente TI A | Tribunal | Solo el trabajo donde es tribunal (1, de TI) |
| `tribunal.soft` | Lucía Docente Software A | Tribunal | Solo el trabajo donde es tribunal (1, de Software) |
| `tribunal.carga` | Ana Docente Carga TI A | Tribunal | Los unos 40 trabajos CARGA de su tribunal |
| `coordinacion.ti` | Coordinación TI | Coordinación | Solo la carrera TI |
| `coordinacion.soft` | Coordinación Software | Coordinación | Solo la carrera Software |
| `presidencia` | Presidencia | Presidencia / Asistencia | TI y Software |
| `comision.ti` | Comisión Académica TI | Comisión Académica | Solo TI, en consulta |
| `secretaria` | Secretaría | Secretaría | TI y Software, resultados y documentos |
| `admin.tecnico` | Administración técnica | Administración técnica | Ningún trabajo: solo catálogos y auditoría |

## Qué puede hacer cada rol

| Rol | Puede | No puede |
| --- | --- | --- |
| **Tribunal** | Ver sus trabajos y sus sesiones; calificar, guardar y cerrar **solo sus propias** evaluaciones; pedir una corrección | Ver trabajos de otros tribunales, firmar por otro evaluador, gestionar rúbricas o programar |
| **Coordinación** | Todo lo de su carrera: programar y reprogramar, rúbricas, seguimiento, finalizar trabajos, emitir actas, autorizar correcciones, auditoría | Ver la otra carrera o calificar en nombre del tribunal |
| **Presidencia / Asistencia** | Consultar las dos carreras, programar y finalizar | Editar rúbricas, calificar o ver auditoría |
| **Comisión Académica** | Consultar trabajos, seguimiento, resultados y rúbricas de su carrera | Cambiar nada |
| **Secretaría** | Consultar resultados y emitir actas de las dos carreras | Editar notas, rúbricas o programación |
| **Administración técnica** | Consultar catálogos y auditoría | Ver trabajos o notas |

El menú solo muestra las opciones de cada rol (Paso 2, Anexo A.4). Además, **el servidor vuelve a comprobar el permiso en cada operación**: aunque alguien escriba la dirección de una pantalla a mano, recibe «Acceso denegado».

## Cómo ponerla en marcha

1. Cambia a la rama: `git checkout demo/accesos-por-rol`.
2. En pgAdmin, como `postgres`, ejecuta una vez `backend/fixtures/demo-usuarios-por-rol.sql`. Crea las cuentas de los roles que no son docentes y vincula a Ana con los trabajos CARGA. Requiere haber ejecutado antes `s4-carga-volumen-dev.sql`.
3. Arranca como siempre: `npm run dev`.
4. Abre **http://127.0.0.1:5173**: te llevará a la pantalla de entrada. Haz clic en un usuario de la lista, escribe la contraseña y entra. Para cambiar de usuario, usa el botón de salir, arriba a la derecha.

Sin el paso 2 la demostración funciona igual, salvo `tribunal.carga` y la creación de sesiones desde Coordinación y Presidencia.

## Cómo funciona por dentro

- **Backend** (`backend/src/common/api/identidad-demo.ts` y `contexto-alcance.ts`):
  - la entrada devuelve un token firmado, que cambia en cada arranque del backend;
  - cada petición con ese token recibe la identidad del usuario: su rol, sus permisos y su ámbito (carreras, o «solo sus trabajos» si es tribunal);
  - las consultas de trabajos, cronograma, seguimiento, finalización, documentos, resultados y correcciones aplican ese ámbito;
  - una sesión caducada no da acceso: el servidor responde 401 y la pantalla vuelve a la entrada.
- **Frontend** (`presentation/services/sesionDemo.js`, `pages/PaginaEntrar.jsx`, `domain/navegacionDemo.js`):
  - guarda la sesión y la envía en cada petición;
  - muestra al usuario arriba y filtra el menú por rol.
- **Sin sesión**, en las pruebas automáticas o con el backend de la rama de integración, todo funciona como antes, con la identidad local.

## Lo que se puede reutilizar y lo que no

- **Reutilizable cuando llegue la identidad institucional:**
  - el filtrado por carrera y por tribunal en las consultas;
  - la comprobación de que el tribunal solo firma sus evaluaciones (RN-24);
  - el menú por rol.

  Responden a requisitos reales (RF-03 a RF-05). Solo habría que cambiar de dónde salen el usuario y su rol.
- **Exclusivo de la demostración:**
  - la pantalla de entrada;
  - la contraseña común;
  - la lista de usuarios de `identidad-demo.ts`.

## Límites

- Funciona solo en el entorno local de desarrollo, como la identidad de pruebas de siempre.
- Al reiniciar el backend todas las sesiones caducan y hay que volver a entrar.
- Las pantallas que no dependen de un trabajo (rúbricas, modalidades, carreras) muestran todo el catálogo; lo que cambia es si el rol puede editarlo.
