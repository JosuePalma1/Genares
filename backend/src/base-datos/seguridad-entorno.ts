export interface EntornoBaseDesarrollo {
  NODE_ENV?: string;
  DB_HOST?: string;
  DB_PORT?: string | number;
  DB_NAME?: string;
}

export function validarDestinoBaseDesarrollo(entorno: EntornoBaseDesarrollo): void {
  const puerto = Number(entorno.DB_PORT);
  if (entorno.NODE_ENV === 'test') return;

  if ([5432, 55440, 55441].includes(puerto)) {
    throw new Error(
      'Este proceso no puede conectarse por los puertos 5432, 55440 (8E) ni 55441 (9D). Use 9D únicamente mediante la suite de integración protegida.',
    );
  }

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
