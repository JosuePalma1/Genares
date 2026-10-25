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

  it('permite 9D solo con opt-in y una base temporal UUID marcada por el launcher', () => {
    expect(() => validarDestinoBaseDesarrollo({
      NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '55441',
      DB_NAME: 'genares_9d_test_a1b2c3d4', DB_DISPOSABLE: 'true', LOCAL_DEV_9D_TEMPORAL: 'true',
    })).not.toThrow();
    for (const cambios of [
      { NODE_ENV: 'production' },
      { DB_DISPOSABLE: 'false' },
      { LOCAL_DEV_9D_TEMPORAL: 'false' },
      { DB_NAME: 'genares_9d_disposable' },
      { DB_HOST: 'localhost' },
    ]) {
      expect(() => validarDestinoBaseDesarrollo({
        NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '55441',
        DB_NAME: 'genares_9d_test_a1b2c3d4', DB_DISPOSABLE: 'true', LOCAL_DEV_9D_TEMPORAL: 'true',
        ...cambios,
      })).toThrow();
    }
  });

  it.each(['test', 'development', 'production', undefined])('bloquea 5432 y 8E también con NODE_ENV=%s', (NODE_ENV) => {
    for (const DB_PORT of ['5432', '55440']) {
      expect(() => validarDestinoBaseDesarrollo({
        NODE_ENV, DB_HOST: '127.0.0.1', DB_PORT, DB_NAME: 'genares_9d_test_a1b2c3d4',
        DB_DISPOSABLE: 'true', LOCAL_DEV_9D_TEMPORAL: 'true',
      })).toThrow();
    }
  });
});
