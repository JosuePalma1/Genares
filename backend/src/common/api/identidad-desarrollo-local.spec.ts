import {
  CAPACIDADES_DESARROLLO_LOCAL,
  crearMiddlewareAccesoDesarrolloLocal,
  crearMiddlewareProteccionEscrituraLocal,
  opcionesCorsDesarrolloLocal,
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

  it('acepta same-site solo desde un origen permitido (APK de desarrollo) y sigue rechazando cross-site', () => {
    const middleware = crearMiddlewareProteccionEscrituraLocal(['http://127.0.0.1:5173', 'http://localhost']);
    const probar = (origin: string, fetchSite: string | undefined) => {
      const respuesta = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
      const continuar = jest.fn();
      middleware({ method: 'POST', headers: { origin, 'sec-fetch-site': fetchSite, 'content-type': 'application/json', 'x-genares-write-intent': 'local-development' } }, respuesta, continuar);
      return continuar.mock.calls.length === 1 ? 'aceptada' : respuesta.statusCode;
    };
    expect(probar('http://localhost', 'same-site')).toBe('aceptada');
    expect(probar('http://localhost', 'cross-site')).toBe(403);
    expect(probar('http://localhost', undefined)).toBe(403);
    expect(probar('http://localhost:8100', 'same-site')).toBe(403);
  });

  it('CORS de desarrollo solo responde a los orígenes exactos configurados', () => {
    const opciones = opcionesCorsDesarrolloLocal(['http://localhost']);
    const decide = (origen: string | undefined) => {
      let resultado: boolean | undefined;
      opciones.origin(origen, (_error, permitir) => { resultado = permitir; });
      return resultado;
    };
    expect(decide('http://localhost')).toBe(true);
    expect(decide('http://localhost:8100')).toBe(false);
    expect(decide('https://evil.example')).toBe(false);
    expect(decide(undefined)).toBe(false);
    expect(opciones.credentials).toBe(false);
  });

  it('acepta formularios con archivo solo en la solicitud de corrección (RF-36), con las mismas garantías', () => {
    const middleware = crearMiddlewareProteccionEscrituraLocal(resolverOrigenesEscrituraLocal(entorno));
    const cabeceras = { origin: 'http://127.0.0.1:5173', 'sec-fetch-site': 'same-origin',
      'content-type': 'multipart/form-data; boundary=x', 'x-genares-write-intent': 'local-development' };
    const probar = (solicitud: Record<string, unknown>) => {
      const respuesta = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
      const continuar = jest.fn();
      middleware({ method: 'POST', ...solicitud } as never, respuesta, continuar);
      return continuar.mock.calls.length === 1 ? 'aceptada' : respuesta.statusCode;
    };
    expect(probar({ originalUrl: '/api/v1/correcciones-evaluacion', headers: cabeceras })).toBe('aceptada');
    expect(probar({ url: '/api/v1/correcciones-evaluacion?x=1', headers: cabeceras })).toBe('aceptada');
    // Otras rutas siguen exigiendo JSON.
    expect(probar({ originalUrl: '/api/v1/finalizacion-trabajos/abc', headers: cabeceras })).toBe(403);
    expect(probar({ originalUrl: '/api/v1/correcciones-evaluacion/abc/aprobacion', headers: cabeceras })).toBe(403);
    // La ruta permitida no relaja origen, Fetch Metadata ni la cabecera de intención.
    expect(probar({ originalUrl: '/api/v1/correcciones-evaluacion', headers: { ...cabeceras, origin: 'http://evil.example' } })).toBe(403);
    expect(probar({ originalUrl: '/api/v1/correcciones-evaluacion', headers: { ...cabeceras, 'sec-fetch-site': 'cross-site' } })).toBe(403);
    expect(probar({ originalUrl: '/api/v1/correcciones-evaluacion', headers: { ...cabeceras, 'x-genares-write-intent': undefined } })).toBe(403);
    expect(probar({ method: 'PUT', originalUrl: '/api/v1/correcciones-evaluacion', headers: cabeceras })).toBe(403);
  });

});
