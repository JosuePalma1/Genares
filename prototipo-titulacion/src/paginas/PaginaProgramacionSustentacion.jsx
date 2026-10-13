import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  ArrowLeft,
  BellRing,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  MapPin,
  Save,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { estanCerradasRevisionesEscritas, fechaLocalISO, formatearFecha, nombreCompleto } from '../dominio/flujoTrabajo';
import { confirmarDescarteCambios, usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';

export default function PaginaProgramacionSustentacion() {
  const { idTrabajo } = useParams();
  const { estado, despachar } = usarPrototipo();
  const navegar = useNavigate();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const programacionInicial = useMemo(
    () => trabajo?.programacion ?? { fecha: fechaLocalISO(), hora: '10:00', sala: '' },
    [trabajo?.id],
  );
  const [programacion, establecerProgramacion] = useState(programacionInicial);
  const [tieneCambios, establecerTieneCambios] = useState(false);
  const [mostrarErrores, establecerMostrarErrores] = useState(false);
  usarAdvertenciaCambiosSinGuardar(tieneCambios, () => {
    establecerProgramacion(programacionInicial);
    establecerTieneCambios(false);
  });

  if (!trabajo) return <EstadoVacio title="Trabajo no encontrado" />;
  const estaLista = estanCerradasRevisionesEscritas(estado, trabajo);
  const miembros = trabajo.idsTribunal.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
  const estudiantes = trabajo.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
  const tutor = estado.personas.find((persona) => persona.id === trabajo.idTutor);
  const camposIncompletos = !programacion.fecha || !programacion.hora || !programacion.sala.trim();

  const actualizarCampo = (campo, valor) => {
    establecerProgramacion((actual) => ({ ...actual, [campo]: valor }));
    establecerTieneCambios(true);
  };

  const cancelar = () => {
    if (!confirmarDescarteCambios()) return;
    navegar(`/trabajos/${trabajo.id}`);
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    establecerMostrarErrores(true);
    if (camposIncompletos) {
      await Swal.fire({ icon: 'warning', title: 'Información incompleta', text: 'Ingrese fecha, hora y sala.' });
      return;
    }
    const respuesta = await Swal.fire({
      icon: 'question',
      title: trabajo.programacion ? '¿Actualizar programación?' : '¿Programar sustentación?',
      text: `${formatearFecha(programacion.fecha)} · ${programacion.hora} · ${programacion.sala}`,
      showCancelButton: true,
      confirmButtonText: 'Confirmar programación',
      cancelButtonText: 'Volver y revisar',
      reverseButtons: true,
      confirmButtonColor: '#123f68',
    });
    if (!respuesta.isConfirmed) return;
    establecerTieneCambios(false);
    despachar({ tipo: 'PROGRAMAR_SUSTENTACION', idTrabajo: trabajo.id, programacion: { ...programacion, sala: programacion.sala.trim() } });
    await Swal.fire({ icon: 'success', title: 'Sustentación programada', text: 'Los miembros del tribunal recibieron una notificación interna.', timer: 2000, showConfirmButton: false });
    navegar(`/trabajos/${trabajo.id}`);
  };

  return (
    <div className="programacion-sustentacion-page">
      <EncabezadoPagina
        eyebrow="Agenda de sustentación"
        title={trabajo.programacion ? 'Programación de sustentación' : 'Programar sustentación'}
        description={`${trabajo.codigo} · ${trabajo.titulo}`}
        breadcrumbs={[{ etiqueta: 'Trabajos', to: '/trabajos' }, { etiqueta: trabajo.codigo, to: `/trabajos/${trabajo.id}` }, { etiqueta: 'Sustentación' }]}
        meta={<InsigniaEstado tono={trabajo.programacion ? 'progress' : 'pending'}>{trabajo.programacion ? 'Programada' : 'Sin programación'}</InsigniaEstado>}
      />

      {!estaLista ? (
        <section className="sustentacion-blocked-card">
          <span className="sustentacion-blocked-icon" aria-hidden="true"><Clock3 size={27} /></span>
          <div>
            <span className="section-kicker">Programación no habilitada</span>
            <h2>Sustentación bloqueada</h2>
            <p>Los dos miembros del tribunal deben cerrar su revisión escrita antes de continuar.</p>
          </div>
          <button className="button button-outline" type="button" onClick={() => navegar(`/trabajos/${trabajo.id}`)}><ArrowLeft size={17} /> Volver al trabajo</button>
        </section>
      ) : (
        <form onSubmit={enviar} noValidate>
          <section className="sustentacion-context" aria-labelledby="sustentacion-trabajo-title">
            <header className="sustentacion-context-heading">
              <div>
                <span className="section-kicker">Trabajo habilitado</span>
                <h2 id="sustentacion-trabajo-title">{trabajo.titulo}</h2>
                <p>{trabajo.codigo} · {trabajo.carrera}</p>
              </div>
              <InsigniaEstado tono="success">Revisión escrita 2 de 2</InsigniaEstado>
            </header>
            <dl className="sustentacion-context-grid">
              <div><dt><GraduationCap size={16} /> Modalidad</dt><dd>{trabajo.modalidad}</dd></div>
              <div><dt><UsersRound size={16} /> Estudiante{estudiantes.length === 1 ? '' : 's'}</dt><dd>{estudiantes.map(nombreCompleto).join(' / ')}</dd></div>
              <div><dt><UserRound size={16} /> Tutor</dt><dd>{nombreCompleto(tutor)}</dd></div>
              <div><dt><CalendarDays size={16} /> Período</dt><dd>{trabajo.periodo}</dd></div>
            </dl>
          </section>

          <section className="sustentacion-tribunal" aria-labelledby="sustentacion-tribunal-title">
            <header>
              <div><span className="section-kicker">Participantes institucionales</span><h2 id="sustentacion-tribunal-title">Tribunal evaluador</h2></div>
              <span className="sustentacion-tribunal-count">{miembros.length} de 2 miembros</span>
            </header>
            <div className="sustentacion-tribunal-grid">
              {miembros.map((miembro, indice) => (
                <article key={miembro.id}>
                  <span className="sustentacion-member-index" aria-hidden="true">{String(indice + 1).padStart(2, '0')}</span>
                  <div><small>Miembro {indice + 1}</small><strong>{nombreCompleto(miembro)}</strong><span>{miembro.carrera}</span></div>
                  <CheckCircle2 size={19} aria-label="Revisión escrita cerrada" />
                </article>
              ))}
            </div>
          </section>

          <section className="sustentacion-schedule" aria-labelledby="sustentacion-schedule-title">
            <header>
              <div>
                <span className="section-kicker">Fecha, hora y lugar</span>
                <h2 id="sustentacion-schedule-title">{trabajo.programacion ? 'Actualizar agenda' : 'Definir agenda'}</h2>
                <p>Estos datos se mostrarán al tribunal y habilitarán la evaluación oral desde el día registrado.</p>
              </div>
              <span className="sustentacion-notification-chip"><BellRing size={16} /> Notificación interna</span>
            </header>

            {mostrarErrores && camposIncompletos ? (
              <div className="sustentacion-validation-summary" role="alert">
                <strong>Complete la información requerida</strong>
                <span>Ingrese una fecha, una hora y el lugar de la sustentación.</span>
              </div>
            ) : null}

            <div className="sustentacion-fields">
              <div className={`field sustentacion-field ${mostrarErrores && !programacion.fecha ? 'has-error' : ''}`}>
                <label htmlFor="sustentacion-date"><CalendarDays size={17} /> Fecha</label>
                <input id="sustentacion-date" className="input" type="date" value={programacion.fecha} aria-invalid={mostrarErrores && !programacion.fecha ? 'true' : undefined} aria-describedby="sustentacion-date-help" onChange={(evento) => actualizarCampo('fecha', evento.target.value)} />
                <small id="sustentacion-date-help">Día habilitado para realizar la evaluación oral.</small>
              </div>
              <div className={`field sustentacion-field ${mostrarErrores && !programacion.hora ? 'has-error' : ''}`}>
                <label htmlFor="sustentacion-time"><Clock3 size={17} /> Hora</label>
                <input id="sustentacion-time" className="input" type="time" value={programacion.hora} aria-invalid={mostrarErrores && !programacion.hora ? 'true' : undefined} aria-describedby="sustentacion-time-help" onChange={(evento) => actualizarCampo('hora', evento.target.value)} />
                <small id="sustentacion-time-help">Hora informativa de la agenda institucional.</small>
              </div>
              <div className={`field sustentacion-field ${mostrarErrores && !programacion.sala.trim() ? 'has-error' : ''}`}>
                <label htmlFor="sustentacion-room"><MapPin size={17} /> Lugar</label>
                <input id="sustentacion-room" className="input" placeholder="Ej. Sala 2" value={programacion.sala} aria-invalid={mostrarErrores && !programacion.sala.trim() ? 'true' : undefined} aria-describedby="sustentacion-room-help" onChange={(evento) => actualizarCampo('sala', evento.target.value)} />
                <small id="sustentacion-room-help">Utilice la denominación institucional disponible.</small>
              </div>
            </div>

            <aside className="sustentacion-schedule-preview" aria-label="Resumen de programación">
              <div><CalendarCheck2 size={20} /><span>Fecha</span><strong>{programacion.fecha ? formatearFecha(programacion.fecha) : 'Pendiente'}</strong></div>
              <div><Clock3 size={20} /><span>Hora</span><strong>{programacion.hora || 'Pendiente'}</strong></div>
              <div><MapPin size={20} /><span>Lugar</span><strong>{programacion.sala.trim() || 'Pendiente'}</strong></div>
            </aside>
          </section>

          <div className="sustentacion-form-actions">
            <div className={`sustentacion-save-state ${tieneCambios ? 'has-changes' : 'is-saved'}`} aria-live="polite">
              {tieneCambios ? <Clock3 size={18} /> : <CheckCircle2 size={18} />}
              <span><strong>{tieneCambios ? 'Cambios sin guardar' : trabajo.programacion ? 'Programación registrada' : 'Sin cambios pendientes'}</strong><small>{tieneCambios ? 'Confirme la programación para conservarlos.' : 'La agenda no tiene modificaciones locales.'}</small></span>
            </div>
            <div>
              <button className="button button-outline" type="button" onClick={cancelar}><ArrowLeft size={17} /> Cancelar</button>
              <button className="button button-primary" type="submit"><Save size={17} /> {trabajo.programacion ? 'Guardar programación' : 'Programar y notificar'}</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
