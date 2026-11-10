# AGENTS.md — Genares S4 · Frontend y experiencia de tribunal

> Instrucciones para agentes de IA que trabajen **dentro de `frontend/src/modules/s4-calificaciones/`**. Adaptación del protocolo histórico `protocolo_completo_para_agentes_de_ia.md`, los documentos Paso 1–5 y los avances reales del proyecto. No aplicar a S1/S2/S3 ni presentar trabajo pendiente como terminado.

## 1. Lectura obligatoria y prioridades

1. Antes de editar, consultar el `README.md`, el código y pruebas vigentes, **Paso 1 (RF/RNF/RN)**, **Paso 2 (MF-01…MF-07, CT-01…CT-03 y navegación)**, **Paso 3 (tecnología)**, **Paso 4 (estructura y responsables)**, **Paso 5 (GitHub y tareas)**, el MER unificado y los documentos pertinentes bajo `docs/s4/`. Buscar la ubicación real de los pasos; no asumir rutas que aún no existan.
2. Identificar la pantalla, componente, hook, servicio, adaptador y test **existentes** antes de añadir nuevos. Respetar las mejoras funcionales de las etapas 1–5 del proyecto local.
3. No confundir **los cinco documentos de planificación**, **los seis pasos de desarrollo/integración** ni las **etapas funcionales anteriores**; son conceptos diferentes.
4. Si una instrucción histórica contradice una decisión posterior o el MER vigente, **no sustituir ni reescribir reglas silenciosamente**. Explicar la discrepancia y solicitar aprobación para un cambio normativo.

## 2. Arquitectura, ubicación y límites

- Solución objetivo: **un mismo frontend React/Vite** para los cuatro subsistemas y un backend NestJS compartido; una sola PostgreSQL, accesible **solo mediante API**, nunca desde React. La app Android del tribunal usará **Capacitor** cuando se implemente, reutilizando el módulo S4 y la misma API; no crear una app ajena ni duplicar lógica.
- Trabajar principalmente en **`frontend/src/modules/s4-calificaciones/`**. El código real actual usa **JS/JSX** en su módulo y **TypeScript/TSX** en algunos puntos de entrada. No convertir masivamente a TypeScript ni mover todo solo por uniformidad; respetar las decisiones del repositorio común cuando corresponda integrar.
- `frontend/src/shared/`, `src/App.tsx`, `src/main.tsx`, configuraciones Vite, `package.json`, rutas globales y recursos compartidos requieren **coordinación con integración**. No sobrescribirlos con el arranque de la versión independiente de Genares. No modificar los módulos frontend de S1, S2 o S3.
- La arquitectura existente del módulo incluye `domain/`, `infrastructure/`, `presentation/`, `routes.jsx`, páginas, hooks, componentes y servicios. Reutilizarla; crear capas nuevas solo si una función lo justifica. No crear pantallas provisionales paralelas ni carpetas vacías.
- La futura experiencia Android del tribunal podrá ubicarse, cuando el equipo lo acuerde, en `frontend/src/apps/tribunal/` y su configuración Capacitor correspondiente; esa ruta es un **objetivo de arquitectura, no prueba de que la APK ya esté implementada**.
- Desarrollo local **sin Docker**; no incorporar `node_modules`, `dist`, `.env` privados, datos institucionales reales, copias de código ni ZIP al repositorio.

## 3. Responsabilidad funcional de S4 y navegación

- S4 **no administra** estudiantes, temas, grupos, tutores, tribunales o expedientes de S2/S3; los **consulta**. S2 es origen de asignaciones de temas, grupos y tutores; S3 es origen de asignaciones de tribunal, archivos de tesis e historial de fase. S4 es dueño de **rúbricas, evaluaciones, resultados, cronograma, seguimiento, PDF/actas propias y trazabilidad**.
- Mantener las secciones de S4 según el catálogo de navegación del Paso 2: inicio, trabajos, cronograma, mis evaluaciones, rúbricas, seguimiento, resultados, documentos y auditoría, con visibilidad según rol/permiso. No exponer alta o edición de estudiantes, tutores o integrantes de tribunales desde S4.
- Utilizar los servicios/adaptadores HTTP existentes. Datos `DEV` son ejemplos ficticios; nunca usar prefijos de fixture como filtros de producción ni presentar evaluaciones de prueba como datos institucionales.
- No inventar usuarios estudiantes como actores de login. El tribunal califica únicamente sus evaluaciones. Comisión Académica, Coordinación, Presidencia/Asistencia y Secretaría tienen distintos permisos y ámbitos; ocultar botones **no sustituye** la autorización del backend.

## 4. Formularios, rúbricas y calificaciones: conservar comportamiento aprobado

1. **Reutilizar `FormularioRubrica` y sus componentes existentes**, no sustituirlo por un formulario reducido o una segunda versión provisional. Mantener categorías identificadas con letras, indicadores numerados por categoría, ponderaciones, observaciones y subtotales visibles.
2. **Diseño responsive** para navegador y tablet, con comprobaciones a 360, 768 y 1440 px; el resumen/total de etapa debe ser legible, con suficiente espacio y sin tapar controles. Conservar los ajustes de navegación, foco, validación y estado visual de campos incompletos.
3. **Rúbricas variables** por modalidad y versión. No inventar categorías, indicadores, anexos o ponderaciones: leer estructura real de la rúbrica. La revisión escrita es compartida por trabajo cuando el instrumento lo indique; la oral es independiente **por estudiante y evaluador**.
4. **Borradores:** mantener guardado y recuperación de progreso, revisión y manejo de errores; una desconexión o recarga no debe perder avances confirmados. Distinguir visualmente «guardado en servidor», «pendiente de sincronizar» y «cerrado». Un borrador **no** es un cierre.
5. **Concurrencia:** no sobrescribir cambios silenciosamente cuando el servidor rechace una revisión obsoleta. Conservar y mostrar al usuario el avance local que no se haya podido confirmar.
6. **Cierre:** validar indicadores obligatorios y esperar confirmación del servidor. Al cerrar, deshabilitar edición ordinaria; no cerrar por el simple hecho de guardar un borrador ni por cambiar de pantalla.
7. **Resultados:** no presentar una nota final definitiva mientras falten evaluaciones requeridas; tampoco contar una calificación pendiente como 0. Conservar resultados separados por estudiante y evaluador, y las sumas/promedios de cada etapa conforme a la versión de rúbrica.
8. **Precisión y reglas:** preservar los valores exactos durante los cálculos y respetar la regla vigente del backend: **`ROUND_HALF_UP` a dos decimales únicamente al presentar calificaciones**. Ejemplos: `9,444 → 9,44`, `9,445 → 9,45`, `9,446 → 9,45`, `8,125 → 8,13`. La regla antigua de redondear al alza solo cuando el tercer decimal sea estrictamente mayor que 5 **ya fue descartada**. Evitar errores por punto flotante y no cambiar otros comportamientos ni expectativas de pruebas sin aprobación.
9. **Escala:** el ejemplo institucional escrito 5 + oral 5 = máximo 10 no autoriza aplicar siempre la misma estructura a toda modalidad; preservar aportes originales y normalización de visualización cuando proceda.
10. **Umbral provisional:** la nota mínima `7.00` está confirmada en desarrollo como **provisional**; no escribir mensajes que la presenten como disposición institucional definitiva.

## 5. Cronograma, documentos y experiencia de tablet

- **S4** programa sustentaciones y las reprograma manteniendo historial: fecha, horas **planificadas**, duración sugerida/ajustable, aula y participantes; comprobar conflictos de aula y de evaluador, permitiendo simultaneidad cuando no compartan aula ni evaluadores.
- Binas: una sesión conjunta o sesiones separadas; cada estudiante conserva sus evaluaciones. No perder borradores, notas ni trazabilidad al separar o reprogramar sesiones.
- **No incorporar inicio/fin real de la sustentación**, botones para iniciar/finalizar evento ni protocolo de confirmación desde tablet. El alcance acordado es de horario **previsto**, no asistencia ni cronometraje de defensa.
- Los **documentos institucionales de S4** (PDF de rúbrica y acta interna) deben reflejar versiones y resultados confirmados, mantener las escalas correctas y no inventar códigos académicos, títulos, firmas o aprobaciones. La emisión definitiva de actas con códigos académicos reales está pendiente de validación.
- **Perfil C — Offline/Capacitor:** en la futura APK, preservar localmente borradores de forma duradera frente a corte de red, cierre y reinicio; reintentos idempotentes y resolución de conflictos; cierre formal y emisión de PDFs solo con servidor. **No confundir una recuperación tras recarga conectada con offline completo**.
- **Perfil A — Auditoría UX/QA:** verificar estados vacíos, mensajes de error, seguridad en navegación, accesibilidad y ausencia de datos ficticios presentados como reales.
- **Perfil D — Documentos:** mantener páginas de consulta/descarga autorizadas y contenido académico correcto; no inventar plantillas ni emisión automática.

## 6. Estado del proyecto y límites de una integración futura

- La base actual de Genares es una aplicación independiente organizada en `s4-calificaciones`, **no** una integración ya fusionada con el repositorio común. Una copia del proyecto reportó compilaciones y pruebas exitosas, pero el agente debe repetir lo relevante después de cambios.
- En el código actual conviven páginas de compatibilidad, referencias a desarrollo y la adaptación al MER; **comprobar antes de borrar** cualquier pantalla o servicio. Evitar duplicaciones, sin romper rutas existentes ni funcionalidad aprobada.
- El trabajo de integración al repositorio común debe ser **selectivo**. Un agente de S4 no reemplaza `App.tsx`, `main.tsx`, estilos generales, scripts ni `package.json` del repositorio compartido con los del prototipo.
- Pendientes funcionales del desarrollo posterior: **identidad y permisos institucionales**, **validación real de actas** y **recuperación de borradores ante pérdida de conexión**. No declarar entregada la APK solo porque esté prevista en los documentos.
- El protocolo anterior incluye notificaciones automáticas RF-49/RN-31, pero la documentación de cinco pasos está numerada RF-01…RF-48/RN-01…RN-30. Verificar aprobación antes de crear pantallas o funciones de correo.

## 7. Proceso de trabajo y pruebas

1. Localizar la RF/RN y tarjeta S4-xx relacionada y seguir el componente, servicio y endpoint **existentes**.
2. Hacer **el mínimo cambio necesario** dentro del módulo. Mantener estilos institucionales, accesibilidad, navegación y comportamiento del formulario; no refactorizar por estética ni crear otra app.
3. Añadir/ajustar pruebas relevantes. Desde la raíz del proyecto, con dependencias disponibles, ejecutar:
   - `npm --prefix ./frontend run build`
   - `npm --prefix ./frontend test`
   - Si se altera contrato con el backend, verificar también sus pruebas y compilación.
   - Comprobar visualmente la interfaz en móvil, tablet y escritorio cuando cambie el diseño.
4. Informar **qué cambió, qué se probó y qué quedó pendiente**. No asegurar que se comprobó una pantalla, API o conexión si no se ejecutó.
5. No modificar datos de PostgreSQL, crear proyectos ZIP, hacer commits, push, PR o merges sin petición expresa. Si se requieren cambios en `shared/`, arranque global, dependencias o configuración, proponerlos para revisión del responsable de integración.

**Regla principal:** la interfaz debe seguir representando fielmente las reglas y operaciones ya validadas de S4, sin invadir otros subsistemas ni perder avances de Genares.
