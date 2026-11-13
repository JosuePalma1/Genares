# Validación de RNF-03 · prueba de carga

**Fecha:** 12/11/2026
**Ambiente:** local de desarrollo (backend NestJS en modo `dev` y PostgreSQL `genares_integrado_dev` en el mismo PC, sin red de por medio).
**Resultado:** cumple la meta técnica de RNF-03 en local. Queda pendiente repetirla en el ambiente de aceptación, como pide el requisito.

> **RNF-03 (Paso 1):** las operaciones habituales deben responder de forma utilizable bajo carga representativa; la prueba técnica fija **p95 ≤ 3 s** para consultas y guardado en línea con **25 usuarios concurrentes** y red estable.

## Cómo se probó

- **Datos.** Los 2 trabajos DEV y 200 trabajos ficticios «CARGA» creados con `backend/fixtures/s4-carga-volumen-dev.sql`:
  - 100 de DEV-TI y 100 de DEV-SOFT, con un 40 % de binas: 280 estudiantes;
  - avance repartido entre todos los estados;
  - 360 evaluaciones cerradas y 80 sesiones.
- **Usuarios.** 25 usuarios simulados a la vez, que entran de forma escalonada en unos 10 s.
- **Escenarios:**
  - **Uso realista:** cada usuario abre una pantalla al azar y espera de 0,5 a 1,5 s antes de la siguiente; 120 s.
  - **Caso extremo:** sin pausas; 60 s.
- **Peticiones**, con su peso en la mezcla:
  - lista de Trabajos (18);
  - detalle del trabajo (14);
  - evaluación, con rúbrica y notas (14);
  - consolidación de Resultados (10);
  - Cronograma (9);
  - Inicio (6);
  - Finalización (9);
  - Rúbricas (5);
  - Actas (5);
  - **guardar borrador** (10). Son escrituras reales: escritas del evaluador B en 40 trabajos CARGA, sin choques entre usuarios.
- **Script:** un script temporal de Node, que no forma parte del repositorio. Para repetirlo basta con cambiar la URL del backend.

## Resultados

Primera medición con volumen. Inicio consolidaba cada trabajo del período en cada petición:

| Escenario | p95 global | Inicio | Finalización | Guardar borrador | Errores |
| --- | --- | --- | --- | --- | --- |
| Uso realista | 5,4 s ❌ | 15,5 s ❌ | 2,9 s | 459 ms | 0 |
| Caso extremo | 10,5 s ❌ | 20,3 s ❌ | 4,4 s ❌ | 969 ms | 0 |

**Causa.** Para mostrar «Resultados completos», Inicio calculaba la nota consolidada de los 202 trabajos en cada petición. Es trabajo de procesador en el único hilo de Node, así que las demás peticiones esperaban detrás. Sin Inicio, el resto respondía con un p95 de 58 ms.

**Corrección** (`seguimiento.service.ts`):

- Inicio cuenta los estudiantes con resultado completo desde el estado calculado por estudiante, con `EVALUACION_COMPLETADA` o `FINALIZADO`, en la misma consulta del resumen.
- Antes del cambio se compararon los dos métodos sobre los 202 trabajos: dieron **los mismos 40 estudiantes**.
- Con un usuario, Inicio pasó de 1,2 s a unos 30 ms.

Medición final:

| Escenario | Peticiones | p50 | p95 | p99 | Máx. | Errores |
| --- | --- | --- | --- | --- | --- | --- |
| Uso realista | 2 815 | 18 ms | **67 ms** ✅ | 96 ms | 207 ms | 0 |
| Caso extremo | 3 754 | 232 ms | **1 391 ms** ✅ | 1 590 ms | 1 801 ms | 0 |

| p95 por pantalla | Uso realista | Caso extremo |
| --- | --- | --- |
| Lista de trabajos | 88 ms | 684 ms |
| Detalle del trabajo | 17 ms | 219 ms |
| Evaluación (rúbrica y notas) | 10 ms | 321 ms |
| Resultados (consolidación) | 26 ms | 231 ms |
| Cronograma | 45 ms | 552 ms |
| Inicio | 56 ms | 459 ms |
| Finalización | 91 ms | 1 688 ms |
| Rúbricas | 10 ms | 308 ms |
| Actas | 11 ms | 310 ms |
| Guardar borrador | 28 ms | 260 ms |

## Límites

- **Ambiente local y sin red.** RNF-03 pide medir en el ambiente de aceptación, con la red real y el backend compilado para producción.
- **Volumen.** 202 trabajos en un período. La pantalla más sensible al volumen es ahora **Finalización**, con un p95 de 1,7 s en el caso extremo, porque consolida los 10 trabajos de cada página. Si crece mucho, es la siguiente a optimizar.
- **Lo que no se midió:** el cierre de evaluaciones, la generación de PDF y la emisión de actas.
- **Identidad.** Se usó la identidad local de desarrollo; con autenticación institucional cada petición añadirá su verificación.

## Volumen de prueba

Los trabajos «CARGA» siguen visibles en la base local.

| Archivo (`backend/fixtures/`) | Conectado como | Qué hace |
| --- | --- | --- |
| `s4-carga-volumen-dev.sql` | `postgres` | Crea los 200 trabajos CARGA, con tribunal propio, aulas CARGA y sesiones en enero de 2027. Es idempotente. |
| `s4-carga-volumen-dev-ocultar.sql` | `postgres` | Los retira de la interfaz con `estado_registro = 0`; no borra nada. |
| `s4-carga-volumen-dev-mostrar.sql` | `postgres` | Los vuelve a mostrar con `estado_registro = 1`. |
