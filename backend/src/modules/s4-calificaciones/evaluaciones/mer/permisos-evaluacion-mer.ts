import { hayRestriccionDeAlcance, identidadActual } from '../../../../common/api/contexto-alcance';

export function puedeGuardarBorradoresMer(): boolean {
  return process.env.NODE_ENV === 'development'
    && process.env.LOCAL_DEV_OPEN_ACCESS === 'true'
    && process.env.DB_NAME === 'genares_integrado_dev'
    && (!hayRestriccionDeAlcance() || Boolean(identidadActual()?.capacidades.includes('integracion:guardar-borrador')));
}
