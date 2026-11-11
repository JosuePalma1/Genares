import { INestApplication } from '@nestjs/common';
import { IdentidadApi, SolicitudConIdentidad } from './identidad-api';

export interface EntornoAccesoDesarrollo {
  NODE_ENV?: string;
  LOCAL_DEV_OPEN_ACCESS?: string;
  ENABLE_INTEGRACION_DEV?: string;
  LOCAL_DEV_WRITE_ORIGINS?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
}

export interface SolicitudLocalApi extends SolicitudConIdentidad {
  socket?: { remoteAddress?: string };
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Únicas escrituras locales que aceptan un formulario con archivo: la solicitud de
 * corrección extraordinaria con su PDF justificativo (RF-36). El resto exige JSON.
 */
export const RUTAS_ESCRITURA_MULTIPART_LOCAL = Object.freeze(['/api/v1/correcciones-evaluacion']);

function aceptaContenido(solicitud: SolicitudLocalApi, contenido: string | undefined): boolean {
  if (contenido === 'application/json') return true;
  if (contenido !== 'multipart/form-data' || (solicitud.method ?? '').toUpperCase() !== 'POST') return false;
  const ruta = (solicitud.originalUrl ?? solicitud.url ?? '').split('?')[0].replace(/\/+$/, '');
  return RUTAS_ESCRITURA_MULTIPART_LOCAL.includes(ruta);
}

interface RespuestaLocalApi {
  statusCode?: number;
  setHeader?: (nombre: string, valor: string) => void;
  end?: (mensaje?: string) => void;
}

export interface VerificacionBaseDesarrollo {
  nombre: string;
  direccion: string | null;
  puerto: number;
  marca: string | null;
}

export const IDENTIDAD_TECNICA_DESARROLLO = 'GENARES:LOCAL_DEVELOPMENT';
export const CAPACIDADES_DESARROLLO_LOCAL = Object.freeze([
  'rubricas:leer', 'rubricas:administrar',
  'modalidades:leer', 'modalidades:administrar',
  'carreras:leer', 'carreras:administrar',
  'programaciones:leer', 'programaciones:administrar',
  'evaluaciones:leer', 'evaluaciones:calificar', 'evaluaciones:leer-demostracion',
  'configuracion-academica:administrar', 'documentos:emitir',
]);

export function direccionEsLoopback(direccion?: string): boolean {
  if (!direccion) return false;
  const normalizada = direccion.toLowerCase().replace(/^::ffff:/, '');
  return normalizada === '127.0.0.1' || normalizada === '::1';
}

export function validarConfiguracionAccesoDesarrollo(entorno: EntornoAccesoDesarrollo): void {
  if (entorno.NODE_ENV !== 'development') {
    throw new Error('La identidad de desarrollo solo puede habilitarse con NODE_ENV=development.');
  }

  if (entorno.LOCAL_DEV_OPEN_ACCESS !== 'true') {
    throw new Error('El acceso abierto requiere NODE_ENV=development y LOCAL_DEV_OPEN_ACCESS=true.');
  }
  if (!entorno.DB_HOST
    || !['localhost', '127.0.0.1', '::1'].includes(entorno.DB_HOST.toLowerCase())
    || !entorno.DB_NAME
    || !Number.isInteger(Number(entorno.DB_PORT))
    || Number(entorno.DB_PORT) < 1
    || Number(entorno.DB_PORT) > 65535) {
    throw new Error('El acceso abierto requiere una conexión PostgreSQL completa en backend/.env.');
  }
}

export function validarBaseDesarrolloActiva(
  entorno: EntornoAccesoDesarrollo,
  base: VerificacionBaseDesarrollo,
): void {
  validarConfiguracionAccesoDesarrollo(entorno);
  if (base.nombre !== entorno.DB_NAME
    || !direccionEsLoopback(base.direccion ?? undefined)
    || base.puerto !== Number(entorno.DB_PORT)) {
    throw new Error('La conexión PostgreSQL activa no corresponde a la base definida en backend/.env.');
  }
}

export function resolverOrigenesEscrituraLocal(entorno: EntornoAccesoDesarrollo): string[] {
  const origenes = (entorno.LOCAL_DEV_WRITE_ORIGINS ?? '')
    .split(',').map((origen) => origen.trim()).filter(Boolean);
  if (!origenes.length || origenes.some((origen) => {
    try {
      const url = new URL(origen);
      return url.protocol !== 'http:' || url.origin !== origen
        || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname.toLowerCase());
    } catch { return true; }
  })) {
    throw new Error('LOCAL_DEV_WRITE_ORIGINS debe enumerar orígenes HTTP loopback exactos.');
  }
  return [...new Set(origenes)];
}

function encabezado(solicitud: SolicitudLocalApi, nombre: string): string | undefined {
  const valor = solicitud.headers?.[nombre];
  return Array.isArray(valor) ? valor[0] : valor;
}

function rechazar(respuesta: RespuestaLocalApi, estado: number, codigo: string, mensaje: string): void {
  respuesta.statusCode = estado;
  respuesta.setHeader?.('Content-Type', 'application/json; charset=utf-8');
  respuesta.setHeader?.('Cache-Control', 'no-store');
  respuesta.end?.(JSON.stringify({ statusCode: estado, code: codigo, message: mensaje }));
}

/** Identidad técnica del proceso local, nunca representa una persona ni una cuenta. */
export function crearMiddlewareAccesoDesarrolloLocal(capacidades = CAPACIDADES_DESARROLLO_LOCAL) {
  const identidad: IdentidadApi = Object.freeze({
    sujeto: IDENTIDAD_TECNICA_DESARROLLO,
    tipo: 'DESARROLLO_LOCAL',
    capacidades,
  });
  return (solicitud: SolicitudLocalApi, respuesta: RespuestaLocalApi, continuar: () => void): void => {
    if (encabezado(solicitud, 'x-genares-dev-identity') !== undefined) {
      return rechazar(respuesta, 400, 'DEVELOPMENT_IDENTITY_HEADER_REMOVED', 'La selección de identidades simuladas ya no está disponible.');
    }
    if (!direccionEsLoopback(solicitud.socket?.remoteAddress)) {
      return rechazar(respuesta, 403, 'LOCAL_DEVELOPMENT_LOOPBACK_ONLY', 'La API de desarrollo solo acepta conexiones loopback.');
    }
    solicitud.identidadApi = identidad;
    respuesta.setHeader?.('Cache-Control', 'no-store');
    continuar();
  };
}

export function crearMiddlewareProteccionEscrituraLocal(origenesPermitidos: string[]) {
  const permitidos = new Set(origenesPermitidos);
  return (
    solicitud: SolicitudLocalApi,
    respuesta: RespuestaLocalApi,
    continuar: () => void,
  ): void => {
    if (['GET', 'HEAD', 'OPTIONS'].includes((solicitud.method ?? '').toUpperCase())) return continuar();
    const origen = encabezado(solicitud, 'origin');
    const fetchSite = encabezado(solicitud, 'sec-fetch-site');
    const contenido = encabezado(solicitud, 'content-type')?.split(';')[0].trim().toLowerCase();
    const intencion = encabezado(solicitud, 'x-genares-write-intent');
    // same-site: la APK de desarrollo (http://localhost) llama al backend en localhost:3001.
    // Solo se acepta si el origen está en la lista; cross-site sigue rechazándose.
    if (!origen || !permitidos.has(origen) || !['same-origin', 'same-site'].includes(fetchSite ?? '')
      || !aceptaContenido(solicitud, contenido) || intencion !== 'local-development') {
      return rechazar(respuesta, 403, 'LOCAL_WRITE_ORIGIN_REJECTED', 'Solicitud de escritura local rechazada.');
    }
    continuar();
  };
}

/**
 * CORS solo para el modo local y solo para los orígenes exactos de LOCAL_DEV_WRITE_ORIGINS
 * (por ejemplo, la APK de desarrollo en http://localhost). Fuera del modo local no se habilita.
 */
export function opcionesCorsDesarrolloLocal(origenesPermitidos: string[]) {
  const permitidos = new Set(origenesPermitidos);
  return {
    origin: (origen: string | undefined, responder: (error: Error | null, permitir?: boolean) => void) =>
      responder(null, Boolean(origen) && permitidos.has(origen as string)),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Content-Type', 'X-Genares-Write-Intent', 'X-Correlation-Id'],
    credentials: false,
    maxAge: 600,
  };
}

export async function instalarIdentidadDesarrolloLocal(
  aplicacion: INestApplication,
  entorno: EntornoAccesoDesarrollo = process.env,
  verificarBase?: () => Promise<VerificacionBaseDesarrollo>,
): Promise<boolean> {
  const habilitado = entorno.NODE_ENV === 'development' && entorno.LOCAL_DEV_OPEN_ACCESS === 'true';
  if (!habilitado) return false;
  validarConfiguracionAccesoDesarrollo(entorno);
  if (!verificarBase) throw new Error('No se pudo verificar PostgreSQL antes de habilitar el acceso local.');
  validarBaseDesarrolloActiva(entorno, await verificarBase());
  // La integración usa capacidades propias para las evaluaciones del MER.
  const capacidades = entorno.ENABLE_INTEGRACION_DEV === 'true'
    ? ['trabajos:leer', 'integracion:guardar-borrador', 'integracion:cerrar-evaluacion',
      'programaciones:leer', 'programaciones:administrar', 'rubricas:leer', 'rubricas:administrar',
      'modalidades:leer', 'carreras:leer', 'evaluaciones:leer', 'evaluaciones:leer-demostracion',
      'documentos:emitir', 'configuracion-academica:administrar',
      // SE-03: cierre administrativo del trabajo (Paso 2, Anexo A.2 «Cierre autorizado»).
      'trabajos:finalizar',
      // RF-36: solicitar y autorizar correcciones extraordinarias (Paso 2, Anexo A.2).
      'evaluaciones:solicitar-correccion', 'evaluaciones:autorizar-correccion']
    : CAPACIDADES_DESARROLLO_LOCAL;
  const origenes = resolverOrigenesEscrituraLocal(entorno);
  // Antes de la protección, para que también un rechazo 403 llegue con cabeceras CORS.
  aplicacion.enableCors(opcionesCorsDesarrolloLocal(origenes));
  aplicacion.use(crearMiddlewareAccesoDesarrolloLocal(capacidades));
  aplicacion.use(crearMiddlewareProteccionEscrituraLocal(origenes));
  return true;
}
