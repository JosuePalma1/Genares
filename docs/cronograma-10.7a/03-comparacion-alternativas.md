# 03 — Comparación de alternativas

## Alcance de la comparación

Las tres alternativas organizan el mismo proceso: construir una agenda, obtener aprobación externa, publicarla, reservar recursos y preservar cada reprogramación. No son cambios aprobados ni implementados. La matriz compara las nueve responsabilidades propuestas en 10.6B y la tabla `programaciones_sustentacion` que ya existe.

## Alternativas

### A. Conservar las nueve entidades propuestas

Crear `cronogramas_sustentacion`, `cronograma_carreras`, `versiones_cronograma`, `salas_sustentacion`, `sesiones_sustentacion`, `aprobaciones_externas_cronograma`, `eventos_cronograma`, `participantes_sesion` y `reservas_recurso_sesion`. Mantener `programaciones_sustentacion` como estructura legacy y establecer un corte explícito para nuevos registros.

### B. Reducir entidades y conservar una tabla nueva de sesiones

Crear siete tablas: calendario, versión, sala, sesión, evento, participantes y reservas. Derivar carreras desde los trabajos incluidos y guardar la evidencia externa en la versión. Mantener la tabla actual como origen histórico, sin escritura dual.

### C. Evolucionar la tabla actual como sesión versionada — recomendada con condiciones

Crear seis tablas nuevas: calendario, versión, sala, participantes, reservas y eventos. Evolucionar `programaciones_sustentacion` para que sus filas sean sesiones de una versión y conservar sus datos legacy. La tabla de sesiones nueva se fusiona con la existente; carrera se deriva desde trabajo y la evidencia de aprobación se almacena en la versión.

## Comparación

| Criterio | A — nueve tablas nuevas | B — siete tablas nuevas | C — seis nuevas + evolución legacy |
|---|---|---|---|
| Tablas nuevas | 9 | 7 | 6 |
| Fuente única de sesiones | No durante el corte: hay que separar legacy y sesiones nuevas | No durante el corte | Sí al concluir la migración, si todos los consumidores usan la tabla evolucionada |
| Reutilización de datos | Baja; requiere migrar o adaptar referencias | Media; conserva la tabla vieja como antecedente | Alta; reutiliza IDs y relaciones actuales de programación |
| Compatibilidad inmediata con SQL actual | Alta para filas legacy; las nuevas sesiones exigen adaptar todas las funciones consumidoras | Alta para legado; SQL nuevo debe usar sesiones | Baja durante la transición: triggers, funciones e índice actual dependen de la tabla y deben migrarse coordinadamente |
| Duplicación de agenda | Riesgo de dos representaciones mientras convivan | Dos modelos físicos de sesión | No después del corte; riesgo de convivencia durante el despliegue si no se define el corte |
| Integridad referencial | Clara entre nuevas entidades; enlace con legado pendiente | Clara en el modelo nuevo; coexistencia pendiente | Reutiliza FK a trabajo, pero cambia cardinalidad e incorpora relación con versión |
| Versionado y reprogramación | Explícitos, con el costo de trasladar datos o separar flujos | Explícitos en el modelo nuevo | Explícitos; cada versión requiere una copia completa de sus sesiones |
| Aprobación externa | Entidad independiente, útil si hay varias aprobaciones formales | Campo/registro en versión | Campo/registro en versión; una aprobación final por versión es supuesto por confirmar |
| Auditoría | Puede ser completa con eventos dedicados | Puede ser completa con eventos dedicados | Puede ser completa, pero se debe ampliar auditoría más allá de notificaciones actuales |
| Choques y concurrencia | Permite reservar recursos desde el modelo nuevo | Igual que A | Igual en capacidad; transacción debe coordinar nuevas reservas con datos y funciones legacy |
| Complejidad de migración | Media/alta: adaptación y puente entre fuentes | Media: adapta consumidores y conserva tabla antigua | Alta: altera unique por trabajo, relación TypeORM 1:1, triggers y funciones SQL existentes |
| Complejidad de aplicación | Alta por dos APIs/adaptadores durante el corte | Media/alta | Media después de migrar consumidores; alta durante transición por compatibilidad |
| Mantenimiento a largo plazo | Alto: dos conceptos para la sesión y reglas de convivencia | Alto: la tabla legacy no desaparece del esquema | Menor si se retira la ruta legacy de escritura y se mantiene compatibilidad de lectura necesaria |
| Condición para elegir | La separación histórica debe prevalecer sobre reutilización | Se requiere migrar gradualmente sin cambiar la tabla legacy | Se autoriza una migración coordinada y se demuestra que triggers/consumidores pueden adaptarse |

## Evaluación

- **A** minimiza el cambio sobre SQL actual y separa con claridad lo nuevo, pero conserva dos modelos de programación y necesita una regla permanente para que no diverjan.
- **B** reduce el diseño de 10.6B con cambios moderados, pero también deja dos tablas capaces de representar la sustentación de un trabajo.
- **C** es la opción con una sola fuente de sesiones a largo plazo y aprovecha la FK al trabajo y la identidad ya almacenada. Es también la alternativa con mayor riesgo de corte técnico porque las reglas SQL ya dependen de `programaciones_sustentacion`.

## Recomendación y condición de salida

Se recomienda **C**, condicionada a un inventario de consumidores y a una migración aditiva/revisada que preserve filas, adapte la relación uno-a-uno, reescriba las reglas dependientes y defina qué hacer con programaciones existentes cuya aprobación no esté documentada. No se puede afirmar que la migración sea segura hasta inspeccionar datos y ejecutar una validación aislada; esta etapa no conectó a PostgreSQL.

La recomendación de C actualiza la alternativa A de compatibilidad que se había considerado en 10.6B. La diferencia es explícita: 10.6B favorecía aislar el esquema existente; esta auditoría prioriza una sola fuente de sesiones a largo plazo, pero reconoce que lograrla cuesta más durante la migración y depende de un corte coordinado.

Si el inventario descubre consumidores externos que no pueden cambiar en el mismo corte o si no se permite alterar el contrato actual, usar **B** como transición con una API/adaptador de lectura, fecha de corte y plan explícito para no escribir en ambos modelos. No se recomienda A como estado permanente salvo que la Universidad exija mantener ambas agendas como dominios separados.

## Riesgos que requieren resolver antes de implementar

1. Filas vigentes y realizadas en la tabla actual, su procedencia y los documentos de aprobación disponibles.
2. Semántica de sesión: una por trabajo o varias sesiones por trabajo/estudiante.
3. Corte de lectura/escritura y consumidores que hoy inspeccionan la tabla directamente.
4. Duración, zona horaria, catálogo/propiedad de salas y recursos que bloquean simultaneidad.
5. Si la evidencia de aprobación es una por versión o si existen varias instancias/formalidades.
