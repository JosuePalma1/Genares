# 10.6A — Matriz de responsabilidades de datos

Los nombres “Sistema 1”, “Sistema 2” y “Sistema 3” son etiquetas conceptuales del encargo. La estructura real, propiedad de datos y mecanismos de integración no están descritos en el repositorio. No se afirma que los sistemas 2 y 3 tengan el mismo equipo.

| Entidad/dato | Propietario observado o propuesto | Consumidores / integración | Estado y observación |
|---|---|---|---|
| Carreras | Catálogo institucional en Genares hoy; autoridad maestra pendiente | Sistemas 1–3 y Genares | Actual local; acordar fuente canónica/código. |
| Modalidades | Genares | Sistemas 1–3 | Actual local. |
| Periodos académicos | Genares hoy; sincronización institucional pendiente | Todos | Actual local. |
| Personas | Genares hoy, posible identidad maestra externa pendiente | Todos | Actual; normalizar identificadores. |
| Perfiles estudiante | Genares hoy; datos base potencialmente Sistema 1 | Sistemas 1–3 | Actual local; Sistema 1 debe definir datos habilitantes. |
| Perfiles docente | Genares hoy; referencias externas posibles | Sistemas 2–3 y Genares | Actual local. |
| Cuentas de usuario | Genares | Módulos internos | Actual; sujeto de autenticación externo nullable. |
| Roles de cuenta | Genares | API | Actual, autorización interna. |
| Alcances de carrera por cuenta | Genares | API | Actual, filtra acceso administrativo por carrera. |
| Familia de rúbrica | Genares/Comisión Académica | Sistema 3, evaluación | Actual. |
| Versión de rúbrica | Genares/Comisión Académica | Evaluación | Actual e inmutable tras configurar; cada trabajo fija versión. |
| Etapas, categorías e indicadores | Genares/Comisión Académica | Evaluación | Actual; etapa tiene ámbito explícito. |
| Asociación versión–carrera | Genares | Consulta de vigencia | Actual, FK/contexto fuerte en SQL. |
| Vigencia por carrera | Genares | Creación/habilitación de trabajo | Actual; intervalos versionados. |
| Trabajo de titulación | Sistema 1 como candidato a dueño de elegibilidad; Genares conserva su registro operativo | Sistemas 2–3, Genares | Integración no documentada; definir ID maestro y sincronización. |
| Integrantes del trabajo | Sistema 1 como candidato | Sistema 2, Genares | Actual copia local; no inventar estudiantes. |
| Tutor asignado | Genares hoy | Sistemas 1–3 | Actual local. |
| Asignación de tribunal | Sistema 3 según reparto institucional; Genares también tiene entidad local | Genares, agenda y evaluación | Posible duplicidad entre sistemas: definir fuente y sincronización. |
| Miembros/lectores | Sistema 3 como candidato; entidad local en Genares | Genares | Presidencia no es atributo actual; confirmar quién la define. |
| Estado de documentos/requisitos | Sistema 2 | Sistema 1, Sistema 3, Genares | Externo y no modelado; Genares necesitaría referencia/estado de habilitación. |
| Programación básica actual | Genares | Trabajo y evaluación oral | Actual, una fila por trabajo; insuficiente para agenda. |
| Cronograma y sus versiones | Genares, Comisión/Secretaría (propuesta) | Sistemas 1–3, tribunal y estudiantes | Futuro propuesto; aprobación externa capturada. |
| Carrera en cronograma | Genares, derivada de referencias institucionales | Agenda | Futuro propuesto; cardinalidad una o varias carreras por decidir. |
| Sala | Inventario institucional/administrativo aún por identificar; réplica Genares propuesta | Agenda | Futuro; catálogo local propuesto con identificador externo si existe. |
| Sesión/horario | Genares, Secretaría/Comisión | Sistemas 1–3, notificaciones | Futuro propuesto; FK a trabajo y tribunal confirmado. |
| Constancia de aprobación externa | Consejo de Facultad emite; Genares registra referencia | Comisión/Secretaría | Futuro propuesto; no cuenta del Consejo en Genares. |
| Eventos de cronograma | Genares | Auditoría/administración | Futuro propuesto, append-only. |
| Evaluación y puntajes | Genares/miembros del tribunal según etapa | Secretaría, consolidación | Actual; cerradas inmutables, traspaso compartido trazable. |
| Resultado académico oficial | Genares después de regla institucional y acta | Sistemas 1–3 | No existe entidad de resultado/acta; consolidación actual es calculada y no oficial. |
| Documento de acta | Sistema documental institucional (candidato Sistema 2) por confirmar | Genares/Sistemas 1–3 | No modelado en BD; no asumir almacenamiento ni firma. |
| Notificación | Genares | Personas usuarias | Actual como registro; canales reales por confirmar. |
| Auditorías de rúbrica/evaluación | Genares | Auditores autorizados | Actual, append-only en SQL. |

## Criterios para un futuro acuerdo

Cada dato compartido debe tener un único dueño, clave externa estable, evento o endpoint fuente, política de rectificación, alcance de datos personales, responsable de incidentes y estrategia de indisponibilidad/reintento. No copiar documentos sensibles cuando baste una referencia verificable.
