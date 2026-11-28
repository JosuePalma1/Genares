import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';
import { rutaPdfRubrica } from '../../domain/documentosRubrica';
import { obtenerEvaluacionesMerDev } from '../services/evaluacionesMerDev';
import { BotonDocumentoPdf } from './BotonPdf';
import { ModalFormularioCatalogo } from './ModalFormularioCatalogo';
import './resumenCierreEvaluacion.css';

const INTERVALO_CONSULTA = 5000;
const formatoNota = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const notaConEscala = (nota, maximo) => `${formatoNota.format(nota)} / ${formatoNota.format(maximo)}`;

function resultadoConfirmado(datos, idEstudiante) {
  const resultado = datos.consolidados?.find((item) => item.idEstudiante === idEstudiante);
  return resultado?.estado === 'RESULTADO_COMPLETO' ? resultado.resultadoFinal : null;
}

export function DetalleCierreOral({ asignacionId, etapa, evaluador, cierre, datos }) {
  const { estudiante, total } = cierre;
  const resultado = resultadoConfirmado(datos, estudiante.id);
  const otros = (datos.evaluadoresTribunal ?? datos.evaluadores).filter((miembro) => miembro.id !== evaluador.id);
  const notasDeLaEtapa = datos.evaluaciones.filter((e) => e.idEtapaRubrica === etapa.id && e.idEstudiante === estudiante.id);

  return (
    <section className="resumen-cierre-estudiante" aria-label={estudiante.nombre}>
      <h3>{estudiante.nombre}</h3>
      <dl>
        <div><dt>Nota de {evaluador.nombre} · {etapa.nombre}</dt><dd>{notaConEscala(total, etapa.calificacionMaxima)}</dd></div>
        <div><dt>Resultado consolidado</dt><dd>{resultado
          ? notaConEscala(resultado.calificacion, resultado.calificacionMaxima)
          : 'Resultado consolidado pendiente'}</dd></div>
      </dl>
      {otros.length > 0 && <ul aria-label="Estado de los demás evaluadores">
        {otros.map((miembro) => {
          const notas = notasDeLaEtapa.filter((nota) => nota.idAsignacionTribunal === miembro.id);
          const estado = notas.some(({ estado }) => estado === 'CERRADA') ? 'Cerrada'
            : notas.some(({ estado }) => estado === 'BORRADOR') ? 'Calificando' : 'Sin evaluación';
          return <li key={miembro.id}>{miembro.nombre} · {estado}</li>;
        })}
      </ul>}
      <div className="resumen-cierre-documentos">
        <BotonDocumentoPdf ruta={rutaPdfRubrica(asignacionId, estudiante.id, evaluador.id)}>
          <FileText size={16} aria-hidden="true" /> Ver rúbrica PDF
        </BotonDocumentoPdf>
        {resultado && <Link className="button button-outline"
          to={`/documentos?${new URLSearchParams({ trabajoId: asignacionId, estudianteId: estudiante.id })}`}>
          Ver acta en Documentos
        </Link>}
      </div>
    </section>
  );
}

export function ResumenCierreEvaluacion({ asignacionId, datos, resumen, redDisponible, alCerrar, alSiguiente }) {
  const { cierres, fallos, etapa, evaluador } = resumen;
  const [actualizacion, setActualizacion] = useState(null);
  const datosActuales = actualizacion?.datos ?? datos;
  const todosCompletos = cierres.every(({ estudiante }) => resultadoConfirmado(datosActuales, estudiante.id));

  useEffect(() => {
    if (!redDisponible || todosCompletos) return undefined;
    const controlador = new AbortController();
    const { signal } = controlador;
    let temporizador;
    async function consultar() {
      try {
        const datos = await obtenerEvaluacionesMerDev(asignacionId, { signal });
        if (signal.aborted) return;
        setActualizacion({ datos, error: false });
      } catch {
        if (signal.aborted) return;
        setActualizacion((anterior) => ({ ...anterior, error: true }));
      }
      temporizador = window.setTimeout(consultar, INTERVALO_CONSULTA);
    }
    void consultar();
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [asignacionId, redDisponible, todosCompletos]);

  return <ModalFormularioCatalogo abierto titulo={cierres.length === 1 ? 'Evaluación cerrada' : 'Evaluaciones cerradas'}
    className="resumen-cierre-modal" etiquetaSeccion={null} alCerrar={alCerrar}
    acciones={<>
      <button type="button" className="button button-outline" onClick={alCerrar}>Volver</button>
      {alSiguiente ? <button type="button" className="button button-primary" onClick={alSiguiente}>
        Siguiente estudiante <ArrowRight size={16} aria-hidden="true" />
      </button> : <Link className="button button-primary" to="/mis-evaluaciones">Ir a Mis evaluaciones</Link>}
    </>}
  >
    {fallos.length > 0 && <p className="em-error" role="alert">Cierre pendiente de confirmar para {fallos.join(', ')}. Revisa el estado antes de reintentar.</p>}
    <div className="resumen-cierre-lista" aria-live="polite">
      {cierres.map((cierre) => <DetalleCierreOral key={cierre.estudiante.id}
        {...{ asignacionId, etapa, evaluador, cierre }} datos={datosActuales} />)}
    </div>
    {!todosCompletos && (!redDisponible || actualizacion?.error) && <p role="status">
      No se pudo actualizar el estado del tribunal. Se volverá a consultar cuando haya conexión.
    </p>}
  </ModalFormularioCatalogo>;
}
