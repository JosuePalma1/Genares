export interface EntornoBaseDesarrollo {
  NODE_ENV?: string;
  DB_HOST?: string;
  DB_PORT?: string | number;
  DB_NAME?: string;
  DB_DISPOSABLE?: string;
  LOCAL_DEV_9D_TEMPORAL?: string;
}

export function validarDestinoBaseDesarrollo(entorno: EntornoBaseDesarrollo): void {
  const puerto = Number(entorno.DB_PORT);

  if ([5432, 55440].includes(puerto)) {
    throw new Error(
      'Este proceso no puede conectarse por los puertos 5432 ni 55440 (8E).',
    );
  }

  if (puerto === 55441) {
    const baseTemporalAutorizada = entorno.NODE_ENV === 'development'
      && entorno.LOCAL_DEV_9D_TEMPORAL === 'true'
      && entorno.DB_DISPOSABLE === 'true'
      && entorno.DB_HOST === '127.0.0.1'
      && /^genares_9d_test_[a-f0-9]{8}$/.test(entorno.DB_NAME ?? '');
    if (!baseTemporalAutorizada) {
      throw new Error(
        'PostgreSQL 9D solo se permite en desarrollo con opt-in y una base temporal UUID marcada como desechable.',
      );
    }
    return;
  }

  if (entorno.NODE_ENV === 'test') return;

  if (entorno.NODE_ENV === 'production') return;

  if (
    entorno.DB_HOST !== '127.0.0.1'
    || puerto !== 55442
    || entorno.DB_NAME !== 'genares_dev_10_9'
  ) {
    throw new Error(
      'NestJS en desarrollo solo puede conectarse a la base local exclusiva 10.9 (127.0.0.1:55442/genares_dev_10_9). PostgreSQL 9D es para pruebas de integración; no se permiten 8E ni el puerto 5432.',
    );
  }
}
