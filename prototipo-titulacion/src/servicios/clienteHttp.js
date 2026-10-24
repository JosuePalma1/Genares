import {
  API_BASE_URL,
  ESCRITURA_MODALIDADES_API_HABILITADA,
  ESCRITURA_CARRERAS_API_HABILITADA,
  ESCRITURA_RUBRICAS_API_HABILITADA,
  FUENTE_RUBRICAS,
} from '../configuracion/rubricas';

export class ErrorApiDeshabilitada extends Error {
  constructor() {
    super('La lectura desde la API no está habilitada en este entorno.');
    this.name = 'ErrorApiDeshabilitada';
  }
}

export class ErrorEscrituraApiDeshabilitada extends Error {
  constructor() {
    super('El cliente de escritura API no está habilitado para este entorno de desarrollo.');
    this.name = 'ErrorEscrituraApiDeshabilitada';
  }
}

export class ErrorApiHttp extends Error {
  constructor(status, respuesta = null) {
    const code = typeof respuesta?.code === 'string' ? respuesta.code : null;
    const details = Array.isArray(respuesta?.details)
      ? respuesta.details.filter((detalle) => typeof detalle === 'string')
      : [];
    const mensaje = status === 401
      ? 'La API requiere una identidad validada.'
      : status === 403
        ? 'La API denegó esta operación.'
        : status === 409
          ? 'Los datos cambiaron o entran en conflicto. Recargue antes de continuar.'
          : status >= 500
            ? `NestJS respondió con un error HTTP ${status}. La operación solicitada no se completó.`
            : status === 400 && details.length
              ? `La API rechazó la solicitud: ${details.join(' ')}`
              : `La API respondió con estado HTTP ${status}.`;
    super(mensaje);
    this.name = 'ErrorApiHttp';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ErrorConexionApi extends Error {
  constructor() {
    super('No fue posible contactar con la API local. Confirme que NestJS esté activo y que el proxy de Vite apunte al puerto configurado; después, reintente.');
    this.name = 'ErrorConexionApi';
  }
}

export class ErrorRespuestaApi extends Error {
  constructor() {
    super('La API devolvió una respuesta inválida. No se mostrarán datos simulados como sustitución.');
    this.name = 'ErrorRespuestaApi';
  }
}

export function crearClienteHttp({
  baseUrl = API_BASE_URL,
  habilitado = false,
  escriturasHabilitadas = false,
  fetcher = (...argumentos) => globalThis.fetch(...argumentos),
} = {}) {
  async function solicitarJson(method, path, { signal, body } = {}) {
    if (!habilitado) throw new ErrorApiDeshabilitada();
    const esEscritura = !['GET', 'HEAD'].includes(method);
    if (esEscritura && !escriturasHabilitadas) throw new ErrorEscrituraApiDeshabilitada();

    const headers = { Accept: 'application/json' };
    if (esEscritura) {
      headers['Content-Type'] = 'application/json';
      // Indicio anti-CSRF, no autentica ni concede capacidades. El servidor valida
      // además el Origin y Fetch Metadata contra su allowlist local.
      headers['X-Genares-Write-Intent'] = 'local-development';
    }

    let response;
    try {
      response = await fetcher(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
        method,
        headers,
        credentials: 'omit',
        cache: 'no-store',
        signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new ErrorConexionApi();
    }

    let respuesta;
    let textoRespuesta = '';
    let copiaTexto = null;
    try {
      copiaTexto = response.clone?.() ?? null;
    } catch {
      copiaTexto = null;
    }
    try {
      respuesta = await response.json();
    } catch {
      respuesta = null;
      try {
        textoRespuesta = await (copiaTexto ?? response).text();
      } catch {
        textoRespuesta = '';
      }
    }
    if (!response.ok) {
      const contentType = response.headers?.get?.('content-type') ?? '';
      // Vite devuelve una página/texto de error cuando no consigue alcanzar NestJS.
      // Los errores JSON de NestJS conservan su status y no se confunden con una caída.
      const respuestaNoJson = respuesta === null && !contentType.includes('application/json');
      const errorProxyVite = /(?:http\s+)?proxy error|ECONNREFUSED|ECONNRESET/i.test(textoRespuesta);
      if (respuestaNoJson && ([502, 503, 504].includes(response.status) || (response.status >= 500 && errorProxyVite))) {
        throw new ErrorConexionApi();
      }
      throw new ErrorApiHttp(response.status, respuesta);
    }
    if (respuesta === null) throw new ErrorRespuestaApi();
    return respuesta;
  }

  return {
    getJson: (path, options) => solicitarJson('GET', path, options),
    postJson: (path, body, options) => solicitarJson('POST', path, { ...options, body }),
    putJson: (path, body, options) => solicitarJson('PUT', path, { ...options, body }),
    patchJson: (path, body, options) => solicitarJson('PATCH', path, { ...options, body }),
  };
}

export function crearClientesHttpPorModulo({
  baseUrl = API_BASE_URL,
  habilitado = false,
  escriturasRubricasHabilitadas = false,
  escriturasModalidadesHabilitadas = false,
  escriturasCarrerasHabilitadas = false,
  fetcher,
} = {}) {
  const comun = { baseUrl, habilitado, fetcher };
  return {
    rubricas: crearClienteHttp({ ...comun, escriturasHabilitadas: escriturasRubricasHabilitadas }),
    modalidades: crearClienteHttp({ ...comun, escriturasHabilitadas: escriturasModalidadesHabilitadas }),
    carreras: crearClienteHttp({ ...comun, escriturasHabilitadas: escriturasCarrerasHabilitadas }),
  };
}

const clientesApi = crearClientesHttpPorModulo({
  habilitado: import.meta.env.DEV === true && FUENTE_RUBRICAS === 'api',
  escriturasRubricasHabilitadas: import.meta.env.DEV === true && ESCRITURA_RUBRICAS_API_HABILITADA,
  escriturasModalidadesHabilitadas: import.meta.env.DEV === true && ESCRITURA_MODALIDADES_API_HABILITADA,
  escriturasCarrerasHabilitadas: import.meta.env.DEV === true && ESCRITURA_CARRERAS_API_HABILITADA,
});

export const getJsonApi = (...argumentos) => clientesApi.rubricas.getJson(...argumentos);
export const postJsonApi = (...argumentos) => clientesApi.rubricas.postJson(...argumentos);
export const putJsonApi = (...argumentos) => clientesApi.rubricas.putJson(...argumentos);
export const patchJsonApi = (...argumentos) => clientesApi.rubricas.patchJson(...argumentos);
export const postJsonModalidadesApi = (...argumentos) => clientesApi.modalidades.postJson(...argumentos);
export const putJsonModalidadesApi = (...argumentos) => clientesApi.modalidades.putJson(...argumentos);
export const patchJsonModalidadesApi = (...argumentos) => clientesApi.modalidades.patchJson(...argumentos);
export const postJsonCarrerasApi = (...argumentos) => clientesApi.carreras.postJson(...argumentos);
export const putJsonCarrerasApi = (...argumentos) => clientesApi.carreras.putJson(...argumentos);
export const patchJsonCarrerasApi = (...argumentos) => clientesApi.carreras.patchJson(...argumentos);
