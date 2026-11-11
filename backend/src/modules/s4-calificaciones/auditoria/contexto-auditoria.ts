import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';

export const ACTOR_TECNICO_LOCAL = 'GENARES:LOCAL_DEVELOPMENT';

/** Establece el contexto solo en la conexión/transacción que va a escribir. */
export async function establecerActorAuditoria(
  manager: Pick<EntityManager, 'query'>,
  actorDominio?: string | null,
  correlationId?: string | null,
): Promise<string> {
  const correlacion = correlationId?.trim() || randomUUID();
  await manager.query(
    `SELECT set_config('s4.actor_id', $1, true),
            set_config('s4.correlation_id', $2, true),
            set_config('application_name', $3, true),
            set_config('genares.actor_id', $4, true)`,
    [ACTOR_TECNICO_LOCAL, correlacion, 'Genares S4', actorDominio?.trim() || ACTOR_TECNICO_LOCAL],
  );
  return correlacion;
}
