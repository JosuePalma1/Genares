const UUID_POSTGRES = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuidPostgres(valor) {
  return typeof valor === 'string' && UUID_POSTGRES.test(valor);
}
