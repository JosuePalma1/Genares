# Estado de los requisitos del Paso 1

**Actualizado:** 12/11/2026, sobre la rama `feature/mer-unificado-pasos-3-4`.
**Fuente:** [Paso 1 v1.2](planificacion-integracion-s4/Paso_1.md).

Solo se listan los requisitos que una revisión del 11–12/11/2026 encontró incompletos y cómo quedaron. El resto se consideró cumplido en esa revisión. «Comprobado» indica qué se ejecutó de verdad; no se marca nada como probado sin haberlo ejecutado.

## Resueltos

| Requisito | Qué se hizo | Comprobado |
| --- | --- | --- |
| RF-22, RF-24 · Ocho estados del proceso | El estado se calcula desde los datos, por estudiante y por trabajo: el del estudiante con menor avance (`ESTADO_CALCULADO_TRABAJO`, en `trabajos.service.ts`). Lo usan Trabajos, el filtro por estado, Inicio, Finalización y la ficha de la evaluación. Solo `FINALIZADO` sigue siendo un estado guardado. | Pruebas unitarias. Consultas en la base local, con variantes simuladas y una bina con avance desigual. Los 202 trabajos de carga se reparten en los estados esperados. |
| RF-31 · Sincronización de la cola local | Los borradores del dispositivo que el servidor no ha confirmado se envían solos: al abrir la app, al volver la conexión y cada 20 s. Se excluye el borrador abierto en la pestaña. Cada envío lleva su revisión y su identificador de operación. Un rechazo deja la cola intacta. Un aviso en la barra superior muestra los pendientes y los conflictos (RF-32). | Pruebas unitarias. En Chrome: borrador guardado sin API, salida de la pantalla y envío automático al volver la API. |
| RF-17, RN-03, PA-04 · Etapas por modalidad | Decisión institucional: toda modalidad tiene escrita y oral, que aportan 5 + 5 = 10. Lo que varía se configura en cada versión: categorías, indicadores, máximos y porcentajes. Ver [decisión](decisiones/2026-11-12-etapas-escrita-oral.md). | Revisión del código y de la versión DEV-1. |
| RF-15, RF-16 · Rúbricas creadas desde la pantalla | Las versiones creadas en «Nueva rúbrica» quedaban en `CONFIGURADA`, con etapas `PERSONALIZADA`, y no se podían editar ni activar. Ahora quedan en `BORRADOR`, con etapas `ESCRITA`/`ORAL` y categorías sin repetir. El recorrido es BORRADOR → ACTIVA → ARCHIVADA. | Código real contra la base local, en una transacción con `ROLLBACK`: creación y activación de una versión nueva y de una copia de DEV-1. |
| RF-11, RF-19 · Rúbrica aplicable a cada trabajo | Al abrir la evaluación de un trabajo sin proceso, se le asigna la única versión ACTIVA y vigente de su modalidad, carrera y período. Si no hay ninguna, o hay varias, se dice qué falta. Solo funciona en el entorno local, como el guardado de evaluaciones. | Pruebas unitarias y consulta de solo lectura en la base local. **No se ha creado de verdad** el proceso de un trabajo nuevo, porque no hay ninguno sin proceso. |
| RNF-03 · Rendimiento | Con 202 trabajos y 25 usuarios: p95 de 67 ms en uso realista y de 1,4 s en el caso extremo, con guardados incluidos. Para lograrlo, Inicio cuenta los resultados completos con SQL en vez de consolidar cada trabajo. | Prueba de carga local; ver [validación](validacion-rnf-03-carga.md). **Falta repetirla en el ambiente de aceptación.** |
| RNF-14 · Accesibilidad (parcial) | Se corrigieron: el encabezado a 768 px, el botón «Volver» a 360 px, la línea de avance (inaccesible con teclado) y unas diez etiquetas `aria-label` sin rol. | axe-core 4.10 (WCAG 2.1 A/AA) sobre 21 pantallas a 360, 768 y 1440 px, sin infracciones. Prueba de foco con Tab real y de desborde horizontal. **Sin lector de pantalla real.** |

También quedaron resueltos con los cambios del 11/11/2026: RF-13 (filtros), RF-15 y RF-20 (retiro de versiones), RF-46, RN-16 y RN-26 (oral ligada a su sesión), RF-48, RN-28 y PA-07 (sesiones separadas en binas), RN-27 y PA-08 (motivo de reprogramación) y RNF-09 (respaldo nativo de borradores en la APK).

## Pendientes que dependen de otros

| Requisito | Qué falta | De quién depende |
| --- | --- | --- |
| RF-01, RF-03, RF-04, RF-05, RN-10, PA-01 | Identidad institucional, roles y ámbito de carrera. Mientras tanto quedan parciales RF-02, RF-07, RF-45, RN-11 y RNF-06. | Institución e integración (`auth/` es compartido). |
| RF-06, RF-26, RF-35, RN-24 | Guardar y cerrar evaluaciones fuera del modo de desarrollo, comprobando que el evaluador es quien firma. | Necesita la identidad anterior. |
| RF-12 | La consulta histórica solo incluye asignaciones `VIGENTE`. Hay que confirmar si S2 cambia el estado al terminar. | Equipo de S2. |
| RF-44 | Actas con códigos académicos reales. | Validación institucional. |
| RNF-02, RNF-11 | Tablet Android e iPad. Hasta ahora solo se probó la APK en un teléfono Android de 720 × 1600. | Equipos de prueba. |
| RNF-05 | HTTPS en el despliegue. | Ambiente de aceptación. |
| RNF-17 | Suite de extremo a extremo de PA-01 a PA-18. | Se puede preparar en local; queda por definir su alcance. |

## Scripts SQL nuevos

Se ejecutan en pgAdmin, conectado como `postgres`, después de los del README (`backend/fixtures`). Todos son idempotentes.

| Archivo | Obligatorio | Qué hace |
| --- | --- | --- |
| `s4-asignacion-rubrica-proceso.sql` | **Sí**, para la asignación automática de la rúbrica | Concede a `genares` `INSERT` sobre `s4.procesos_evaluacion`; no concede `UPDATE` ni `DELETE`. Ya aplicado en la base local. |
| `s4-carga-volumen-dev.sql` | No, solo para pruebas de carga | Crea 200 trabajos ficticios «CARGA». Ya aplicado; siguen visibles. |
| `s4-carga-volumen-dev-ocultar.sql` / `-mostrar.sql` | No | Ocultan o muestran ese volumen con `estado_registro`. |
