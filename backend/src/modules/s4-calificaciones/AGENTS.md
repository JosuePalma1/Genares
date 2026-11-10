# AGENTS.md — Genares S4 · Backend

> Instrucciones para agentes de IA que trabajen **dentro de `backend/src/modules/s4-calificaciones/`**. No son instrucciones para los módulos S1, S2 ni S3. Este archivo adapta el protocolo original `protocolo_completo_para_agentes_de_ia.md` a las decisiones posteriores, los documentos Paso 1–5 y el código vigente. No modifica requisitos académicos por sí mismo.

## 1. Antes de tocar código: leer, localizar y comprobar

1. Leer este archivo, el `README.md` del proyecto y los documentos normativos disponibles de Genares: **Paso 1 (requisitos), Paso 2 (módulos y responsabilidades), Paso 3 (arquitectura), Paso 4 (estructura y propiedad de carpetas), Paso 5 (tareas, GitHub y entregas)**; el MER unificado vigente; y la documentación histórica bajo `docs/s4/` que corresponda a la tarea. Los cinco archivos pueden estar bajo una carpeta `docs/s4/planificacion-integracion-s4/` o en otra ubicación: **localizarlos; no dar por hechas rutas inexistentes**.
2. Identificar en el código vigente el controlador, servicio, entidad, consulta SQL, prueba y ruta que ya resuelven la tarea. Preferir **modificar y reutilizar** antes que duplicar.
3. Distinguir **los cinco documentos de planificación**, **los seis pasos de la ruta global** y **las etapas funcionales previas del prototipo**; no convertirlos en nuevas fases ni sustituir la planificación original.
4. Si dos fuentes discrepan (p. ej. antiguo protocolo, requisito, MER, implementación), **no elegir silenciosamente**. Priorizar decisiones explícitas y posteriores confirmadas por el equipo; señalar el conflicto específico y no cambiar reglas académicas sin autorización.
5. Nunca afirmar que algo «está probado», «cerrado» o «integrado» sin evidencias concretas de compilación, pruebas y, cuando corresponda, PostgreSQL. Las pruebas locales del desarrollador son evidencia reportada, no necesariamente repetida por el agente.

## 2. Arquitectura y límites de propiedad

- La solución final es **un monolito modular**: **un repositorio compartido, un backend NestJS, un frontend React/Vite y una base PostgreSQL unificada** con esquemas `gen`, `s1`, `s2`, `s3`, `s4`. No crear microservicios, bases separadas, un «nuevo Genares», servidores exclusivos para cada subsistema, proyectos paralelos o ZIP de sustitución.
- El desarrollo local usa **PostgreSQL instalado en Windows**, pgAdmin y la base de prueba `genares_integrado_dev`; **no usar Docker**. No ejecutar migraciones, sincronización automática de ORM, reinicios de datos ni seeders destructivos sin instrucción expresa.
- **S1** administra sus requisitos y procesos. **S2** administra asignaciones de temas, estudiantes/grupos y tutores. **S3** administra documentos de tesis, historial académico y asignaciones/miembros del tribunal. **S4** administra rúbricas, evaluaciones, borradores, calificaciones, cronograma planificado, resultados, seguimiento, documentos propios de evaluación y trazabilidad.
- S4 **consulta** los datos de S1/S2/S3 mediante el backend y la base compartida: **no crea ni modifica** sus estudiantes, temas, grupos, tutores, documentos de tesis ni tribunales. No confundir un controlador heredado con autorización para editar datos maestros.
- Escritura ordinaria del agente: **solo** `backend/src/modules/s4-calificaciones/`. Las carpetas `backend/src/auth/`, `backend/src/common/`, `backend/src/config/`, los `package.json`, el arranque `src/app.module.ts`/`src/main.ts`, y migraciones/esquemas son **compartidos**: documentar el ajuste propuesto y coordinar revisión con integración antes de modificarlos. Nunca sobrescribir globales con los del prototipo autónomo.
- Las carpetas `s1-requisitos`, `s2-temas`, `s3-documentos` pertenecen a otros equipos. No editarlas. La estructura `domain/application/infrastructure/presentation` es una guía práctica; **no crear carpetas vacías o refactorizaciones cosméticas**.

## 3. Contrato del MER vigente: comprobar columnas reales antes de codificar

- Una asignación evaluable se identifica desde **`s2.asignacion_tema`**; el tema académico está en **`gen.tema`**, y los integrantes de binas se obtienen desde las relaciones de S2, como `s2.grupo_integrante`. Los tutores son consultados desde S2. La trayectoria de las fases se consulta desde `s3.tema_historial` cuando aplique.
- La asignación de tribunal proviene de **`s3.asignacion_tribunal`** (y sus relaciones), no de una copia S4.
- El proceso propio de evaluación vive en **`s4.procesos_evaluacion`**, enlazado con `s2.asignacion_tema` y la **versión de rúbrica vigente**. No recrear `s4.trabajos_titulacion`, `s3.trabajos_titulacion` ni tablas paralelas de estudiantes/trabajos/tutores/tribunales.
- Las evaluaciones viven en las tablas efectivas de S4, incluyendo **`s4.evaluaciones`**. En la etapa **escrita** y anexos compartidos se califica el trabajo por evaluador; la etapa **oral** se califica **individualmente para cada estudiante y evaluador**, vinculada a la sustentación cuando corresponda.
- El cronograma pertenece a S4. Las tablas de programación existentes incluyen **`s4.programaciones_sustentacion`** y su asociación **`s4.programacion_estudiante`** (verificar las columnas exactas en el MER/SQL antes de escribir). Una bina puede sustentar junta o por separado; no imponer unicidad de una sola sesión por trabajo. Las reprogramaciones conservan integridad, historial y evaluaciones.
- Los documentos de tesis de S3 no son los **PDFs de evaluación y actas** de S4. Nunca fabricar datos institucionales, firmas, títulos, códigos académicos o aprobaciones.
- En la copia histórica del protocolo aparecen **nombres de tablas anteriores** (`s4.trabajos_titulacion`, `s4.estudiantes_sesion_sustentacion`, etc.). **No trasladarlos automáticamente al código**. Confirmar contra el MER vigente y la base real.
- Los datos con prefijo `DEV` son **fixtures ficticios**, no una regla de negocio ni un filtro de producción. No exponer a estudiantes o docentes reales.

## 4. Reglas de negocio que no se deben romper

1. **Rúbricas y versiones:** variación por modalidad y vigencia; cada proceso queda ligado a una versión; la versión ya aplicada no se altera silenciosamente. La asignación automática puede corregirse manualmente solo por actor autorizado. No asumir que toda rúbrica tiene las mismas etapas ni que siempre existen anexos.
2. **Escalas:** respetar los máximos y aportes definidos por la versión real. El instrumento documentado admite 5 puntos escritos + 5 orales = 10; si un documento muestra cada componente normalizado sobre 10, no alterar su aporte original. No hardcodear un modelo único para todas las modalidades.
3. **Precisión y redondeo vigente:** mantener toda la precisión en los cálculos intermedios y aplicar **`ROUND_HALF_UP` a dos decimales** únicamente cuando corresponda presentar la calificación. Ejemplos: `9,444 → 9,44`, `9,445 → 9,45`, `9,446 → 9,45`, `8,125 → 8,13`. La regla antigua de incrementar **solo si el tercer decimal es mayor que 5** fue descartada y **no debe reintroducirse**. En los cálculos y pruebas usar aritmética decimal precisa para evitar errores del punto flotante. No alterar reglas de negocio ni código probado fuera de esta decisión aprobada sin autorización.
4. **Evaluadores y resultados:** ninguna nota ausente equivale a cero. Mantener independiente la evaluación de cada docente; promediar/agregar solo cuando estén cerradas **todas las evaluaciones exigibles**, respetando si la etapa es compartida o individual. No copiar la nota oral del estudiante A al B.
5. **Borradores y concurrencia:** conservar cambios y revisión; rechazar escrituras con versión obsoleta, sin sobrescritura silenciosa. Un borrador guardado no equivale a una evaluación cerrada; el cierre exige validación y confirmación del servidor. Tras cerrar, la evaluación no se modifica por operaciones ordinarias. Una corrección extraordinaria requiere permisos, motivo, evidencia y auditoría según la especificación aplicable.
6. **Cronograma:** S4 programa fecha, hora prevista de inicio y fin, aula, evaluadores y estudiantes, con duración sugerida y posible ajuste, reprogramación auditada y detección de solapamiento **por aula o por evaluador**. Sesiones simultáneas en aulas diferentes con tribunales disjuntos son admisibles. **No implementar hora real de inicio/fin, botones de iniciar/finalizar defensa ni protocolo de confirmación en tablet**: expresamente excluidos de las decisiones posteriores del proyecto.
7. **Estados:** distinguir evaluación propia del docente, resultado de cada estudiante y estado agregado del trabajo; el cierre administrativo y archivo documental son operaciones separadas de completar calificaciones.
8. **Nota mínima aprobatoria:** `7.00` está actualmente configurada como **provisional** en el entorno dev; no presentarla como normativa oficial sin ratificación institucional.
9. **Seguridad:** verificar en **NestJS**, no solo frontend, rol, permisos, ámbito de carrera (TI y Software), pertenencia a tribunal, destinatario y estado. S4 no administra cuentas/roles institucionales. `LOCAL_DEV_OPEN_ACCESS` y la selección manual de docente se permiten únicamente para pruebas locales, nunca en producción.
10. **Documentos y auditoría:** generar PDFs a partir de resultados confirmados; respetar códigos académicos oficiales antes de emitir actas definitivas, la trazabilidad de correcciones y los justificativos PDF cuando proceda. No crear firmas electrónicas ni escribir notas en el SGA sin nuevo alcance aprobado.
11. **Notificaciones:** el antiguo protocolo menciona RF-49/RN-31 y correo asíncrono; la línea base de cinco pasos identifica RF-01 a RF-48/RN-01 a RN-30. **Tratar las notificaciones automáticas como requisito por confirmar en la fuente aprobada**, no como implementación completada ni como autorización para agregar librerías por cuenta propia.

## 5. Estado real y pendientes: no declararlos completados

- El proyecto S4 independiente fue organizado en `s4-calificaciones`, compilado y probado en el entorno local según reportes del equipo. Se preservaron formularios, rúbricas, evaluaciones, borradores, resultados, cronograma, documentos y trazabilidad; consultar el código real para precisar qué ruta usa cada flujo.
- Pruebas reportadas: 99 de backend, 233 de frontend y 18 consultas HTTP; pruebas de reprogramación y auditoría reportadas exitosas tras el permiso `GRANT INSERT ON s4.eventos_trazabilidad_trabajo TO genares;`. **No suponer que una ejecución futura también pasará sin repetirla.**
- La **integración selectiva al repositorio común** aún no se ha realizado. La rama de Genares es una aplicación independiente y no se debe sustituir `app.module.ts`, `main.ts`, manifiestos ni configuración global del repositorio compartido.
- Pendientes confirmados para trabajo funcional posterior: **autenticación institucional**, **validación de actas con códigos académicos reales** y **recuperación duradera de borradores ante pérdida de conexión**. La APK/Capacitor requiere constatar implementación real antes de marcar avance.
- No confundir documentos Paso 1–5, pasos globales 1–6 e hitos E0–E7 con entregas funcionales «Etapa 4/5».

## 6. Perfiles del protocolo original aplicables al backend

- **Perfil A — Auditor normativo/QA:** revisa permisos, estado, precisión, vínculos S2/S3, integridad de evaluaciones y pruebas negativas.
- **Perfil B — Persistencia PostgreSQL:** revisa FKs, integridad de binas/sesiones, idempotencia, concurrencia, reprogramación y trazabilidad. No migra tablas sin autorización ni asume que un MER lógico equivale a una migración ejecutada.
- **Perfil D — PDFs/comunicaciones:** verifica escala del acta y la rúbrica, datos institucionales, auditoría y límites de emisión. No inventa servicios de correo ni considera emitido un documento solo por generar una vista previa.
- **Perfil C — Offline/tablet:** aporta el contrato de servidor para operaciones idempotentes y resolución de conflictos; la persistencia local se implementa en frontend, y **ningún cierre formal offline** se confirma.

## 7. Ejecución y verificación de cada tarea

1. **Inspeccionar** los archivos afectados y los requisitos aplicables (RF/RN/RNF/tarea S4-xx). Escribir alcance, riesgos y módulos externos implicados.
2. **Modificar lo mínimo**, conservando rutas, pruebas y datos existentes. Añadir pruebas del comportamiento y de regresión; no corregir una regla cambiando unilateralmente el resultado esperado.
3. **Comprobar**, cuando existan dependencias, desde la raíz del proyecto:
   - `npm --prefix ./backend run build`
   - `npm --prefix ./backend test`
   - Si hay interacción frontend, ejecutar las verificaciones del frontend también.
   - Para pruebas contra PostgreSQL, usar una **base local controlada** y transacciones reversibles cuando sea posible; nunca usar datos reales ni ejecutar fixtures destructivos por defecto.
4. **Informar** archivos modificados, pruebas efectivamente ejecutadas y sus resultados, cambios de contrato propuestos, tareas pendientes y bloqueos. Si una prueba no pudo ejecutarse, decirlo expresamente.
5. **Git y coordinación:** no hacer commit, push, PR o merge automáticamente. Cambios en compartidos/configuración/BD deben pasar por revisión del equipo correspondiente; nunca modificar `main` por iniciativa propia.

**Regla principal:** proteger lo que ya funciona; no inventar, duplicar, reorganizar por estética ni sobrepasar la responsabilidad de S4.
