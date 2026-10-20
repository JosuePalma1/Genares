import { INestApplication } from '@nestjs/common';
import { IdentidadApi, SolicitudConIdentidad } from './identidad-api';

export type PerfilIdentidadLocal =
  | 'lector'
  | 'sin-capacidades'
  | 'sin-identidad'
  | 'administrador-rubricas';

export interface EntornoIdentidadLocal {
  NODE_ENV?: string;
  LOCAL_DEV_IDENTITY_ENABLED?: string;
  LOCAL_DEV_IDENTITY_PROFILE?: string;
  LOCAL_DEV_WRITE_ENABLED?: string;
  LOCAL_DEV_WRITE_ORIGINS?: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_DISPOSABLE?: string;
}

export interface SolicitudLocalApi extends SolicitudConIdentidad {
  socket?: { remoteAddress?: string };
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface VerificacionBaseDesechable {
  nombre: string;
  direccion: string | null;
  puerto: number;
  marca: string | null;
}

export const PUERTO_POSTGRES_9D = 55441;
export const BASE_POSTGRES_9D = 'genares_9d_disposable';
export const MARCA_BASE_POSTGRES_9D = 'GENARES:9D:DISPOSABLE';

const IDENTIDADES_LOCALES: Record<Exclude<PerfilIdentidadLocal, 'sin-identidad'>, IdentidadApi> = {
  lector: {
    sujeto: 'desarrollo-local-lector',
    tipo: 'SIMULADA',
    capacidades: ['rubricas:leer', 'modalidades:leer'],
  },
  'sin-capacidades': {
    sujeto: 'desarrollo-local-sin-capacidades',
    tipo: 'SIMULADA',
    capacidades: [],
  },
  'administrador-rubricas': {
    sujeto: 'desarrollo-local-administrador-rubricas',
    tipo: 'SIMULADA',
    capacidades: ['rubricas:leer', 'rubricas:administrar', 'modalidades:leer', 'modalidades:administrar'],
  },
};

export function direccionEsLoopback(direccion?: string): boolean {
  if (!direccion) return false;
  const normalizada = direccion.toLowerCase().replace(/^::ffff:/, '');
  return normalizada === '127.0.0.1' || normalizada === '::1';
}

function esOrigenLocalValido(origen: string): boolean {
  try {
    const url = new URL(origen);
    return url.protocol === 'http:'
      && url.origin === origen
      && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function resolverOrigenesEscrituraLocal(entorno: EntornoIdentidadLocal): string[] {
  const origenes = (entorno.LOCAL_DEV_WRITE_ORIGINS ?? '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
  if (!origenes.length || origenes.some((origen) => !esOrigenLocalValido(origen))) {
    throw new Error('LOCAL_DEV_WRITE_ORIGINS debe contener orígenes HTTP loopback exactos, sin rutas ni comodines.');
  }
  return [...new Set(origenes)];
}

function validarConfiguracionBaseDesechable(entorno: EntornoIdentidadLocal): void {
  if (
    entorno.DB_DISPOSABLE !== 'true'
    || entorno.DB_HOST !== '127.0.0.1'
    || Number(entorno.DB_PORT) !== PUERTO_POSTGRES_9D
    || entorno.DB_NAME !== BASE_POSTGRES_9D
  ) {
    throw new Error('El perfil administrativo local exige la base desechable 9D en 127.0.0.1:55441.');
  }
}

export function validarBasePostgresDesechable9D(
  entorno: EntornoIdentidadLocal,
  base: VerificacionBaseDesechable,
): void {
  validarConfiguracionBaseDesechable(entorno);
  if (
    base.nombre !== BASE_POSTGRES_9D
    || !direccionEsLoopback(base.direccion ?? undefined)
    || base.puerto !== PUERTO_POSTGRES_9D
    || base.marca !== MARCA_BASE_POSTGRES_9D
  ) {
    throw new Error('La conexión activa no corresponde al clúster PostgreSQL desechable de la etapa 9D.');
  }
}

export function resolverPerfilIdentidadLocal(
  entorno: EntornoIdentidadLocal,
): PerfilIdentidadLocal | null {
  const perfil = entorno.LOCAL_DEV_IDENTITY_PROFILE;
  const escrituraSolicitada = entorno.LOCAL_DEV_WRITE_ENABLED === 'true';
  const identidadHabilitada = entorno.LOCAL_DEV_IDENTITY_ENABLED === 'true';

  if (perfil === 'administrador-rubricas' || escrituraSolicitada) {
    if (entorno.NODE_ENV !== 'development') {
      throw new Error('La identidad administrativa local solo puede habilitarse con NODE_ENV=development.');
    }
    if (!identidadHabilitada || !escrituraSolicitada || perfil !== 'administrador-rubricas') {
      throw new Error('La escritura local requiere opt-in explícito de identidad y perfil administrador de rúbricas.');
    }
    validarConfiguracionBaseDesechable(entorno);
    resolverOrigenesEscrituraLocal(entorno);
    return 'administrador-rubricas';
  }

  if (!identidadHabilitada) return null;
  if (!['development', 'test'].includes(entorno.NODE_ENV ?? '')) {
    throw new Error('La identidad local simulada solo puede habilitarse en desarrollo o pruebas.');
  }
  if (perfil !== 'lector' && perfil !== 'sin-capacidades' && perfil !== 'sin-identidad') {
    throw new Error('LOCAL_DEV_IDENTITY_PROFILE debe ser lector, sin-capacidades o sin-identidad.');
  }
  return perfil;
}

function encabezado(solicitud: SolicitudLocalApi, nombre: string): string | undefined {
  const valor = solicitud.headers?.[nombre];
  return Array.isArray(valor) ? valor[0] : valor;
}

export function crearMiddlewareIdentidadLocal(perfil: PerfilIdentidadLocal) {
  return (
    solicitud: SolicitudLocalApi,
    _respuesta: unknown,
    continuar: () => void,
  ): void => {
    // No se confía en X-Forwarded-For ni en ningún dato que envíe el navegador.
    if (!direccionEsLoopback(solicitud.socket?.remoteAddress)) return continuar();
    if (solicitud.identidadApi || perfil === 'sin-identidad') return continuar();

    const identidad = IDENTIDADES_LOCALES[perfil];
    solicitud.identidadApi = {
      sujeto: identidad.sujeto,
      tipo: identidad.tipo,
      capacidades: [...identidad.capacidades],
    };
    continuar();
  };
}

export function crearMiddlewareProteccionEscrituraLocal(origenesPermitidos: string[]) {
  const permitidos = new Set(origenesPermitidos);
  return (
    solicitud: SolicitudLocalApi,
    respuesta: { statusCode?: number; setHeader?: (nombre: string, valor: string) => void; end?: (mensaje?: string) => void },
    continuar: () => void,
  ): void => {
    if (['GET', 'HEAD'].includes((solicitud.method ?? '').toUpperCase())) return continuar();

    const origen = encabezado(solicitud, 'origin');
    const fetchSite = encabezado(solicitud, 'sec-fetch-site');
    const contenido = encabezado(solicitud, 'content-type')?.split(';')[0].trim().toLowerCase();
    const intencion = encabezado(solicitud, 'x-genares-write-intent');
    if (
      !origen
      || !permitidos.has(origen)
      || fetchSite !== 'same-origin'
      || contenido !== 'application/json'
      || intencion !== 'local-development'
    ) {
      respuesta.statusCode = 403;
      respuesta.setHeader?.('Content-Type', 'application/json; charset=utf-8');
      respuesta.end?.(JSON.stringify({
        statusCode: 403,
        code: 'LOCAL_WRITE_ORIGIN_REJECTED',
        message: 'Solicitud de escritura local rechazada.',
      }));
      return;
    }
    continuar();
  };
}

export async function instalarIdentidadDesarrolloLocal(
  aplicacion: INestApplication,
  entorno: EntornoIdentidadLocal = process.env,
  verificarBase?: () => Promise<VerificacionBaseDesechable>,
): Promise<PerfilIdentidadLocal | null> {
  const perfil = resolverPerfilIdentidadLocal(entorno);
  if (!perfil) return null;

  if (perfil === 'administrador-rubricas') {
    if (!verificarBase) throw new Error('No se pudo verificar PostgreSQL antes de instalar el perfil administrativo local.');
    validarBasePostgresDesechable9D(entorno, await verificarBase());
    aplicacion.use(crearMiddlewareIdentidadLocal(perfil));
    aplicacion.use(crearMiddlewareProteccionEscrituraLocal(resolverOrigenesEscrituraLocal(entorno)));
    return perfil;
  }

  aplicacion.use(crearMiddlewareIdentidadLocal(perfil));
  return perfil;
}
