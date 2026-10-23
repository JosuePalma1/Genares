# Matriz de datos e integración

Los sistemas 1, 2 y 3 son etiquetas conceptuales entregadas para el análisis. La auditoría no tuvo acceso a sus esquemas, equipos ni contratos; por tanto, sus entidades aquí son conceptuales. No se afirma que Sistemas 2 y 3 compartan responsable.

| Dato/entidad | Estado observado o propietario candidato | Consumidores | Contrato o decisión pendiente |
|---|---|---|---|
| Carrera | Catálogo local en Genares; autoridad maestra por confirmar | Sistemas 1–3, Genares | Código canónico, quién crea/actualiza, baja y sincronización. |
| Período académico | Catálogo local en Genares; autoridad maestra por confirmar | Sistemas 1–3, Genares | ID/código estable, fechas y reglas de transición. |
| Persona/identidad | Tabla `personas` local; identidad maestra puede ser externa | Genares y sistemas institucionales | Clave estable, tratamiento de duplicados y privacidad. |
| Elegibilidad del trabajo | Sistema 1, candidato por responsabilidad académica | Sistema documental, tribunal, Genares | Evento/endpoint, estado habilitado y cambios posteriores. |
| Trabajo e integrantes | Genares mantiene copia operativa; Sistema 1 candidato a dueño | Sistemas 2–3, Genares | ID maestro, orden/autores, retiro o sustitución de integrante. |
| Documentos/requisitos | Sistema 2, externo y no modelado | Sistema 1, Sistema 3, Genares | Referencia verificable vs copia, estados y quién puede corregir. |
| Acta | Sistema documental institucional, posiblemente Sistema 2 | Genares y sistemas que consultan resultado | Fuente, referencia, versión/rectificación y momento de disponibilidad. |
| Asignación de tribunal | Genares cuenta con entidad local; Sistema 3 es candidato según proceso | Genares, agenda y evaluación | Resolver fuente de verdad, sincronización, cancelación y conflictos. |
| Miembros/lectores | Genares los registra localmente; Sistema 3 posible origen | Genares y cronograma | Clave canónica por persona y confirmación de panel. |
| Presidencia | Atributo/rol no observado como dato separado en el esquema actual | Cronograma y acta | Confirmar si es miembro del panel, quién designa y si bloquea agenda. |
| Secretaría | Participación no modelada en cronograma | Publicación, convocatorias y actas | Asignación por sesión o bloque y política de solapamiento. |
| Modalidad | Catálogo Genares | Sistemas institucionales | Código de intercambio y autoridad de cambios. |
| Familia/versión de rúbrica | Comisión Académica en Genares | Evaluaciones y revisión de vigencias | Proceso de aprobación de versión y distribución. |
| Vigencia versión/carrera | Genares, historial local por carrera/modalidad/período | Alta/habilitación de trabajo | No confundir asociación de versión con vigencia actual. |
| Programación legacy | Genares, `programaciones_sustentacion` | Trabajo y validación ORAL legacy | Mantener como histórico; plan de corte sin escritura dual. |
| Cronograma/sesión futura | Genares, responsable operativo por definir | Sistemas 1–3, tribunal y estudiantes | Dueño del flujo, carreras incluidas, estados, publicación y notificaciones. |
| Sala/recurso | Inventario institucional aún no identificado | Agenda Genares | Catálogo canónico, clave, capacidad, cierre y mantenimiento. |
| Aprobación del Consejo | Consejo emite; Genares puede registrar evidencia | Secretaría/Comisión | Tipo de documento, folio, firma/referencia y actor registrador. Sin cuenta Consejo. |
| Evaluación/puntajes | Genares, cada lector según ámbito de etapa | Consolidación y consulta autorizada | Las reglas 10.5 permanecen vigentes; no mezclar legacy automáticamente. |
| Consolidación calculable | Genares calcula al consultar, no persiste | Lecturas autorizadas | Distinguir completitud de oficialización. |
| Resultado oficial | Regla confirmada, estructura pendiente | Sistemas 1–3 | Evento posterior a oral + acta y referencia oficial. |
| Rectificación | Excepción confirmada, flujo pendiente | Actores autorizados | Preservar versión anterior; actor, motivo, evidencia y acta rectificatoria. |
| Auditoría y notificación | Genares | Administración y personas autorizadas | Canales externos, privacidad, reintentos y retención. |

## Contenido mínimo para cada contrato futuro

Para cada dato compartido acordar dueño único, clave estable, endpoint/evento fuente, semántica de estado, autorización, política de cambio/rectificación, datos personales compartidos, idempotencia, reintento, retención y comportamiento ante indisponibilidad. Un documento no debería replicarse si una referencia verificable basta.
