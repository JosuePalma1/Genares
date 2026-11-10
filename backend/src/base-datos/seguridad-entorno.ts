export interface EntornoBaseDesarrollo {
  DB_HOST?: string;
  DB_PORT?: string | number;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
}

export function validarDestinoBaseDesarrollo(entorno: EntornoBaseDesarrollo): void {
  const puerto = Number(entorno.DB_PORT);
  if (!entorno.DB_HOST || !Number.isInteger(puerto) || puerto < 1 || puerto > 65535
    || !entorno.DB_USERNAME || !entorno.DB_PASSWORD || !entorno.DB_NAME) {
    throw new Error(
      'La configuración PostgreSQL de backend/.env debe definir host, puerto, usuario, contraseña y base.',
    );
  }
}
