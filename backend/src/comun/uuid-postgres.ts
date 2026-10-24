/** PostgreSQL accepts the canonical UUID shape without constraining RFC version or variant bits. */
export const UUID_POSTGRES_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuidPostgres(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID_POSTGRES_PATTERN.test(valor);
}
