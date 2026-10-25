import {
  CAPACIDADES_DESARROLLO_LOCAL,
  crearMiddlewareAccesoDesarrolloLocal,
  crearMiddlewareProteccionEscrituraLocal,
  crearMiddlewareSoloLecturaDesarrolloLocal,
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
  DB_PORT: '55442',
  DB_NAME: 'genares_dev_10_9',
};
const base = {
  nombre: 'genares_dev_10_9',
  direccion: '127.0.0.1',
  puerto: 55442,
  marca: 'GENARES:10.9B:DEVELOPMENT',
};
const entornoIntegrado9D = {
  NODE_ENV: 'development',
  LOCAL_DEV_IDENTITY_ENABLED: 'true',
  LOCAL_DEV_IDENTITY_PROFILE: 'consulta-integrada',
  LOCAL_DEV_9D_TEMPORAL: 'true',
  LOCAL_DEV_WRITE_ENABLED: 'false',
  LOCAL_DEV_WRITE_ORIGINS: 'http://127.0.0.1:5180',
  DB_DISPOSABLE: 'true',
  DB_HOST: '127.0.0.1',
  DB_PORT: '55441',
  DB_NAME: 'genares_9d_test_a1b2c3d4',
};

describe('acceso local abierto sin cuentas', () => {
  it('solo acepta opt-in de desarrollo con la configuración exacta de PostgreSQL 10.9B', () => {
    expect(() => validarConfiguracionAccesoDesarrollo(entorno)).not.toThrow();
    expect(() => validarConfiguracionAccesoDesarrollo({ ...entorno, NODE_ENV: 'production' })).toThrow();
    expect(() => validarConfiguracionAccesoDesarrollo({ ...entorno, LOCAL_DEV_OPEN_ACCESS: 'false' })).toThrow();
    for (const puerto of ['5432', '55440', '55441', '9999']) {
      expect(() => validarConfiguracionAccesoDesarrollo({ ...entorno, DB_PORT: puerto })).toThrow();
    }
    expect(() => validarConfiguracionAccesoDesarrollo({ ...entorno, DB_NAME: 'otra_base' })).toThrow();
  });

  it('verifica también la identidad de la conexión PostgreSQL ya establecida', () => {
    expect(() => validarBaseDesarrolloActiva(entorno, base)).not.toThrow();
    expect(() => validarBaseDesarrolloActiva(entorno, { ...base, marca: 'GENARES:9D:DISPOSABLE' })).toThrow();
    expect(() => validarBaseDesarrolloActiva(entorno, { ...base, direccion: '10.0.0.4' })).toThrow();
    expect(() => validarBaseDesarrolloActiva(entorno, { ...base, puerto: 5432 })).toThrow();
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

  it('acepta solo el perfil fijo de consulta en la base UUID temporal 9D', () => {
    expect(() => validarConfiguracionAccesoDesarrollo(entornoIntegrado9D)).not.toThrow();
    expect(() => validarConfiguracionAccesoDesarrollo({ ...entornoIntegrado9D, LOCAL_DEV_IDENTITY_PROFILE: 'administrador' })).toThrow();
    expect(() => validarConfiguracionAccesoDesarrollo({ ...entornoIntegrado9D, LOCAL_DEV_WRITE_ENABLED: 'true' })).toThrow();
    expect(() => validarConfiguracionAccesoDesarrollo({ ...entornoIntegrado9D, DB_NAME: 'genares_9d_disposable' })).toThrow();

    const baseTemporal = {
      nombre: entornoIntegrado9D.DB_NAME,
      direccion: '127.0.0.1',
      puerto: 55441,
      marca: 'GENARES:9D:DISPOSABLE',
    };
    expect(() => validarBaseDesarrolloActiva(entornoIntegrado9D, baseTemporal)).not.toThrow();
    expect(() => validarBaseDesarrolloActiva(entornoIntegrado9D, { ...baseTemporal, marca: 'otra' })).toThrow();
    expect(() => validarBaseDesarrolloActiva(entornoIntegrado9D, { ...baseTemporal, puerto: 55442 })).toThrow();
  });

  it('limita el perfil 9D a lecturas API y rechaza suplantación y escrituras', () => {
    const middleware = crearMiddlewareAccesoDesarrolloLocal(['rubricas:leer', 'evaluaciones:leer']);
    const continuar = jest.fn();
    const solicitud: SolicitudLocalApi = { socket: { remoteAddress: '127.0.0.1' }, headers: {} };
    middleware(solicitud, { setHeader: jest.fn() }, continuar);
    expect(solicitud.identidadApi?.capacidades).toEqual(['rubricas:leer', 'evaluaciones:leer']);
    expect(continuar).toHaveBeenCalledTimes(1);

    const soloLectura = crearMiddlewareSoloLecturaDesarrolloLocal();
    const rechazada = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
    const continuarEscritura = jest.fn();
    soloLectura({ method: 'POST', headers: {} }, rechazada, continuarEscritura);
    expect(rechazada.statusCode).toBe(403);
    expect(continuarEscritura).not.toHaveBeenCalled();

    const lectura = jest.fn();
    soloLectura({ method: 'GET', headers: {} }, {}, lectura);
    expect(lectura).toHaveBeenCalledTimes(1);
  });
});
