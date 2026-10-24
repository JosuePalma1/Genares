# 10.8B — Consolidación y documentos internos

## Implementación

- Se reutiliza la consolidación dinámica existente: resultado individual `/10`, promedio exacto de etapas y evaluadores, y redondeo `HALF_UP` final. No se crea una fórmula paralela ni se deduce escrita/oral por el nombre de las etapas.
- La emisión exige los dos evaluadores requeridos, evaluaciones cerradas y completas, resultado válido y datos identificativos mínimos. Si falta algo, el API devuelve un conflicto con etapas/evaluadores pendientes; no convierte faltantes en cero ni archiva el acta.
- Las rúbricas siguen disponibles por estudiante y evaluador. Una etapa compartida usa el registro original solo si existe el traspaso al estudiante; una individual usa su propia evaluación. El PDF preserva criterios, textos, máximos, puntajes, subtotales y procedencia, sin cambiar datos.
- PAT-01-F-019 y PAT-04-F-017 se generan como documentos internos en PDF. Incluyen el resultado `/10`, umbral aplicado, estado aprobatorio, identificación, trabajo, modalidad, tutor, tribunal, etapas, número y espacios de firma. La reimpresión recupera el mismo archivo y número. La numeración es secuencial por carrera/período y compartida por ambos formatos.
- La pantalla de documentos permite consultar/imprimir/guardar los PDF, muestra resultado aprobado/reprobado y permite editar el umbral solo si la identidad tiene autorización administrativa. También presenta la fecha de actualización disponible.

## Configuración y persistencia

La nueva migración aditiva `1760000013000-nota-minima-actas.ts` añade el umbral configurable (inicial `7.00/10`), historial append-only y snapshots nullable de nota final, umbral y aprobación en `actas_archivadas`. La transacción de emisión bloquea el umbral vigente y archiva juntos el PDF y esos valores. Cambios posteriores no alteran documentos previos. Las actas existentes conservan sus nuevos campos nulos; no se convierten datos históricos. No se modificaron migraciones anteriores ni se aplicaron cambios a una base persistente.

La comparación usa centésimas enteras, sin `Number` para la regla académica. La auditoría del umbral es transaccional. Consultar, generar una rúbrica o imprimir no altera notas, evaluaciones ni estados académicos.

## API añadida o extendida

- `GET/PUT /api/v1/documentos/configuracion/nota-minima` — lectura y actualización autorizada.
- `GET /api/v1/documentos/trabajos` y `GET /api/v1/documentos/trabajos/:id` — trabajos visibles y contexto, resultados y pendientes.
- `GET /api/v1/documentos/trabajos/:id/estudiantes/:estudiante/rubricas/:miembro` y `/pdf` — rúbrica individual por evaluador.
- `GET /api/v1/documentos/trabajos/:id/estudiantes/:estudiante/acta-preliminar` — vista previa sin consecutivo.
- `POST /api/v1/documentos/trabajos/:id/estudiantes/:estudiante/actas` — emisión interna desde datos calculados por el servidor.
- `GET /api/v1/documentos/actas`, `/actas/:id` y `/actas/:id/pdf` — consulta, archivo y reimpresión.

## Compatibilidad y límites

Las evaluaciones históricas `ESCRITA/ORAL` no se reinterpretan como etapas dinámicas. Los documentos históricos no reciben nuevas notas automáticamente. La escala `/20` no se usa. No se agrega oficialización, firma digital, resolución ni transición de estado académico. El umbral `7.00` es provisional hasta confirmación institucional. La identidad desplegada debe otorgar `configuracion-academica:administrar` a quienes puedan editarlo y `documentos:emitir` a los emisores autorizados.

## Validación

- Backend unitario (runner 9D): 93 pruebas pasaron; 4 suites/39 pruebas PostgreSQL se excluyeron de ese comando y se ejecutaron aparte.
- PostgreSQL 9D protegido: 4 suites, 39 pruebas pasaron (carreras, vigencia por carrera, rúbricas, evaluaciones/documentos). Incluyó autorización, auditoría y rollback, datos incompletos, resultados 6.99/7.00/8.74, etapas y ámbitos mixtos, PDF de ambas plantillas, concurrencia, snapshots, reimpresión idéntica y ausencia de cambios a evaluaciones/estados de los fixtures. Las pruebas usaron datos sintéticos; no se consultaron historiales reales. Las bases temporales verificadas se preservaron.
- Frontend: 37 archivos de prueba, 188 pruebas pasaron.
- `npm run build` NestJS: aprobado.
- `npm run build` Vite: aprobado; Vite advierte que el bundle JavaScript minificado supera 500 kB.
- `git diff --check`: ejecutado al cierre.

Durante la validación se corrigieron el manejo del resultado `UPDATE ... RETURNING` de TypeORM, la devolución del formato al reimprimir y la pérdida de motivos de pendientes en conflictos HTTP 409. Las trazas de errores SQL inyectados en las suites corresponden a pruebas de rollback.
