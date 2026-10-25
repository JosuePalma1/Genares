import { validarDestinoBaseDesarrollo } from './seguridad-entorno';

describe('seguridad del destino PostgreSQL de desarrollo', () => {
  const entorno = {
    DB_HOST: '127.0.0.1',
    DB_PORT: '5432',
    DB_USERNAME: 'genares',
    DB_PASSWORD: 'local',
    DB_NAME: 'genares',
  };

  it('permite la configuración explícita de backend/.env', () => {
    expect(() => validarDestinoBaseDesarrollo(entorno)).not.toThrow();
  });

  it.each([
    ['host ausente', { ...entorno, DB_HOST: undefined }],
    ['puerto inválido', { ...entorno, DB_PORT: 'no-es-numero' }],
    ['usuario ausente', { ...entorno, DB_USERNAME: undefined }],
    ['contraseña ausente', { ...entorno, DB_PASSWORD: undefined }],
    ['base ausente', { ...entorno, DB_NAME: undefined }],
  ])('rechaza %s antes de abrir una conexión', (_caso, destino) => {
    expect(() => validarDestinoBaseDesarrollo(destino)).toThrow();
  });
});
