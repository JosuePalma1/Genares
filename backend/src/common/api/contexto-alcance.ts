import { AsyncLocalStorage } from 'node:async_hooks';
import { IdentidadApi } from './identidad-api';

/**
 * Ámbito de datos de la petición en curso (RF-03 a RF-05, Paso 2 CT-01).
 * Las consultas lo leen de aquí en vez de recibirlo por parámetro en cada función.
 * Sin identidad o con la identidad técnica DESARROLLO_LOCAL no hay restricción: así siguen
 * funcionando las pruebas y el acceso local de siempre.
 */
interface ContextoPeticion {
  identidad?: IdentidadApi;
}

const almacen = new AsyncLocalStorage<ContextoPeticion>();

export function ejecutarConIdentidad<T>(identidad: IdentidadApi | undefined, trabajo: () => T): T {
  return almacen.run({ identidad }, trabajo);
}

export interface AlcanceDatos {
  /** Códigos de carrera permitidos; null = todas. */
  carreras: string[] | null;
  /** Sujeto cuyo tribunal limita los trabajos visibles; null = sin esa restricción. */
  tribunalDe: string | null;
}

export const SIN_RESTRICCION: AlcanceDatos = Object.freeze({ carreras: null, tribunalDe: null });

export function identidadActual(): IdentidadApi | undefined {
  return almacen.getStore()?.identidad;
}

export function alcanceActual(): AlcanceDatos {
  const identidad = identidadActual();
  if (!identidad || identidad.tipo === 'DESARROLLO_LOCAL') return SIN_RESTRICCION;
  // Sin ámbito declarado, lo más restrictivo razonable: solo los trabajos de su tribunal.
  const alcance = identidad.alcance ?? { carreras: null, soloTribunal: true };
  return {
    carreras: alcance.carreras ? [...alcance.carreras] : null,
    tribunalDe: alcance.soloTribunal ? identidad.sujeto : null,
  };
}

/** true si la petición tiene restricciones de ámbito (identidad de demostración o verificada). */
export function hayRestriccionDeAlcance(): boolean {
  const alcance = alcanceActual();
  return alcance.carreras !== null || alcance.tribunalDe !== null;
}

// Las marcas son SQL válido que vale NULL («sin restricción»): sin ámbito, la consulta se envía tal
// cual, idéntica a la de siempre. Con ámbito, conAlcance() las cambia por parámetros.
const MARCA_CARRERAS = '/*ALCANCE_CARRERAS*/NULL';
const MARCA_TRIBUNAL = '/*ALCANCE_TRIBUNAL*/NULL';
const MARCA_SUPERUSUARIO = '/*ACCESO_SUPERUSUARIO*/';

/**
 * Condición SQL de ámbito para un trabajo. `asignacion` es el alias de s2.asignacion_tema y
 * `codigoCarrera` la expresión con el código de su carrera. Se completa con conAlcance().
 */
function tribunalConReemplazo(asignacion: string) {
  return `EXISTS (SELECT 1 FROM s4.reemplazos_etapa_actuales re
    JOIN s4.procesos_evaluacion proc ON proc.id=re.proceso AND proc.estado_registro=1
    JOIN gen.docente dr ON dr.id=re.docente AND dr.activo
    JOIN gen.usuario ur ON ur.id=dr.usuario_id AND ur.activo
    WHERE proc.asignacion_tema_id=${asignacion}.id AND ur.sujeto_autenticacion=${MARCA_TRIBUNAL})`;
}

export function filtroAlcance(asignacion = 'a', codigoCarrera = 'c.codigo'): string {
  return `
  AND (${MARCA_CARRERAS}::text[] IS NULL OR ${codigoCarrera} = ANY(${MARCA_CARRERAS}::text[]))
  AND (${MARCA_TRIBUNAL}::text IS NULL OR EXISTS (
    SELECT 1 FROM s3.asignacion_tribunal at_alc
    JOIN s3.miembros_tribunal m_alc ON m_alc.miembro_tribunal_id = at_alc.miembro_tribunal_id
    JOIN s3.docente_carrera_periodo dc_alc ON dc_alc.docente_carrera_periodo_id = m_alc.docente_carrera_periodo_id
    JOIN gen.docente d_alc ON d_alc.id = dc_alc.docente_id AND d_alc.activo
    JOIN gen.usuario u_alc ON u_alc.id = d_alc.usuario_id AND u_alc.activo
    WHERE at_alc.asignacion_tema_id = ${asignacion}.id AND u_alc.sujeto_autenticacion = ${MARCA_TRIBUNAL}) OR ${tribunalConReemplazo(asignacion)})`;
}

/**
 * Expresión SQL (sin AND) que es verdadera si el trabajo entra en el ámbito por carrera o por
 * tribunal. Para los servicios que ya permitían solo al tribunal: se añade con OR a esa condición.
 * Con la identidad local ambas partes son falsas y decide el acceso local de siempre.
 */
export function accesoPorAlcance(asignacion = 'a', codigoCarrera = 'c.codigo'): string {
  return `(${MARCA_SUPERUSUARIO}(${MARCA_CARRERAS}::text[] IS NOT NULL AND ${codigoCarrera} = ANY(${MARCA_CARRERAS}::text[]))
    OR (${MARCA_TRIBUNAL}::text IS NOT NULL AND (EXISTS (
      SELECT 1 FROM s3.asignacion_tribunal at_alc
      JOIN s3.miembros_tribunal m_alc ON m_alc.miembro_tribunal_id = at_alc.miembro_tribunal_id
      JOIN s3.docente_carrera_periodo dc_alc ON dc_alc.docente_carrera_periodo_id = m_alc.docente_carrera_periodo_id
      JOIN gen.docente d_alc ON d_alc.id = dc_alc.docente_id AND d_alc.activo
      JOIN gen.usuario u_alc ON u_alc.id = d_alc.usuario_id AND u_alc.activo
      WHERE at_alc.asignacion_tema_id = ${asignacion}.id AND u_alc.sujeto_autenticacion = ${MARCA_TRIBUNAL}) OR ${tribunalConReemplazo(asignacion)})))`;
}

/**
 * Sustituye las marcas de ámbito por parámetros al final de la lista. Sin restricción, o si la
 * consulta no tiene marcas, la devuelve igual: se puede usar en cualquier consulta.
 */
export function conAlcance(sql: string, parametros: unknown[] = [], alcance: AlcanceDatos = alcanceActual()): [string, unknown[]] {
  const identidad = identidadActual();
  if (identidad?.tipo === 'DEMOSTRACION' && identidad.rol === 'SUPERUSUARIO') {
    sql = sql.split(MARCA_SUPERUSUARIO).join('TRUE OR ');
  }
  if (alcance.carreras === null && alcance.tribunalDe === null) return [sql, parametros];
  if (!sql.includes(MARCA_CARRERAS) && !sql.includes(MARCA_TRIBUNAL)) return [sql, parametros];
  const base = parametros.length;
  return [
    sql.split(MARCA_CARRERAS).join(`$${base + 1}`).split(MARCA_TRIBUNAL).join(`$${base + 2}`),
    [...parametros, alcance.carreras, alcance.tribunalDe],
  ];
}
