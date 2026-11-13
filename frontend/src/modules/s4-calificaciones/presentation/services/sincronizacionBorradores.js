// RF-31 · Sincronización de la cola local de borradores al volver la conexión.
// Envía los borradores del dispositivo que no están abiertos en esta pestaña, con su revisión base
// y su identificador de operación (el servidor no duplica un reintento). Solo se borra la copia local
// cuando el servidor acepta el borrador; un rechazo deja la cola intacta. Nunca cierra evaluaciones.
import {
  contextoDeClave, eliminarBorrador, ESTADO_LOCAL, estaEnEdicion, guardarBorrador, leerBorrador,
  listarPendientes, RESULTADO_SINCRONIZACION, sincronizarBorrador,
} from '../../domain/borradoresLocales';
import {
  construirPuntajesOrales, guardarBorradorOralMerDev, obtenerEvaluacionesMerDev, validarPuntajesOrales,
} from './evaluacionesMerDev';

/** Estados que esperan envío: guardado solo en el dispositivo o pendiente de conexión. */
export const ESTADOS_EN_COLA = Object.freeze([ESTADO_LOCAL.LOCAL, ESTADO_LOCAL.PENDIENTE]);

const evaluacionDe = (datos, contexto) => datos?.evaluaciones?.find((evaluacion) =>
  evaluacion.idEtapaRubrica === contexto.idEtapa
  && evaluacion.idAsignacionTribunal === contexto.idEvaluador
  && (evaluacion.idEstudiante ?? null) === contexto.idTitular);

/** Cuántos borradores esperan envío y cuántos tienen conflicto con el servidor. */
export function contarCola(almacen) {
  return {
    pendientes: listarPendientes(almacen, ESTADOS_EN_COLA).length,
    conflictos: listarPendientes(almacen, [ESTADO_LOCAL.CONFLICTO]).length,
  };
}

/**
 * Recorre la cola una vez. Se detiene al primer error de conexión: el resto se intenta en el
 * siguiente ciclo. Devuelve el resumen del recorrido.
 */
export async function sincronizarColaBorradores({
  esErrorConexion,
  almacen,
  consultarExpediente = obtenerEvaluacionesMerDev,
  enviarBorrador = guardarBorradorOralMerDev,
  enEdicion = estaEnEdicion,
}) {
  const resumen = { sincronizados: 0, conflictos: 0, rechazados: 0, sinConexion: false };
  const expedientes = new Map();
  const expediente = async (asignacionId) => {
    if (!expedientes.has(asignacionId)) expedientes.set(asignacionId, await consultarExpediente(asignacionId));
    return expedientes.get(asignacionId);
  };

  for (const { clave } of listarPendientes(almacen, ESTADOS_EN_COLA)) {
    const contexto = contextoDeClave(clave);
    if (!contexto) { resumen.rechazados += 1; continue; }
    try {
      const datos = await expediente(contexto.asignacionId);
      // Se vuelve a leer: pudo abrirse o cambiar mientras se consultaba el expediente.
      const registro = leerBorrador(clave, almacen);
      if (enEdicion(clave) || !ESTADOS_EN_COLA.includes(registro?.estado)) continue;
      const etapa = datos?.puedeGuardarBorradores ? datos.etapas?.find(({ id }) => id === contexto.idEtapa) : null;
      if (!etapa) { resumen.rechazados += 1; continue; }

      const actual = evaluacionDe(datos, contexto);
      if (actual && actual.estado !== 'BORRADOR') {
        // Se cerró en el servidor: se conserva la copia local para que el usuario decida.
        if (guardarBorrador(clave, { estado: ESTADO_LOCAL.CONFLICTO }, almacen)) resumen.conflictos += 1;
        continue;
      }
      const indicadores = etapa.categorias.flatMap((categoria) => categoria.indicadores);
      const puntajes = construirPuntajesOrales(indicadores, registro.notas);
      validarPuntajesOrales(indicadores, puntajes);

      const { resultado } = await sincronizarBorrador({
        registro,
        enviar: () => enviarBorrador(contexto.asignacionId, {
          idEtapaRubrica: contexto.idEtapa, idAsignacionTribunal: contexto.idEvaluador, idEstudiante: contexto.idTitular,
          revisionEsperada: registro.revisionBase, puntajes,
          ...(registro.idOperacion && { idOperacion: registro.idOperacion }),
        }, contexto.tipo),
        consultarEvaluacion: async () => evaluacionDe(await consultarExpediente(contexto.asignacionId), contexto),
        esErrorConexion,
      });

      // Si el borrador cambió durante el envío, se deja: el siguiente ciclo envía la versión nueva.
      if (leerBorrador(clave, almacen)?.actualizadoEn !== registro.actualizadoEn) continue;
      if (resultado === RESULTADO_SINCRONIZACION.PENDIENTE) { resumen.sinConexion = true; break; }
      if (resultado === RESULTADO_SINCRONIZACION.SINCRONIZADO) {
        eliminarBorrador(clave, almacen);
        resumen.sincronizados += 1;
        expedientes.delete(contexto.asignacionId); // la revisión del servidor cambió
      } else if (guardarBorrador(clave, { estado: ESTADO_LOCAL.CONFLICTO }, almacen)) {
        resumen.conflictos += 1;
      }
    } catch (error) {
      if (esErrorConexion(error)) { resumen.sinConexion = true; break; }
      resumen.rechazados += 1; // El borrador queda tal cual en el dispositivo.
    }
  }
  return resumen;
}
