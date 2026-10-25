import {
  API_BASE_URL,
  FUENTE_RUBRICAS,
} from '../configuracion/rubricas';

export class ErrorApiDeshabilitada extends Error {
  constructor() {
    super('La consulta no está disponible en esta sesión.');
    this.name = 'ErrorApiDeshabilitada';
  }
}

export class ErrorEscrituraApiDeshabilitada extends Error {
  constructor() {
    super('En esta sesión solo está habilitada la consulta.');
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
      ? 'La sesión no tiene una identidad validada. Inicie sesión y vuelva a intentarlo.'
      : status === 403
        ? 'Su perfil no tiene permiso para realizar esta operación.'
        : status === 409
          ? 'Los datos cambiaron o entran en conflicto. Recargue antes de continuar.'
          : status >= 500
            ? `No se pudo completar la operación (código ${status}).`
            : status === 400 && details.length
              ? `No se pudo completar la solicitud: ${details.join(' ')}`
              : `No se pudo completar la solicitud (código ${status}).`;
    super(mensaje);
    this.name = 'ErrorApiHttp';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ErrorConexionApi extends Error {
  constructor() {
    super('No fue posible completar la consulta. Intente de nuevo; si el problema continúa, contacte con soporte.');
    this.name = 'ErrorConexionApi';
  }
}

export class ErrorRespuestaApi extends Error {
  constructor() {
    super('La información recibida no es válida. No se mostrarán datos incompletos.');
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
  habilitado: FUENTE_RUBRICAS === 'api',
  escriturasRubricasHabilitadas: true,
  escriturasModalidadesHabilitadas: true,
  escriturasCarrerasHabilitadas: true,
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
