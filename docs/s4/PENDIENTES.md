# Lo que falta en Genares S4

**Actualizado:** 12/11/2026.
Para poner el proyecto en marcha, ver [PRIMEROS-PASOS.md](PRIMEROS-PASOS.md). El detalle de cada requisito está en [estado-paso-1.md](estado-paso-1.md).

## En pocas palabras

Las funciones de S4 están hechas y probadas en local:

- rúbricas y sus versiones;
- cronograma de sustentaciones;
- evaluaciones escrita y oral, con borradores que se guardan aunque se corte la conexión;
- cálculo de notas y redondeo;
- estados de cada trabajo y de cada estudiante;
- seguimiento, documentos PDF y auditoría;
- la app del tribunal para Android.

Lo que falta:

- probar todo de principio a fin;
- mejorar la experiencia de uso;
- llevar S4 al repositorio común;
- conectarlo con los usuarios reales de la institución.

## 1. Se puede hacer ya

| Tarea | Qué hay que hacer |
| --- | --- |
| **Mejorar la experiencia y la interfaz** | Ver la sección 3. Es lo más visible para quien use el sistema. |
| **Pruebas completas de aceptación** (RNF-17, tarea S4-17) | Automatizar los escenarios PA-02 a PA-18 del Paso 1 (sección 9) contra el sistema funcionando de verdad. Hoy hay unas 560 pruebas automáticas, pero cada una prueba una pieza suelta. Sugerencia: usar datos de prueba propios (por ejemplo, con el prefijo «E2E») y ocultarlos al terminar. |
| **Revisión de seguridad** | Revisar el servidor de S4: permisos, datos que se aceptan y mensajes de error. |
| **Completar el README** | Añadir `s4-asignacion-rubrica-proceso.sql` a la tabla de scripts del `README.md` principal. El orden completo ya está en PRIMEROS-PASOS.md. |

## 2. Depende de otras personas

| Tarea | Qué falta | Con quién |
| --- | --- | --- |
| **Usuarios reales y permisos** | Hoy se entra con una identidad de prueba que lo ve todo. Falta el inicio de sesión institucional, los roles y que cada persona vea solo su carrera. Mientras no exista, el guardado y el cierre de evaluaciones solo funcionan en el modo de pruebas, y no se comprueba quién firma. | Institución y responsable del repositorio común (la carpeta `auth/` es compartida). |
| **Llevar S4 al repositorio común** | Hoy esta rama es una aplicación independiente. Hay que pasar solo las carpetas de S4, sin reemplazar archivos compartidos, mediante solicitudes de integración revisadas (Paso 5). | Responsable de integración. |
| **Actas oficiales** | Las actas en PDF se generan, pero sin los códigos académicos reales. | Institución. |
| **Nota mínima** | El 7,00 está puesto como provisional. | Institución. |
| **Trabajos terminados** | Confirmar si S2 cambia el estado de una asignación cuando el trabajo termina, para la consulta del historial. | Equipo de S2. |
| **Correos automáticos** | No están en los requisitos aprobados. Hay que confirmar si se piden. | Coordinación. |
| **Ambiente de aceptación** | Publicar el sistema con HTTPS, repetir ahí la prueba de rendimiento y probar en tablet Android e iPad. | Responsable de despliegue. |

## 3. Experiencia e interfaz (UX/UI)

Observaciones de revisar las pantallas principales a 1440 px. La accesibilidad básica ya se corrigió; ver RNF-14 en [estado-paso-1.md](estado-paso-1.md).

### Lo más importante

1. **Se muestran identificadores internos en vez de nombres.** En Trabajos, el detalle del trabajo, Mis evaluaciones y Resultados aparecen códigos largos como `a6cf3b0c-d212-75ed-…` como si fueran el código del trabajo, el del estudiante o el de la rúbrica. El usuario debería ver el título del trabajo, el nombre del estudiante y la versión («DEV-1»), no esos códigos.
2. **Hay lenguaje técnico a la vista:**
   - «MER UNIFICADO · S2 + S3 + S4»;
   - «Tribunal de S3», «Evaluadores de S3», «Estudiante de S2»;
   - «Prueba local con PostgreSQL»;
   - «Se consultan desde S4»;
   - «Dashboard» en la ruta de navegación.

   Quien evalúa no necesita saber de qué subsistema viene cada dato. Mejor: «Tribunal», «Evaluadores», «Estudiante».
3. **Mis evaluaciones está muy cargada.** Cada trabajo muestra muchos botones («Evaluar oral | Estudiante1…», «Resultado | Estudiante1…»…) y datos separados por barras «|». Mejor: un botón principal por trabajo y lo demás dentro.

### También conviene

4. **Avisos al inicio de cada pantalla.** Recuadros como «Alcance institucional», «Resultado consultivo» o «Prueba local» empujan el contenido hacia abajo. Se pueden acortar, juntar o mostrar una sola vez.
5. **Nombres que no coinciden:**
   - el menú dice «Mis evaluaciones», pero la página se titula «Evaluaciones» y su ruta empieza en «Gestión académica»;
   - el menú dice «Inicio», pero la página se llama «Resumen operativo».
6. **Evaluación oral.** Antes de llegar al formulario hay que pasar por la estructura completa de la rúbrica y la lista de escritas. Mejor poner primero el formulario y dejar lo demás plegado.
7. **Estados en mayúsculas.** En la lista de escritas aparece «CERRADA»; mejor «Cerrada», como en el resto de pantallas.
8. **Filtros de Trabajos.** Se ven nueve filtros a la vez y el del período se corta («DEV-2026B (ac»). Mejor mostrar los principales y dejar el resto en «Más filtros».
9. **Detalles menores:**
   - «202 trabajo(s)» podría ser «202 trabajos»;
   - en Resultados, las etiquetas redondas de estado («Completa») son muy grandes.

### Antes de cambiar

- **La insignia «Estado: 1 · visible»** de cada tarjeta se puso por una decisión aprobada sobre registros visibles y ocultos ([decisiones/2026-11-10-retencion-visibilidad-auditoria.md](decisiones/2026-11-10-retencion-visibilidad-auditoria.md)). Si confunde, hay que acordar el cambio antes de quitarla.
- **Revisar a 360, 768 y 1440 px.** Probar cada cambio en móvil, tablet y escritorio, como piden las reglas del módulo.
- **No crear un formulario de rúbrica nuevo:** las reglas piden mejorar el que ya existe (`FormularioRubrica`).

## 4. Datos útiles

- **Base local:** además de los 2 trabajos DEV, tiene 200 trabajos «CARGA» de prueba. Se ocultan con `backend/fixtures/s4-carga-volumen-dev-ocultar.sql`.
- **Rendimiento:** con 202 trabajos y 25 usuarios a la vez, el sistema responde rápido (ver [validacion-rnf-03-carga.md](validacion-rnf-03-carga.md)). La pantalla más lenta es Finalización.
- **Avisos ya conocidos:**
  - si un trabajo tuviera un proceso antiguo sin rúbrica, la evaluación muestra un mensaje genérico;
  - al copiar una versión de rúbrica y editarla en el mismo paso, los porcentajes se reparten por igual.
