import {
  CAPACIDADES_DESARROLLO_LOCAL,
  crearMiddlewareAccesoDesarrolloLocal,
  crearMiddlewareProteccionEscrituraLocal,
  direccionEsLoopback,
  IDENTIDAD_TECNICA_DESARROLLO,
  resolverOrigenesEscrituraLocal,
  SolicitudLocalApi,
  validarBaseDesarrolloActiva,
  validarConfiguracionAccesoDesarrollo,
} from './identidad-desarrollo-local';

const entorno = {
  NODE_ENV: 'development',
  LOCAL_DEV_OPEN_ACCESS: 'true',
  LOCAL_DEV_WRITE_ORIGINS: 'http://127.0.0.1:5173',
  DB_HOST: '127.0.0.1',
  DB_PORT: '5432',
  DB_NAME: 'genares',
};
const base = {
  nombre: 'genares',
  direccion: '127.0.0.1',
  puerto: 5432,
  marca: 'GENARES:10.9B:DEVELOPMENT',
};

describe('acceso local abierto sin cuentas', () => {
  it('solo acepta opt-in de desarrollo con la configuración de backend/.env', () => {
    expect(() => validarConfiguracionAccesoDesarrollo(entorno)).not.toThrow();
    expect(() => validarConfiguracionAccesoDesarrollo({ ...entorno, NODE_ENV: 'production' })).toThrow();
    expect(() => validarConfiguracionAccesoDesarrollo({ ...entorno, LOCAL_DEV_OPEN_ACCESS: 'false' })).toThrow();
    expect(() => validarConfiguracionAccesoDesarrollo({ ...entorno, DB_PORT: 'no-es-numero' })).toThrow();
  });

  it('verifica también la identidad de la conexión PostgreSQL ya establecida', () => {
    expect(() => validarBaseDesarrolloActiva(entorno, base)).not.toThrow();
    expect(() => validarBaseDesarrolloActiva(entorno, { ...base, direccion: '10.0.0.4' })).toThrow();
    expect(() => validarBaseDesarrolloActiva(entorno, { ...base, puerto: 55442 })).toThrow();
  });

  it('crea solo un actor técnico en conexiones loopback y rechaza el encabezado de suplantación', () => {
    const middleware = crearMiddlewareAccesoDesarrolloLocal();
    const continuar = jest.fn();
    const solicitud: SolicitudLocalApi = { socket: { remoteAddress: '::ffff:127.0.0.1' }, headers: {} };
    const respuesta = { setHeader: jest.fn() };
    middleware(solicitud, respuesta, continuar);
    expect(continuar).toHaveBeenCalledTimes(1);
    expect(solicitud.identidadApi).toEqual({
      sujeto: IDENTIDAD_TECNICA_DESARROLLO,
      tipo: 'DESARROLLO_LOCAL',
      capacidades: CAPACIDADES_DESARROLLO_LOCAL,
    });
    expect(respuesta.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');

    const rechazado = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
    const continuarRechazado = jest.fn();
    middleware({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-genares-dev-identity': 'administracion' } }, rechazado, continuarRechazado);
    expect(rechazado.statusCode).toBe(400);
    expect(continuarRechazado).not.toHaveBeenCalled();
  });

  it('rechaza conexiones no locales y reconoce únicamente loopback', () => {
    expect(direccionEsLoopback('127.0.0.1')).toBe(true);
    expect(direccionEsLoopback('::1')).toBe(true);
    expect(direccionEsLoopback('192.168.1.10')).toBe(false);
    const respuesta = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
    const continuar = jest.fn();
    crearMiddlewareAccesoDesarrolloLocal()({ socket: { remoteAddress: '192.168.1.10' }, headers: {} }, respuesta, continuar);
    expect(respuesta.statusCode).toBe(403);
    expect(continuar).not.toHaveBeenCalled();
  });

  it('protege las escrituras con Origin, Fetch Metadata y el encabezado anti-CSRF local', () => {
    const middleware = crearMiddlewareProteccionEscrituraLocal(resolverOrigenesEscrituraLocal(entorno));
    const continuar = jest.fn();
    middleware({ method: 'GET', headers: {} }, {}, continuar);
    expect(continuar).toHaveBeenCalledTimes(1);

    const respuesta = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
    const continuarRechazado = jest.fn();
    middleware({ method: 'POST', headers: { origin: 'http://evil.example', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'x-genares-write-intent': 'local-development' } }, respuesta, continuarRechazado);
    expect(respuesta.statusCode).toBe(403);
    expect(continuarRechazado).not.toHaveBeenCalled();

    const respuestaValida = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
    const continuarValido = jest.fn();
    middleware({ method: 'POST', headers: { origin: 'http://127.0.0.1:5173', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json; charset=utf-8', 'x-genares-write-intent': 'local-development' } }, respuestaValida, continuarValido);
    expect(continuarValido).toHaveBeenCalledTimes(1);
  });

});
