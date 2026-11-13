# Decisión: etapas de la rúbrica (escrita y oral)

**Fecha:** 12/11/2026
**Estado:** confirmada por el responsable de S4 a partir de lo informado por la institución. No requiere cambios de código ni de base de datos.
**Requisitos:** RF-17, RN-03, PA-04 (Paso 1 v1.2).

## Decisión

1. **Toda versión de rúbrica tiene exactamente dos etapas:** una escrita, compartida por el trabajo (`ESCRITA`, `TRABAJO_COMPARTIDO`), y una oral, individual por estudiante (`ORAL`, `ESTUDIANTE_INDIVIDUAL`). Es la norma institucional vigente para todas las modalidades.
2. **No se usan etapas `PERSONALIZADA`** en versiones activas. El tipo existe en el código y la base acepta cualquier valor, pero no hay ninguna rúbrica documentada que lo necesite.
3. **La escrita aporta 5 puntos y la oral 5, total 10.** En el sistema esto se representa así: cada etapa se califica sobre su propio máximo (hoy 10,00) y pesa un porcentaje (hoy 50 % cada una). Ejemplo: una escrita de 8,60 aporta 4,30; una oral de 10,00 aporta 5,00; la nota final es 9,30 sobre 10,00. Es equivalente a «5 + 5 = 10».

## Cómo se cumple RF-17 / RN-03 / PA-04

Lo que cambia entre modalidades no es el número de etapas, sino su contenido: categorías, indicadores, máximos de cada indicador y porcentaje de cada etapa. Todo eso se configura por versión de rúbrica. No se crea ninguna etapa de anexos de forma automática.

Comprobado el 12/11/2026 en `genares_integrado_dev`: la versión activa DEV-1 tiene la escrita con máximo 10,00 y porcentaje 50,00, y la oral con máximo 10,00 y porcentaje 50,00.

## Dónde está cada regla

| Regla | Archivo |
|---|---|
| Activar exige exactamente `ESCRITA` + `ORAL` | `backend/src/modules/s4-calificaciones/rubricas/reglas-borrador-rubrica.ts` (`validarEstructuraActivableRubrica`) |
| El borrador no admite tipos repetidos y fija el alcance de cada tipo | mismo archivo (`validarEstructuraBorradorRubrica`) |
| Crear una rúbrica completa exige que cada etapa sume 10,00 | `backend/src/modules/s4-calificaciones/rubricas/reglas-rubrica-completa.ts` y `frontend/src/modules/s4-calificaciones/infrastructure/repositories/rubricasEscritura.js` |
| El editor conserva solo `ESCRITA` y `ORAL` | `frontend/src/modules/s4-calificaciones/domain/estructuraRubrica.js` |
| Nota final = suma de (promedio de la etapa ÷ máximo de la etapa) × porcentaje, sobre 10,00; sin porcentajes, reparte por igual | `backend/src/modules/s4-calificaciones/evaluaciones/mer/borrador-oral.reglas.ts` (`detallarConsolidacionMer`) |

## Si la norma cambia en el futuro

Ninguno de estos cambios está aprobado. Se dejan anotados para que el sistema pueda adaptarse sin rehacerlo.

**Una etapa adicional o personalizada.** La base ya la admite (`s4.etapas_rubrica.kind` es texto) y el cálculo de la nota final ya combina cualquier número de etapas siempre que los porcentajes sumen 100 %. Habría que:

- relajar `validarEstructuraActivableRubrica` y `validarEstructuraBorradorRubrica`;
- permitir el tipo en el editor (`estructuraRubrica.js`);
- revisar el cálculo del estado del trabajo (`ESTADO_CALCULADO_TRABAJO` en `trabajos.service.ts`), que distingue la etapa escrita para el estado «Revisión escrita pendiente».

**Una modalidad con solo una etapa.** Mismos archivos que el caso anterior. El cálculo del estado ya omite la revisión escrita cuando la rúbrica no tiene etapa escrita.

**Otra escala, por ejemplo sobre 20.** Es el cambio más amplio, porque el máximo final de 10,00 está fijo en varios puntos:

- el cálculo (`calificacionMaxima: '10.00'` en `borrador-oral.reglas.ts`);
- las actas y PDF (`documentos/archivo-actas.ts`, `documentos.service.ts`, `modelo-documental.ts`, `pdf-documental.ts`, `reglas-acta.ts`);
- la comprobación del frontend (`infrastructure/repositories/evaluacionesApi.js`);
- los textos «sobre 10» de las pantallas de resultados y documentos.

Lo correcto sería guardar la escala en la versión de rúbrica y leerla desde ahí. La nota mínima provisional (7,00) tendría que reinterpretarse en la nueva escala.

## Defecto encontrado: las versiones creadas desde la pantalla no se pueden activar

**Comprobado el 12/11/2026** contra `genares_integrado_dev`, con el código real de `RubricasService`. La prueba se ejecutó dentro de una transacción que terminó con `ROLLBACK`: no quedó ninguna versión de prueba y DEV-1 sigue activa.

Recorrido: crear una rúbrica con el mismo cuerpo que envía «Nueva rúbrica» (`POST /rubricas/completas`) y activarla.

| Paso | Resultado |
|---|---|
| Crear la versión | Se crea en estado `CONFIGURADA`, con las dos etapas de tipo `PERSONALIZADA` y sin porcentaje |
| Activarla | Rechazada (409): «Solo se pueden activar versiones en estado BORRADOR» |
| Editarla para corregirla | No es posible: `actualizarVersion` también exige `BORRADOR`, y la pantalla de detalle solo permite editar borradores |
| Solo dentro de la prueba: forzar `BORRADOR` y activar | Rechazada (400): «La versión debe configurar las etapas escrita y oral» |
| Solo dentro de la prueba: además, corregir el tipo a `ESCRITA`/`ORAL` | El editor la rechaza (400): «Los órdenes de categoría no puede repetirse». La creación numera las categorías por etapa (1, 1) y el editor exige un orden único en toda la versión |
| Solo dentro de la prueba: además, renumerar las categorías (1, 2) | Activación aceptada |

**Conclusión:** una versión creada desde «Nueva rúbrica» queda en un estado sin salida. No se puede editar ni activar. Hay tres causas en `guardarVersionCompleta` (`rubricas.service.ts`):

1. termina en `CONFIGURADA` y no en `BORRADOR`;
2. guarda las etapas como `PERSONALIZADA` en lugar de `ESCRITA`/`ORAL`;
3. numera las categorías por etapa.

Según el código, crear una versión nueva a partir de otra (`POST /rubricas/:id/versiones/completas`, `copiarEstructuraComoDtos`) pasa por el mismo método y pierde también el tipo y el porcentaje de la versión base. Este recorrido no se ejecutó.

DEV-1 funciona porque se creó con SQL de fixture, no desde la pantalla.

### Corrección aplicada (12/11/2026)

Aprobada por el responsable de S4. El recorrido de una versión es **BORRADOR → ACTIVA → ARCHIVADA**.

- **Estado inicial.** `guardarVersionCompleta` deja la versión nueva en `BORRADOR`. Se revisa y se activa desde la pantalla de detalle. Ya no se crean versiones en `CONFIGURADA`; el valor sigue existiendo en el código, pero ningún flujo lo asigna.
- **Tipo de etapa.** Se deduce del alcance (`tipoEtapaDesdeAlcance`): compartida → `ESCRITA`, individual → `ORAL`.
- **Copias.** Al copiar una versión, se conserva el porcentaje de cada etapa de la versión base.
- **Orden de las categorías.** Se numeran sin repetir en toda la versión (`ordenesCategoriaEnVersion`).
- **Códigos de categoría.** La activación también exige que no se repitan en toda la versión.
  - «Nueva rúbrica» los genera ahora así: C1 y C2 en la escrita, C3 en la oral (`agregarCategoriaRubrica`).
  - El backend rechaza un código repetido al crear, para que el error no aparezca recién al activar.
  - La base solo exige unicidad por etapa.

**Verificación.** Se ejecutó el código real contra `genares_integrado_dev` con `ROLLBACK`:

- una versión creada como «Nueva rúbrica» queda en `BORRADOR`, con `ESCRITA`/`ORAL` y categorías C1, C2 y C3, y se activa;
- una copia de DEV-1 conserva `ESCRITA`/`ORAL` y 50 % + 50 %, y se activa;
- tras el `ROLLBACK`, DEV-1 sigue activa y no quedó ninguna versión de prueba.

Se ejecutaron además las pruebas y compilaciones de backend y frontend.

**Al activar.** Activar una versión nueva en el mismo período archiva la versión activa anterior de esa rúbrica. Es el comportamiento previsto: hay una sola versión activa por rúbrica y período.

## Asignación de la rúbrica a cada trabajo (12/11/2026)

**Problema.** Ningún código creaba el proceso de evaluación de un trabajo, que es lo que liga el trabajo a su versión de rúbrica. Los trabajos DEV lo tenían solo porque los creó el SQL de los fixtures. Un trabajo nuevo de S2 no se podía evaluar, y nadie recibía un aviso si una rúbrica no se había activado.

**Decisión (la opción simple, aprobada por el responsable de S4).** La rúbrica se asigna sola la primera vez que se abre la evaluación del trabajo:

- `GET /evaluaciones/mer/:asignacionId` busca la versión **activa y vigente** de la modalidad, la carrera y el período del tema, con las mismas condiciones que `s4.validar_rubrica_proceso`, y crea el proceso con esa versión.
- Si no hay ninguna, responde 409 con un mensaje que dice qué falta. Ejemplo: «No hay rúbrica activa para Proyecto integrador · Software · 2026-B. Pida que se active la versión correspondiente en Rúbricas».
- No hace nada si el trabajo ya tiene proceso (visible u oculto), si la asignación no está `VIGENTE` o si aún no tiene tribunal.
- La versión queda fija aunque luego se active otra (RF-19). Los trabajos que ya tenían proceso no cambian.
- Igual que el guardado de borradores, solo funciona en la base local de desarrollo.

Quedan fuera por ahora:

- corregir a mano una asignación;
- asignar procesos por lotes;
- avisar en Inicio de las modalidades sin rúbrica activa.

**Requisito en la base.** `backend/fixtures/s4-asignacion-rubrica-proceso.sql` concede `INSERT` sobre `s4.procesos_evaluacion` a `genares`. Lo ejecuta el usuario en pgAdmin como `postgres`.

**Implementación:** `asignarRubricaVigente` y `CONSULTA_RUBRICA_VIGENTE_ASIGNACION` en `evaluaciones/mer/evaluaciones-mer.service.ts`; pruebas en `evaluaciones-mer.asignacion-rubrica.spec.ts`.
