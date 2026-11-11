// S4-16 · Persistencia local y sincronización de borradores (Paso 2, CT-02; RF-29 a RF-32, RF-47).
// Un borrador local es una copia en el dispositivo; PostgreSQL sigue siendo la fuente oficial.
// Nunca se cierra una evaluación desde el dispositivo: el cierre exige respuesta del servidor.

const PREFIJO = 'genares:borrador:v1:';
const PREFIJO_EXPEDIENTE = 'genares:expediente:v1:';

/** Estado del borrador guardado en el dispositivo. */
export const ESTADO_LOCAL = Object.freeze({
  /** Guardado en el dispositivo; aún no se pidió enviarlo. */
  LOCAL: 'LOCAL',
  /** Se pidió guardar en el servidor pero no hubo conexión: se enviará al volver. */
  PENDIENTE: 'PENDIENTE',
  /** El servidor tiene otra revisión: se conservan ambas versiones y decide el usuario. */
  CONFLICTO: 'CONFLICTO',
});

const almacenPorDefecto = () => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

/** Una clave por evaluación: etapa, titular (estudiante o compartida) y evaluador. */
export function claveBorrador({ asignacionId, tipo, idEtapa, idTitular, idEvaluador }) {
  if (!asignacionId || !idEtapa || !idEvaluador || (tipo === 'ORAL' && !idTitular)) return null;
  return `${PREFIJO}${tipo === 'ORAL' ? 'oral' : 'escrita'}:${asignacionId}:${idEtapa}:${idTitular ?? 'compartida'}:${idEvaluador}`;
}

export function leerBorrador(clave, almacen = almacenPorDefecto()) {
  if (!clave || !almacen) return null;
  try {
    const registro = JSON.parse(almacen.getItem(clave));
    return registro && typeof registro === 'object' && registro.notas && Number.isInteger(registro.revisionBase) ? registro : null;
  } catch {
    return null;
  }
}

/** Guarda en el dispositivo. Devuelve false si el almacenamiento no está disponible o está lleno. */
export function guardarBorrador(clave, datos, almacen = almacenPorDefecto(), ahora = new Date()) {
  if (!clave || !almacen) return false;
  try {
    const anterior = leerBorrador(clave, almacen);
    const registro = { ...anterior, ...datos, estado: datos.estado ?? anterior?.estado ?? ESTADO_LOCAL.LOCAL, actualizadoEn: ahora.toISOString() };
    almacen.setItem(clave, JSON.stringify(registro));
    return true;
  } catch {
    return false;
  }
}

export function eliminarBorrador(clave, almacen = almacenPorDefecto()) {
  try { if (clave && almacen) almacen.removeItem(clave); } catch { /* sin almacenamiento disponible */ }
}

/** Borradores que esperan conexión para enviarse al servidor. */
export function listarPendientes(almacen = almacenPorDefecto()) {
  if (!almacen) return [];
  const pendientes = [];
  for (let i = 0; i < almacen.length; i += 1) {
    const clave = almacen.key(i);
    if (!clave?.startsWith(PREFIJO)) continue;
    const registro = leerBorrador(clave, almacen);
    if (registro?.estado === ESTADO_LOCAL.PENDIENTE) pendientes.push({ clave, ...registro });
  }
  return pendientes;
}

/**
 * Decide qué mostrar al abrir una evaluación que puede tener un borrador local.
 * Nunca descarta el borrador del dispositivo sin que el usuario lo decida.
 */
export function resolverRecuperacion({ local, revisionServidor, estadoServidor }) {
  if (!local) return { origen: 'servidor', conflicto: null };
  if (estadoServidor && estadoServidor !== 'BORRADOR') return { origen: 'servidor', conflicto: 'CERRADA' };
  if (local.revisionBase !== revisionServidor) return { origen: 'servidor', conflicto: 'REVISION' };
  return { origen: 'local', conflicto: local.estado === ESTADO_LOCAL.CONFLICTO ? 'REVISION' : null };
}

/** Las notas del dispositivo coinciden con las del servidor (el envío llegó aunque se perdiera la respuesta). */
export function mismasNotas(notasLocales, puntajesServidor = []) {
  const servidor = new Map(puntajesServidor.map((p) => [p.idIndicador, p]));
  if (servidor.size !== Object.keys(notasLocales).length) return false;
  const normal = (valor) => (valor === null || valor === undefined || String(valor).trim() === '' ? null : Number(valor));
  return Object.entries(notasLocales).every(([id, nota]) => {
    const remoto = servidor.get(id);
    return normal(nota?.score) === normal(remoto?.score)
      && String(nota?.observation ?? '').trim() === String(remoto?.observation ?? '').trim();
  });
}

/** Copia del expediente para seguir evaluando si se recarga sin conexión (solo lectura de lo ya descargado). */
export function guardarExpediente(asignacionId, datos, almacen = almacenPorDefecto(), ahora = new Date()) {
  try {
    almacen?.setItem(`${PREFIJO_EXPEDIENTE}${asignacionId}`, JSON.stringify({ guardadoEn: ahora.toISOString(), datos }));
    return true;
  } catch {
    return false;
  }
}

export function leerExpediente(asignacionId, almacen = almacenPorDefecto()) {
  try {
    const copia = JSON.parse(almacen?.getItem(`${PREFIJO_EXPEDIENTE}${asignacionId}`));
    return copia?.datos ? copia : null;
  } catch {
    return null;
  }
}

/** Texto visible de cada estado de sincronización. */
export function etiquetaSincronizacion({ estadoLocal, guardadoServidor, revision, sinConexion }) {
  if (estadoLocal === ESTADO_LOCAL.CONFLICTO) return { tono: 'conflicto', texto: 'Conflicto con el servidor: tus cambios se conservan en este dispositivo.' };
  if (estadoLocal === ESTADO_LOCAL.PENDIENTE) {
    return { tono: 'pendiente', texto: sinConexion ? 'Pendiente de sincronización · se enviará al recuperar la conexión.' : 'Pendiente de sincronización · enviando al servidor…' };
  }
  if (estadoLocal === ESTADO_LOCAL.LOCAL) return { tono: 'local', texto: 'Guardado localmente en este dispositivo · aún no está en el servidor.' };
  if (guardadoServidor) return { tono: 'servidor', texto: `Guardado en servidor · revisión ${revision}.` };
  return { tono: 'neutro', texto: `Sin cambios · revisión ${revision} del servidor.` };
}

export const RESULTADO_SINCRONIZACION = Object.freeze({
  SINCRONIZADO: 'SINCRONIZADO',
  PENDIENTE: 'PENDIENTE',
  CONFLICTO: 'CONFLICTO',
});

/**
 * Envía un borrador al servidor sin perderlo nunca:
 * - sin conexión → queda PENDIENTE para reintentar;
 * - 409 por otra revisión → si el servidor ya tiene las mismas notas (la respuesta se perdió
 *   en el corte), se considera sincronizado; si no, CONFLICTO y se conservan ambas versiones;
 * - cualquier otro rechazo del servidor (reglas académicas, validación) se propaga tal cual.
 */
export async function sincronizarBorrador({ registro, enviar, consultarEvaluacion, esErrorConexion }) {
  try {
    await enviar(registro);
    return { resultado: RESULTADO_SINCRONIZACION.SINCRONIZADO };
  } catch (error) {
    if (esErrorConexion(error)) return { resultado: RESULTADO_SINCRONIZACION.PENDIENTE };
    if (error?.status !== 409) throw error;
    let remota;
    try {
      remota = await consultarEvaluacion();
    } catch (errorConsulta) {
      if (esErrorConexion(errorConsulta)) return { resultado: RESULTADO_SINCRONIZACION.PENDIENTE };
      throw errorConsulta;
    }
    const revisionRemota = Number(remota?.revision ?? 0);
    if (remota && remota.estado !== 'BORRADOR') return { resultado: RESULTADO_SINCRONIZACION.CONFLICTO, conflicto: 'CERRADA', remota };
    if (revisionRemota === registro.revisionBase) throw error; // No es un conflicto de revisión.
    if (!registro.idOperacion && remota && revisionRemota === registro.revisionBase + 1 && mismasNotas(registro.notas, remota.puntajes)) {
      return { resultado: RESULTADO_SINCRONIZACION.SINCRONIZADO, reconciliado: true };
    }
    return { resultado: RESULTADO_SINCRONIZACION.CONFLICTO, conflicto: 'REVISION', remota };
  }
}
