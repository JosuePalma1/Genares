# 07 — Integración externa

## Estado de conocimiento

La auditoría 10.6A/B y esta revisión estática permiten identificar referencias internas, pero no establecen contratos con los otros sistemas universitarios. No se consultaron endpoints, bases externas ni credenciales. Las fuentes y equipos responsables deben confirmarse antes de diseñar sincronización.

## Dependencias

| Dato | Disponibilidad observada en el modelo local | Integración pendiente |
|---|---|---|
| Trabajo y carrera | `trabajos_titulacion` referencia carrera; programación referencia trabajo | Confirmar dueño académico, ID estable externo y significado de estados. |
| Periodo académico | Catálogo `periodos_academicos` | Acordar fuente autorizada, calendario y cambios de periodo. |
| Estudiantes e integrantes | Persona/perfil y relación `estudiantes_trabajo` | Clave estable externa, cambios de integrantes, privacidad y momento de congelar la lista. |
| Tribunal y lectores | Asignaciones/miembros locales; el modelo histórico exige dos evaluadores | Confirmar fuente, composición vigente, suplencias, presidencia y notificación. Mantener requisito de dos lectores mientras no exista decisión formal. |
| Docentes y cuentas | Hay personas, perfiles y cuentas locales | Resolver identidad canónica, cuentas deshabilitadas y roles; no usar rol de cuenta como participación en una sesión. |
| Requisitos de titulación/elegibilidad | No se identificó un contrato integrado suficiente en el servicio de programación, que no existe | Identificar sistema dueño, estados, vigencia y regla para cambios entre propuesta y publicación. |
| Documentos/acta y aprobación del Consejo | No hay agenda versionada ni evidencia de aprobación en la tabla actual | Definir repositorio/documento, referencia verificable, actor que registra y retención. No crear cuenta institucional del Consejo. |
| Salas e inventario | Solo `sala` textual en la programación actual | Identificar dueño del inventario, código, capacidad, accesibilidad, bloqueos y disponibilidad. |
| Notificaciones | Trigger local crea notificaciones al cambiar fecha/hora/sala | Acordar canales, destinatarios, confirmaciones, reintentos e idempotencia; evitar doble emisión en el corte. |

## Fuente única y datos externos

Cada atributo debe tener un dueño explícito. Genares puede conservar una referencia y una instantánea aprobada para reconstruir la versión publicada, pero no declarar que es el maestro de datos de estudiantes, docentes, salas o actas si otro sistema los gobierna.

Contrato mínimo futuro, según cada sistema:

- nombre de sistema y entidad fuente;
- identificador externo estable, más UUID local si existe;
- estado y semántica de vigencia;
- número de versión o `updated_at` para detectar cambios;
- fecha de consulta y política de expiración;
- mecanismo autorizado (API/evento/lote), permisos y datos mínimos;
- idempotencia, reintento, correlación y manejo de indisponibilidad;
- reglas de conflicto cuando la fuente cambia después de proponer o aprobar;
- retención, privacidad y responsable operativo.

No exigir que los sistemas externos adopten UUIDs internos de Genares. No configurar endpoints, claves, colas ni replicación durante 10.7A.

## Revalidación de datos

Como propuesta, validar al crear/proponer y volver a validar en la publicación transaccional que los datos que condicionan la agenda siguen vigentes. Si el tribunal, el trabajo o su elegibilidad cambia y la aprobación ya no corresponde, bloquear publicación y crear una revisión explícita. La lista de cambios que invalidan aprobación debe acordarse con la Universidad y con los equipos propietarios.

Después de publicar, una modificación de origen no debe reescribir la sesión histórica: se presenta al actor autorizado y se resuelve mediante nueva versión o cancelación auditada. No implementar sincronización ni inventar una política de reconciliación.
