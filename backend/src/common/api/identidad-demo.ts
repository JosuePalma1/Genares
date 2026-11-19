import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ejecutarConIdentidad } from './contexto-alcance';
import { IdentidadApi, SolicitudConIdentidad } from './identidad-api';

/**
 * USUARIOS DE DEMOSTRACIÓN · solo rama demo/accesos-por-rol y solo en desarrollo local.
 * Simula el proveedor de identidad institucional (Paso 2, CT-01: «Simular usuarios, roles y
 * ámbitos TI/Software con seeders solo en pruebas»). No es autenticación real: la contraseña es
 * común y conocida, y el token se firma con un secreto que cambia en cada arranque.
 */
export const CONTRASENA_DEMO = 'Demo2026!';

const ROL_SUPERUSUARIO = 'SUPERUSUARIO';

const LECTURA = ['trabajos:leer', 'evaluaciones:leer'];

/** Capacidades por actor, según Paso 1 §2 y Paso 2 Anexo A.4. */
const CAPACIDADES_INSTITUCIONALES = {
  // Califica sus evaluaciones y consulta sus sesiones; sin rúbricas ni programación.
  TRIBUNAL: [...LECTURA, 'programaciones:leer', 'integracion:guardar-borrador', 'integracion:cerrar-evaluacion',
    'evaluaciones:solicitar-correccion'],
  // Supervisión, programación, rúbricas, documentos, cierre, correcciones y auditoría de su carrera.
  COORDINACION: [...LECTURA, 'programaciones:leer', 'programaciones:administrar', 'rubricas:leer',
    'rubricas:administrar', 'modalidades:leer', 'carreras:leer', 'documentos:emitir', 'trabajos:finalizar',
    'evaluaciones:autorizar-correccion', 'configuracion-academica:administrar'],
  // Consulta transversal TI/Software; programa y cierra con permiso; sin editar rúbricas.
  PRESIDENCIA: [...LECTURA, 'programaciones:leer', 'programaciones:administrar', 'rubricas:leer',
    'modalidades:leer', 'carreras:leer', 'trabajos:finalizar'],
  // Consulta de su carrera.
  COMISION: [...LECTURA, 'rubricas:leer', 'modalidades:leer', 'carreras:leer'],
  // Resultados y documentos; sin editar notas, rúbricas ni programación.
  SECRETARIA: [...LECTURA, 'documentos:emitir'],
  // Solo configuración técnica y auditoría; sin trabajos ni notas.
  ADMINISTRACION: ['configuracion-academica:administrar', 'carreras:leer', 'modalidades:leer'],
};

export type RolDemo = keyof typeof CAPACIDADES_INSTITUCIONALES | typeof ROL_SUPERUSUARIO;

export const CAPACIDADES_POR_ROL: Readonly<Record<RolDemo, readonly string[]>> = Object.freeze({
  ...CAPACIDADES_INSTITUCIONALES,
  SUPERUSUARIO: [...new Set(Object.values(CAPACIDADES_INSTITUCIONALES).flat())],
});

export const NOMBRES_ROL: Readonly<Record<RolDemo, string>> = Object.freeze({
  SUPERUSUARIO: 'Superusuario',
  TRIBUNAL: 'Tribunal',
  COORDINACION: 'Coordinación',
  PRESIDENCIA: 'Presidencia / Asistencia',
  COMISION: 'Comisión Académica',
  SECRETARIA: 'Secretaría',
  ADMINISTRACION: 'Administración técnica',
});

export interface UsuarioDemo {
  usuario: string;
  /** Debe coincidir con gen.usuario.sujeto_autenticacion (fixtures/demo-usuarios-por-rol.sql). */
  sujeto: string;
  nombre: string;
  rol: RolDemo;
  /** Códigos de carrera; null = todas. */
  carreras: string[] | null;
}

const TI = 'DEV-TI';
const SOFT = 'DEV-SOFT';

export const USUARIOS_DEMO: readonly UsuarioDemo[] = Object.freeze([
  { usuario: 'super.admin', sujeto: 'demo-super-admin', nombre: 'Superusuario S4', rol: ROL_SUPERUSUARIO, carreras: null },
  { usuario: 'tribunal.ti', sujeto: 'dev-ti-a', nombre: 'María Docente TI A', rol: 'TRIBUNAL', carreras: null },
  { usuario: 'tribunal.soft', sujeto: 'dev-soft-a', nombre: 'Lucía Docente Software A', rol: 'TRIBUNAL', carreras: null },
  { usuario: 'tribunal.carga', sujeto: 'demo-tribunal-carga', nombre: 'Ana Docente Carga TI A', rol: 'TRIBUNAL', carreras: null },
  { usuario: 'coordinacion.ti', sujeto: 'demo-coordinacion-ti', nombre: 'Coordinación TI', rol: 'COORDINACION', carreras: [TI] },
  { usuario: 'coordinacion.soft', sujeto: 'demo-coordinacion-soft', nombre: 'Coordinación Software', rol: 'COORDINACION', carreras: [SOFT] },
  { usuario: 'presidencia', sujeto: 'demo-presidencia', nombre: 'Presidencia', rol: 'PRESIDENCIA', carreras: [TI, SOFT] },
  { usuario: 'comision.ti', sujeto: 'demo-comision-ti', nombre: 'Comisión Académica TI', rol: 'COMISION', carreras: [TI] },
  { usuario: 'secretaria', sujeto: 'demo-secretaria', nombre: 'Secretaría', rol: 'SECRETARIA', carreras: [TI, SOFT] },
  { usuario: 'admin.tecnico', sujeto: 'demo-admin-tecnico', nombre: 'Administración técnica', rol: 'ADMINISTRACION', carreras: [] },
  // Tribunales de los trabajos PILOTO (fixtures/demo-piloto-desde-cero.sql): S4 desde cero con la rúbrica vigente.
  { usuario: 'tribunal.ti1', sujeto: 'demo-piloto-ti-1', nombre: 'Andrea Piloto TI 1', rol: 'TRIBUNAL', carreras: null },
  { usuario: 'tribunal.ti2', sujeto: 'demo-piloto-ti-2', nombre: 'Bernardo Piloto TI 2', rol: 'TRIBUNAL', carreras: null },
  { usuario: 'tribunal.ti3', sujeto: 'demo-piloto-ti-3', nombre: 'Camila Piloto TI 3', rol: 'TRIBUNAL', carreras: null },
  { usuario: 'tribunal.ti4', sujeto: 'demo-piloto-ti-4', nombre: 'Daniel Piloto TI 4', rol: 'TRIBUNAL', carreras: null },
  { usuario: 'tribunal.soft1', sujeto: 'demo-piloto-soft-1', nombre: 'Elena Piloto Software 1', rol: 'TRIBUNAL', carreras: null },
  { usuario: 'tribunal.soft2', sujeto: 'demo-piloto-soft-2', nombre: 'Fernando Piloto Software 2', rol: 'TRIBUNAL', carreras: null },
  { usuario: 'tribunal.soft3', sujeto: 'demo-piloto-soft-3', nombre: 'Gabriela Piloto Software 3', rol: 'TRIBUNAL', carreras: null },
  { usuario: 'tribunal.soft4', sujeto: 'demo-piloto-soft-4', nombre: 'Héctor Piloto Software 4', rol: 'TRIBUNAL', carreras: null },
]);

export function identidadDeUsuarioDemo(usuario: UsuarioDemo): IdentidadApi {
  return Object.freeze({
    sujeto: usuario.sujeto,
    tipo: 'DEMOSTRACION',
    capacidades: Object.freeze([...CAPACIDADES_POR_ROL[usuario.rol]]),
    nombre: usuario.nombre,
    rol: usuario.rol,
    alcance: Object.freeze({ carreras: usuario.carreras, soloTribunal: usuario.rol === 'TRIBUNAL' }),
  });
}

export function resumenUsuarioDemo(usuario: UsuarioDemo) {
  return { usuario: usuario.usuario, nombre: usuario.nombre, rol: usuario.rol, nombreRol: NOMBRES_ROL[usuario.rol], carreras: usuario.carreras };
}

const DURACION_SESION_MS = 12 * 60 * 60 * 1000;
export const COOKIE_DEMO = 'genares_demo';

const base64url = (datos: Buffer | string) => Buffer.from(datos).toString('base64url');

export function crearFirmador(secreto: Buffer = randomBytes(32)) {
  const firmar = (contenido: string) => createHmac('sha256', secreto).update(contenido).digest('base64url');
  return {
    emitir(usuario: string, ahora = Date.now()): string {
      const contenido = base64url(JSON.stringify({ u: usuario, exp: ahora + DURACION_SESION_MS }));
      return `${contenido}.${firmar(contenido)}`;
    },
    /** Devuelve el usuario si la firma es válida y no ha vencido. */
    verificar(token: string | undefined, ahora = Date.now()): UsuarioDemo | null {
      if (!token || token.length > 512) return null;
      const [contenido, firma, sobrante] = token.split('.');
      if (!contenido || !firma || sobrante !== undefined) return null;
      const esperada = Buffer.from(firmar(contenido));
      const recibida = Buffer.from(firma);
      if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
      try {
        const { u, exp } = JSON.parse(Buffer.from(contenido, 'base64url').toString('utf8')) as { u?: unknown; exp?: unknown };
        if (typeof u !== 'string' || typeof exp !== 'number' || exp <= ahora) return null;
        return USUARIOS_DEMO.find((usuario) => usuario.usuario === u) ?? null;
      } catch {
        return null;
      }
    },
  };
}

export function credencialesValidas(usuario: unknown, contrasena: unknown): UsuarioDemo | null {
  if (typeof usuario !== 'string' || typeof contrasena !== 'string' || contrasena !== CONTRASENA_DEMO) return null;
  return USUARIOS_DEMO.find((candidato) => candidato.usuario === usuario.trim().toLowerCase()) ?? null;
}

interface SolicitudDemo extends SolicitudConIdentidad {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  on?: (evento: string, manejador: (dato?: Buffer) => void) => void;
}

interface RespuestaDemo {
  statusCode?: number;
  setHeader?: (nombre: string, valor: string | string[]) => void;
  end?: (cuerpo?: string) => void;
}

function encabezado(solicitud: SolicitudDemo, nombre: string): string | undefined {
  const valor = solicitud.headers?.[nombre];
  return Array.isArray(valor) ? valor[0] : valor;
}

export function tokenDeSolicitud(solicitud: SolicitudDemo): string | undefined {
  const autorizacion = encabezado(solicitud, 'authorization');
  if (autorizacion?.startsWith('Bearer ')) return autorizacion.slice(7).trim();
  const cookies = encabezado(solicitud, 'cookie') ?? '';
  for (const parte of cookies.split(';')) {
    const [nombre, ...valor] = parte.trim().split('=');
    if (nombre === COOKIE_DEMO) return valor.join('=');
  }
  return undefined;
}

/**
 * Sustituye la identidad técnica local por la del usuario de demostración cuando la petición trae
 * su sesión, y deja la identidad de la petición disponible para las consultas (ámbito).
 */
export function crearMiddlewareIdentidadDemo(firmador: ReturnType<typeof crearFirmador>) {
  return (solicitud: SolicitudDemo, _respuesta: unknown, continuar: () => void): void => {
    const token = tokenDeSolicitud(solicitud);
    const usuario = firmador.verificar(token);
    if (usuario) solicitud.identidadApi = identidadDeUsuarioDemo(usuario);
    // Una sesión vencida o de un arranque anterior no debe convertirse en la identidad local,
    // que lo ve todo: la petición queda sin identidad y el servidor responde 401.
    else if (token) solicitud.identidadApi = undefined;
    ejecutarConIdentidad(solicitud.identidadApi, continuar);
  };
}

function responder(respuesta: RespuestaDemo, estado: number, cuerpo?: unknown, cookie?: string): void {
  respuesta.statusCode = estado;
  respuesta.setHeader?.('Cache-Control', 'no-store');
  if (cookie) respuesta.setHeader?.('Set-Cookie', cookie);
  if (cuerpo === undefined) return respuesta.end?.();
  respuesta.setHeader?.('Content-Type', 'application/json; charset=utf-8');
  respuesta.end?.(JSON.stringify(cuerpo));
}

function leerCuerpo(solicitud: SolicitudDemo): Promise<Record<string, unknown>> {
  // Si un lector anterior ya interpretó el JSON, se usa ese resultado.
  if (solicitud.body && typeof solicitud.body === 'object') return Promise.resolve(solicitud.body as Record<string, unknown>);
  return new Promise((resolver) => {
    const partes: Buffer[] = [];
    let tamano = 0;
    solicitud.on?.('data', (dato) => {
      if (!dato) return;
      tamano += dato.length;
      if (tamano <= 4096) partes.push(dato);
    });
    solicitud.on?.('end', () => {
      try { resolver(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}') as Record<string, unknown>); } catch { resolver({}); }
    });
  });
}

const RUTA = '/api/v1/demo';

/** Entrada y salida de la demostración. Responde antes de llegar a NestJS. */
export function crearManejadorSesionDemo(firmador: ReturnType<typeof crearFirmador>) {
  return (solicitud: SolicitudDemo, respuesta: RespuestaDemo, continuar: () => void): void => {
    const ruta = (solicitud.originalUrl ?? solicitud.url ?? '').split('?')[0].replace(/\/+$/, '');
    if (!ruta.startsWith(RUTA)) return continuar();
    const metodo = (solicitud.method ?? 'GET').toUpperCase();

    if (ruta === `${RUTA}/estado` && metodo === 'GET') {
      return responder(respuesta, 200, { habilitado: true, usuarios: USUARIOS_DEMO.map(resumenUsuarioDemo) });
    }
    if (ruta === `${RUTA}/sesion` && metodo === 'GET') {
      const usuario = firmador.verificar(tokenDeSolicitud(solicitud));
      return usuario ? responder(respuesta, 200, { usuario: resumenUsuarioDemo(usuario) })
        : responder(respuesta, 401, { statusCode: 401, code: 'SIN_SESION_DEMO', message: 'No hay sesión de demostración.' });
    }
    if (ruta === `${RUTA}/sesion` && metodo === 'POST') {
      void leerCuerpo(solicitud).then(({ usuario, contrasena }) => {
        const encontrado = credencialesValidas(usuario, contrasena);
        if (!encontrado) {
          return responder(respuesta, 401, { statusCode: 401, code: 'CREDENCIALES_DEMO', message: 'Usuario o contraseña incorrectos.' });
        }
        const token = firmador.emitir(encontrado.usuario);
        return responder(respuesta, 200, { token, usuario: resumenUsuarioDemo(encontrado) },
          `${COOKIE_DEMO}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURACION_SESION_MS / 1000}`);
      });
      return;
    }
    if (ruta === `${RUTA}/salir` && metodo === 'POST') {
      return responder(respuesta, 204, undefined, `${COOKIE_DEMO}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    }
    return responder(respuesta, 404, { statusCode: 404, code: 'NOT_FOUND', message: 'Recurso no encontrado.' });
  };
}
