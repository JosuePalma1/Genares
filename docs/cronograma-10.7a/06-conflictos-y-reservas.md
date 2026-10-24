# 06 — Conflictos y reservas

## Datos mínimos necesarios

Hoy la programación tiene fecha, hora sin zona, sala en texto y estado; no almacena fin/duración ni una identidad estable de sala. No se puede decidir solapamiento con precisión a partir de esos campos. Para una reserva futura se necesita, como mínimo, recurso estable, instante de inicio y fin, zona IANA para interpretar horario local, y estado de reserva.

No se fija una duración en esta etapa. La Universidad debe confirmar duración, pausas, montaje/desmontaje, tolerancias y zona horaria. `America/Guayaquil` puede evaluarse por ubicación institucional, pero no se adopta sin confirmación.

## Clasificación propuesta

| Regla | Tratamiento inicial | Fundamento / decisión pendiente |
|---|---|---|
| Misma sala y rangos que se solapan | Bloqueo duro | Requiere sala con ID estable y política que confirme que una sala no puede hospedar dos sustentaciones simultáneas. |
| Mismo trabajo con dos sesiones simultáneas | Bloqueo duro | No puede defenderse simultáneamente el mismo trabajo; confirmar si se permiten sesiones distintas por estudiante y en qué condiciones. |
| Mismo miembro del tribunal asignado a dos sesiones simultáneas | Pendiente de política; candidato a bloqueo duro | La asignación está en el modelo actual, pero suplencias, disponibilidad y excepciones no están especificadas. |
| Misma persona que preside o cumple secretaría | Aviso hasta confirmar | Esos roles y su alcance por sesión/bloque no están definidos actualmente. |
| Integrante de trabajo en dos sesiones simultáneas | Aviso hasta confirmar | Debe definirse el vínculo a estudiantes y si se permiten defensas en paralelo dentro del mismo trabajo. |
| Persona externa o invitada | Sin regla hasta definir identidad | No asumir un director como participante ni como recurso bloqueante. |
| Datos fuente cambiaron después de aprobación | Detener publicación/reprogramación y pedir nueva validación | Mantener historia; definir qué cambios invalidan aprobación y quién puede reabrir. |

Los avisos no se convierten en bloqueos sin aprobación institucional. Un sistema puede informar una coincidencia sin impedir la publicación, si la política así lo determina.

## Modelo de reserva

`reservas_recurso_sesion` representa las ocupaciones que efectivamente bloquean disponibilidad. Como propuesta, debe identificar exactamente un recurso de tipo conocido (sala, persona, miembro/asignación o trabajo). Son preferibles columnas FK específicas por tipo o una tabla de recursos tipados; un `resource_id` polimórfico sin FK no garantiza que exista el recurso.

Campos candidatos: sesión/version, recurso, `inicio_en timestamptz`, `fin_en timestamptz`, estado, creada/liberada en, actor y referencia de liberación. Rango semiabierto `[inicio, fin)` permite que una sesión termine a la misma hora en que inicia la siguiente, si la Universidad confirma esa regla.

## Integridad ante concurrencia

Una consulta `SELECT` previa no basta: dos transacciones concurrentes podrían observar el recurso libre y reservarlo simultáneamente. La restricción final debe residir en PostgreSQL.

- Evaluar `EXCLUDE USING gist` sobre identificador de recurso y `tstzrange(inicio_en, fin_en, '[)')`, aplicado solo a reservas bloqueantes activas.
- Evaluar extensión `btree_gist` para comparar igualdad de claves junto al rango; confirmar disponibilidad y privilegios del entorno de despliegue antes de especificarla como requisito.
- Publicar/cancelar con transacción y bloqueo de cronograma/recurso para serializar la sustitución de reservas. La exclusión es la última defensa frente a carreras.
- Mantener orden determinista de locks cuando se reservan varias salas/personas para reducir interbloqueos; reintentar únicamente fallas transitorias identificadas.
- La reserva nueva y la liberación de la anterior forman una sola unidad atómica; conservar evento de liberación.
- Los borradores y propuestas no reservan en el modelo inicial. Confirmar si la Universidad requiere retención temporal antes de publicación.

## Recursos según rol

1. Sala: candidata clara a reserva dura una vez normalizado el catálogo.
2. Tribunal: usar `asignacion_tribunal` o sus miembros como recurso según la política. Si se reserva el panel completo, validar la composición del tribunal confirmado en la misma transacción.
3. Persona: solo para participantes que la Universidad declare incompatibles en simultáneo.
4. Trabajo: bloquear coincidencia horaria del mismo trabajo; la regla sobre más de una sesión por grupo requiere decisión.
5. Estudiante: no duplicar membresía en una tabla de participantes; derivar desde el trabajo. Añadir reserva individual solo si puede haber sesiones independientes por estudiante.

## Cambios de reserva y auditoría

La tabla de reservas conserva estado operativo, no reemplaza la versión del cronograma ni los eventos. Al publicar sucesora, las reservas antiguas se liberan y las nuevas se crean dentro de la misma transacción. Eventos registran motivo, recurso, intervalo, actor y versión de origen/destino. No se borra ni se reutiliza una fila histórica para una reserva diferente.
