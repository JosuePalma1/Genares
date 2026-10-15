import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BookOpenCheck,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  Save,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import { limitarCalificacion, nombreCompleto, obtenerDefinicionEtapa, obtenerIndicadoresEtapa, estaCompletaEtapa, maximoEtapa, calificacionEtapa } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { BotonVolver, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { FormularioRubrica } from '../componentes/FormularioRubrica';
import { usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';

export default function PaginaEvaluacionEscrita() {
  const { idTrabajo } = useParams();
  const { estado, personaActual, despachar } = usarPrototipo();
  const navegar = useNavigate();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const evaluacion = estado.evaluaciones.find((elemento) => elemento.idTrabajo === idTrabajo && elemento.idMiembro === personaActual?.id);
  const [calificaciones, establecerCalificaciones] = useState(evaluacion?.escrita?.calificaciones ?? {});
  const [observaciones, establecerObservaciones] = useState(evaluacion?.escrita?.observaciones ?? {});
  const [tieneCambios, establecerTieneCambios] = useState(false);
  const [mostrarErrores, establecerMostrarErrores] = useState(false);
  usarAdvertenciaCambiosSinGuardar(tieneCambios, () => establecerTieneCambios(false));

  useEffect(() => {
    establecerCalificaciones(evaluacion?.escrita?.calificaciones ?? {});
    establecerObservaciones(evaluacion?.escrita?.observaciones ?? {});
    establecerTieneCambios(false);
    establecerMostrarErrores(false);
  }, [evaluacion?.id]);

  if (!trabajo || !evaluacion) return <EstadoVacio title="Evaluación no disponible" description="La identidad activa no forma parte del tribunal de este trabajo." />;

  const rubrica = evaluacion.instantaneaRubrica;
  const etapa = obtenerDefinicionEtapa(rubrica, 'ESCRITA');
  const maximo = maximoEtapa(rubrica, 'ESCRITA');
  const estudiantes = trabajo.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
  const tutor = estado.personas.find((persona) => persona.id === trabajo.idTutor);
  const cerrado = evaluacion.escrita.estado === ESTADO_EVALUACION.CERRADA;
  const indicadores = obtenerIndicadoresEtapa(rubrica, 'ESCRITA');
  const indicadoresCompletos = indicadores.filter((elemento) => calificaciones[elemento.id] !== undefined && calificaciones[elemento.id] !== '').length;
  const completa = estaCompletaEtapa(calificaciones, indicadores);
  const progreso = indicadores.length ? Math.round((indicadoresCompletos / indicadores.length) * 100) : 0;
  const vistaPrevia = { ...evaluacion, escrita: { ...evaluacion.escrita, calificaciones } };
  const estadoEvaluacion = cerrado
    ? 'Evaluación finalizada'
    : evaluacion.escrita.estado === ESTADO_EVALUACION.BORRADOR ? 'Borrador' : 'Pendiente';

  const guardar = async () => {
    despachar({ tipo: 'GUARDAR_ESCRITA', idEvaluacion: evaluacion.id, calificaciones, observaciones });
    establecerTieneCambios(false);
    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Borrador guardado', showConfirmButton: false, timer: 1600 });
  };

  const finalizar = async () => {
    if (!completa) {
      establecerMostrarErrores(true);
      await Swal.fire({ icon: 'warning', title: 'Complete todos los indicadores', text: 'Cada indicador debe tener una calificación, incluso si su valor es cero.' });
      return;
    }
    const respuesta = await Swal.fire({ icon: 'warning', title: '¿Finalizar revisión escrita?', text: 'Revise cuidadosamente las calificaciones. Una vez confirmada, esta parte quedará cerrada y no podrá modificarse.', showCancelButton: true, confirmButtonText: 'Confirmar revisión', cancelButtonText: 'Volver y revisar', reverseButtons: true });
    if (!respuesta.isConfirmed) return;
    establecerTieneCambios(false);
    despachar({ tipo: 'FINALIZAR_ESCRITA', idEvaluacion: evaluacion.id, calificaciones, observaciones });
    await Swal.fire({ icon: 'success', title: 'Revisión escrita finalizada', text: 'La programación se habilitará cuando ambos miembros hayan finalizado.', confirmButtonText: 'Continuar' });
    navegar('/mis-evaluaciones');
  };

  return (
    <div className={`evaluacion-escrita-page ${cerrado ? 'is-closed' : 'is-editable'}`}>
      <EncabezadoPagina
        title="Evaluación escrita"
        description={`${trabajo.codigo} · ${etapa?.nombre ?? 'Revisión del proyecto escrito'}`}
        breadcrumbs={['Mis evaluaciones', trabajo.codigo, etapa?.nombreCorto ?? 'Revisión escrita']}
        meta={<InsigniaEstado tono={cerrado ? 'success' : evaluacion.escrita.estado === ESTADO_EVALUACION.BORRADOR ? 'progress' : 'pending'}>{estadoEvaluacion}</InsigniaEstado>}
      />

      <section className="evaluacion-escrita-context" aria-labelledby="evaluacion-trabajo-title">
        <div className="evaluacion-context-heading">
          <div>
            <span className="section-kicker">{trabajo.modalidad}</span>
            <h2 id="evaluacion-trabajo-title">{trabajo.titulo}</h2>
          </div>
          <div className="evaluacion-context-score">
            <span>{etapa?.porcentaje ? `${etapa.porcentaje} % de la rúbrica` : 'Etapa escrita'}</span>
            <strong>Máximo {maximo.toFixed(2)} puntos</strong>
          </div>
        </div>

        <dl className="evaluacion-context-grid">
          <div>
            <dt><UsersRound size={16} /> Estudiante{estudiantes.length === 1 ? '' : 's'}</dt>
            <dd>{estudiantes.map(nombreCompleto).join(' / ')}</dd>
          </div>
          <div>
            <dt><UserRound size={16} /> Evaluador</dt>
            <dd>{nombreCompleto(personaActual)}</dd>
          </div>
          <div>
            <dt><GraduationCap size={16} /> Modalidad</dt>
            <dd>{trabajo.modalidad}</dd>
          </div>
          <div>
            <dt><UserRound size={16} /> Tutor</dt>
            <dd>{nombreCompleto(tutor)}</dd>
          </div>
          <div>
            <dt><BookOpenCheck size={16} /> Rúbrica asignada</dt>
            <dd>{rubrica.version} · {rubrica.periodo}</dd>
          </div>
        </dl>
      </section>

      <div className="evaluacion-scope-note" role="note">
        <FileCheck2 size={20} aria-hidden="true" />
        <div>
          <strong>Calificación compartida por los autores</strong>
          <span>La etapa “{etapa?.nombre ?? 'Revisión escrita'}” evalúa el trabajo. Su resultado se reutiliza para cada estudiante del mismo trabajo.</span>
        </div>
      </div>

      <div className="evaluacion-action-panel">
        <div className="evaluacion-save-state" aria-live="polite">
          {cerrado ? (
            <><CheckCircle2 size={18} /> Esta evaluación está cerrada y disponible en modo consulta.</>
          ) : tieneCambios ? (
            <><span className="save-state-dot" aria-hidden="true" /> Cambios sin guardar</>
          ) : (
            <><CheckCircle2 size={18} /> Sin cambios pendientes</>
          )}
        </div>
        <div className="form-actions evaluacion-actions-bar">
          <BotonVolver className="button-lg" respaldo="/mis-evaluaciones" />
          {!cerrado && (
            <>
              <button className="button button-secondary button-lg" type="button" onClick={guardar}>
                <Save size={18} /> Guardar borrador
              </button>
              <button className="button button-primary button-lg" type="button" onClick={finalizar}>
                <FileCheck2 size={18} /> Finalizar revisión escrita
              </button>
            </>
          )}
        </div>
      </div>

      <div className="evaluacion-board evaluacion-escrita-board">
        <div className="evaluacion-escrita-main">
          <FormularioRubrica
            rubrica={rubrica}
            etapa="ESCRITA"
            calificaciones={calificaciones}
            observaciones={observaciones}
            readOnly={cerrado}
            showCompletionState
            highlightIncomplete={mostrarErrores}
            className="rubrica-escrita-form"
            alCambiarCalificacion={(id, value, max) => {
              establecerTieneCambios(true);
              establecerCalificaciones({ ...calificaciones, [id]: limitarCalificacion(value, max) });
            }}
            alCambiarObservacion={(id, value) => {
              establecerTieneCambios(true);
              establecerObservaciones({ ...observaciones, [id]: value });
            }}
          />

          {!cerrado && (
            <div className="evaluacion-closing-note" role="note">
              <span aria-hidden="true">!</span>
              <div>
                <strong>Guardar no finaliza la revisión</strong>
                <p>Puede volver más tarde mientras permanezca como borrador. Una vez finalizada, quedará cerrada y no podrá modificarse.</p>
              </div>
            </div>
          )}

        </div>

        <aside className="evaluacion-summary evaluacion-progress-panel" aria-label="Progreso y puntuación de la revisión">
          <div className="summary-calificacion">
            <small>Total {etapa?.nombreCorto ?? 'de la etapa'}</small>
            <strong aria-live="polite">{calificacionEtapa(vistaPrevia, 'ESCRITA').toFixed(2)}</strong>
            <span>de {maximo.toFixed(2)} puntos</span>
          </div>
          <div className="evaluacion-progress-card">
            <div className="evaluacion-progress-heading">
              <span>Avance real</span>
              <strong>{progreso} %</strong>
            </div>
            <progress value={indicadoresCompletos} max={indicadores.length} aria-label={`${indicadoresCompletos} de ${indicadores.length} indicadores completos`} />
            <div className="calificacion-row">
              <span>Indicadores completos</span>
              <strong>{indicadoresCompletos} / {indicadores.length}</strong>
            </div>
            <div className="calificacion-row">
              <span>Estado</span>
              <strong>{estadoEvaluacion}</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
