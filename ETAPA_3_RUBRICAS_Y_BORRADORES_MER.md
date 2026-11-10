# Etapa 3 — Rúbrica del MER y borradores orales en PostgreSQL local

## Qué puedes probar ahora

- **Trabajos de titulación** lista asignaciones S2 vigentes con tribunal S3; no filtra por el nombre `DEV`.
- **Rúbricas** (`/rubricas`) muestra las versiones, vigencia, etapas e indicadores de la base unificada en modo consulta; evita entrar al editor antiguo incompatible.
- En **Ver expediente** aparece **Ver rúbrica y evaluaciones**.
- La nueva pantalla consulta las tablas `s4.versiones_rubrica`, `s4.etapas_rubrica`, `s4.categorias_rubrica`, `s4.indicadores_rubrica`, `s4.evaluaciones` y `s4.calificaciones_evaluacion`.
- Muestra las notas escritas que los seeders dejaron cerradas, sin permitir editarlas.
- Permite **crear y actualizar borradores orales** por estudiante y evaluador, escribiendo exclusivamente en las tablas S4 de la base local de desarrollo.
- Impide puntajes mayores al máximo del indicador, pertenencia incorrecta de estudiantes S2, tribunal no asignado por S3, sobreescritura de evaluaciones cerradas y colisiones de revisión.
- Deja registro del guardado en `s4.eventos_auditoria_evaluacion`.

## Configuración SIN Docker

1. Descomprime este ZIP en una carpeta nueva, sin mezclarlo con la etapa anterior.
2. Copia tu configuración `backend/.env` de la etapa 2 al mismo lugar de esta etapa (no está incluida ni se sobrescribe).
3. Verifica estos valores de **desarrollo local**, además de tus credenciales ya configuradas:

   ```ini
   NODE_ENV=development
   DB_HOST=localhost
   DB_NAME=genares_integrado_dev
   ENABLE_INTEGRACION_DEV=true
   LOCAL_DEV_OPEN_ACCESS=true
   LOCAL_DEV_WRITE_ORIGINS=http://127.0.0.1:5173
   ```

   **Importante:** no publiques el servidor; el acceso de desarrollo solo está autorizado en loopback y únicamente con base `genares_integrado_dev`. Cuando se habilita `ENABLE_INTEGRACION_DEV=true`, la identidad técnica local solo recibe la capacidad para guardar borradores integrados, no las capacidades antiguas del prototipo.

4. Desde PowerShell, dentro de la nueva carpeta del proyecto:

   ```powershell
   npm --prefix .\backend ci
   npm --prefix .\frontend ci
   npm run dev
   ```

5. Abre `http://127.0.0.1:5173/rubricas` para ver el catálogo de versiones; luego abre `http://127.0.0.1:5173/trabajos`, entra al expediente de la bina TI y haz clic en **Ver rúbrica y evaluaciones**. También puedes entrar directamente por el enlace que aparece en el expediente. La pantalla de rúbrica no requiere que S2 ni S3 estén ejecutándose.

6. Elige **Juan**, un **evaluador** y asigna un puntaje oral de prueba entre `0` y `10` (o el máximo indicado por el indicador). Haz clic en **Guardar borrador oral**. Después recarga la página: debe aparecer el puntaje guardado con una revisión incrementada.

7. Cambia a **María**: su borrador es independiente. Cambia de evaluador: cada integrante del tribunal tiene su propia evaluación.

### Comprobación rápida en pgAdmin (solo SELECT)

```sql
SELECT t.titulo AS tema,
       e.id_estudiante, e.id_asignacion_tribunal,
       e.etapa, e.estado, e.revision,
       e.calificacion_total, e.actualizado_en,
       COUNT(ce.id) AS indicadores_guardados
FROM s4.evaluaciones e
JOIN s4.procesos_evaluacion p ON p.id = e.id_proceso_evaluacion
JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
JOIN gen.tema t ON t.id = a.tema_id
LEFT JOIN s4.calificaciones_evaluacion ce ON ce.id_evaluacion = e.id
WHERE e.etapa = 'ORAL'
GROUP BY t.titulo, e.id, e.id_estudiante, e.id_asignacion_tribunal,
         e.etapa, e.estado, e.revision, e.calificacion_total, e.actualizado_en
ORDER BY t.titulo, e.actualizado_en;
```

## Alcance y límites importantes

- **No se ejecutan migraciones** y no se necesitan seeders adicionales. No ejecutes `npm run db:migrate`, `migration:run` ni `synchronize` sobre la base unificada.
- Esta etapa **no habilita calificaciones oficiales**, cierre/firma de evaluaciones, modificación de rúbricas, cronograma ni generación de actas.
- **No hay login real por evaluador**: la selección de un docente en esta pantalla es solo para simular pruebas. Este módulo se bloquea fuera de desarrollo local y nunca debe publicarse como endpoint de producción.
- Los borradores se guardan al pulsar el botón y deben confirmar el guardado. **Aún no hay recuperación automática de notas sin conexión**: no utilices esta pantalla para una sustentación real ni como sustituto del mecanismo de protección de borradores previsto para la aplicación final.
- La consulta de trabajos no depende del texto `DEV`, pero los datos de los seeders siguen teniendo nombres `DEV` porque son ficticios. No son datos oficiales.
- Solo lectura de S1/S2/S3; ningún `INSERT`, `UPDATE` ni `DELETE` sobre esas tablas.
- No borramos ni alteramos las evaluaciones escritas cerradas del seeder.
- Si `LOCAL_DEV_OPEN_ACCESS=false`, los datos se leen pero el botón de guardar aparece deshabilitado, como medida de seguridad.
- No se ha ejecutado esta versión contra tu instancia de PostgreSQL: la compilación y la prueba funcional definitiva deben realizarse en tu computadora.

## Problemas frecuentes

- **Error 401/403 al guardar**: comprueba `LOCAL_DEV_OPEN_ACCESS=true`, `LOCAL_DEV_WRITE_ORIGINS` y que uses la URL exacta `http://127.0.0.1:5173` (no `localhost:5173`). Reinicia backend después de cambiar `.env`.
- **Error 409 al guardar**: la evaluación fue modificada en otra pestaña o no tiene una sesión de sustentación programada; recarga y comprueba el caso.
- **No aparece la rúbrica**: confirma que cargaste los tres seeders y que `s4.procesos_evaluacion.id_version_rubrica` no esté vacío.
- **No aparece la pantalla**: usa `npm run dev` desde el proyecto nuevo y entra desde **Trabajos → Ver expediente**.
