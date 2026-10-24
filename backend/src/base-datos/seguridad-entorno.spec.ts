import { validarDestinoBaseDesarrollo } from './seguridad-entorno';

describe('seguridad del destino PostgreSQL de desarrollo', () => {
  const entorno = {
    NODE_ENV: 'development',
    DB_HOST: '127.0.0.1',
    DB_PORT: '55442',
    DB_NAME: 'genares_dev_10_9',
  };

  it('permite solo la base local de desarrollo 10.9', () => {
    expect(() => validarDestinoBaseDesarrollo(entorno)).not.toThrow();
  });

  it.each([
    ['puerto 5432', { ...entorno, DB_PORT: '5432' }],
    ['puerto 8E', { ...entorno, DB_PORT: '55440' }],
    ['puerto 9D', { ...entorno, DB_PORT: '55441' }],
    ['otro host', { ...entorno, DB_HOST: 'localhost' }],
    ['otra base', { ...entorno, DB_NAME: 'genares' }],
  ])('rechaza %s antes de abrir una conexión', (_caso, destino) => {
    expect(() => validarDestinoBaseDesarrollo(destino)).toThrow();
  });

  it('permite test y producción con destino remoto, y sigue bloqueando puertos locales protegidos', () => {
    expect(() => validarDestinoBaseDesarrollo({ ...entorno, NODE_ENV: 'test' })).not.toThrow();
    expect(() => validarDestinoBaseDesarrollo({ ...entorno, NODE_ENV: 'production' })).not.toThrow();
    expect(() => validarDestinoBaseDesarrollo({ ...entorno, NODE_ENV: 'production', DB_PORT: '5432' })).toThrow(/no puede conectarse/);
    expect(() => validarDestinoBaseDesarrollo({ ...entorno, NODE_ENV: undefined, DB_PORT: '5432' })).toThrow(/no puede conectarse/);
  });
});
