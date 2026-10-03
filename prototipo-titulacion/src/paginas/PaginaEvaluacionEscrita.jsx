import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import { limitarCalificacion, nombreCompleto, obtenerDefinicionEtapa, obtenerIndicadoresEtapa, estaCompletaEtapa, maximoEtapa, calificacionEtapa } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { FormularioRubrica } from '../componentes/FormularioRubrica';

export default function PaginaEvaluacionEscrita() {
  const { idTrabajo } = useParams();
  const { estado, personaActual, despachar } = usarPrototipo();
  const navegar = useNavigate();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const evaluacion = estado.evaluaciones.find((elemento) => elemento.idTrabajo === idTrabajo && elemento.idMiembro === personaActual?.id);
  const [calificaciones, establecerCalificaciones] = useState(evaluacion?.escrita?.calificaciones ?? {});
  const [observaciones, establecerObservaciones] = useState(evaluacion?.escrita?.observaciones ?? {});
  useEffect(() => { establecerCalificaciones(evaluacion?.escrita?.calificaciones ?? {}); establecerObservaciones(evaluacion?.escrita?.observaciones ?? {}); }, [evaluacion?.id]);
  if (!trabajo || !evaluacion) return <EstadoVacio title="Evaluación no disponible" description="La identidad activa no forma parte del tribunal de este trabajo." />;

  const rubrica = evaluacion.instantaneaRubrica;
  const etapa = obtenerDefinicionEtapa(rubrica, 'ESCRITA');
  const maximo = maximoEtapa(rubrica, 'ESCRITA');
  const estudiantes = trabajo.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
  const tutor = estado.personas.find((persona) => persona.id === trabajo.idTutor);
  const cerrado = evaluacion.escrita.estado === ESTADO_EVALUACION.CERRADA;
  const indicadores = obtenerIndicadoresEtapa(rubrica, 'ESCRITA');
  const completa = estaCompletaEtapa(calificaciones, indicadores);
  const vistaPrevia = { ...evaluacion, escrita: { ...evaluacion.escrita, calificaciones } };

  const guardar = async () => {
    despachar({ tipo: 'GUARDAR_ESCRITA', idEvaluacion: evaluacion.id, calificaciones, observaciones });
    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Borrador guardado', showConfirmButton: false, timer: 1600 });
  };
  const finalizar = async () => {
    if (!completa) { await Swal.fire({ icon: 'warning', title: 'Complete todos los indicadores', text: 'Cada indicador debe tener una calificación, incluso si su valor es cero.' }); return; }
    const respuesta = await Swal.fire({ icon: 'warning', title: '¿Finalizar revisión escrita?', text: 'Revise cuidadosamente las calificaciones. Una vez confirmada, esta parte quedará cerrada y no podrá modificarse.', showCancelButton: true, confirmButtonText: 'Confirmar revisión', cancelButtonText: 'Volver y revisar', reverseButtons: true, confirmButtonColor: '#123f68' });
    if (!respuesta.isConfirmed) return;
    despachar({ tipo: 'FINALIZAR_ESCRITA', idEvaluacion: evaluacion.id, calificaciones, observaciones });
    await Swal.fire({ icon: 'success', title: 'Revisión escrita finalizada', text: 'La programación se habilitará cuando ambos miembros hayan finalizado.', confirmButtonText: 'Continuar' });
    navegar('/mis-evaluaciones');
  };

  return (
    <>
      <EncabezadoPagina title={`${String(etapa?.codigo ?? 'Etapa').replaceAll('_', ' ')} · ${etapa?.nombre ?? 'Revisión escrita'}`} description={`${etapa?.porcentaje ? `${etapa.porcentaje} % de la rúbrica · ` : ''}máximo ${maximo.toFixed(2)} puntos`} breadcrumbs={['Mis evaluaciones', trabajo.codigo, etapa?.nombreCorto ?? 'Revisión escrita']} meta={<InsigniaEstado tono={cerrado ? 'success' : 'progress'}>{cerrado ? 'Evaluación finalizada' : evaluacion.escrita.estado === ESTADO_EVALUACION.BORRADOR ? 'Borrador' : 'Pendiente'}</InsigniaEstado>} />
      <section className="card"><div className="card-body"><dl className="info-list"><div className="wide"><dt>Título del trabajo</dt><dd>{trabajo.titulo}</dd></div><div><dt>Estudiante(s)</dt><dd>{estudiantes.map(nombreCompleto).join(' / ')}</dd></div><div><dt>Tutor</dt><dd>{nombreCompleto(tutor)}</dd></div><div><dt>Miembro del tribunal</dt><dd>{nombreCompleto(personaActual)}</dd></div><div><dt>Rúbrica</dt><dd>{rubrica.version} · {rubrica.periodo}</dd></div></dl></div></section>
      <div className="alert alert-info"><span>ⓘ</span><div><strong>Calificación compartida por los autores</strong>La etapa “{etapa?.nombre ?? 'Revisión escrita'}” evalúa el trabajo. Su resultado se reutiliza para cada estudiante del mismo trabajo.</div></div>
      <div className="evaluacion-board">
        <div>
          <FormularioRubrica rubrica={rubrica} etapa="ESCRITA" calificaciones={calificaciones} observaciones={observaciones} readOnly={cerrado} alCambiarCalificacion={(id, value, max) => establecerCalificaciones({ ...calificaciones, [id]: limitarCalificacion(value, max) })} alCambiarObservacion={(id, value) => establecerObservaciones({ ...observaciones, [id]: value })} />
          {!cerrado && (
            <>
              <div className="alert alert-warning">
                <span>!</span>
                <div>
                  <strong>Guardar no finaliza la revisión</strong>
                  Puede volver más tarde mientras permanezca como borrador. Una vez finalizada, quedará cerrada y no podrá modificarse.
                </div>
              </div>
              <div className="form-actions evaluacion-actions-bar">
                <button className="button button-outline button-lg" type="button" onClick={guardar}>
                  Guardar borrador
                </button>
                <button className="button button-primary button-lg" type="button" onClick={finalizar}>
                  Finalizar revisión escrita
                </button>
              </div>
            </>
          )}
          {cerrado && (
            <div className="form-actions evaluacion-actions-bar">
              <button className="button button-outline button-lg" type="button" onClick={() => navegar('/mis-evaluaciones')}>
                Volver a mis evaluaciones
              </button>
            </div>
          )}
        </div>
        <aside className="evaluacion-summary"><div className="summary-calificacion"><small>Total {etapa?.nombreCorto ?? 'de la etapa'}</small><strong>{calificacionEtapa(vistaPrevia, 'ESCRITA').toFixed(2)}</strong><span>de {maximo.toFixed(2)} puntos</span></div><div className="card mt-4"><div className="card-body"><div className="calificacion-row"><span>Indicadores completos</span><strong>{indicadores.filter((elemento) => calificaciones[elemento.id] !== undefined && calificaciones[elemento.id] !== '').length} / {indicadores.length}</strong></div><div className="calificacion-row"><span>Estado</span><strong>{cerrado ? 'Cerrada' : 'Editable'}</strong></div></div></div></aside>
      </div>
    </>
  );
}
