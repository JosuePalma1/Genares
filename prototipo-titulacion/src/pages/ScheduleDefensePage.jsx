import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { areWrittenReviewsClosed, formatDate, fullName } from '../domain/workflow';
import { usePrototype } from '../state/PrototypeContext';
import { PageHeader, EmptyState, StatusBadge } from '../components/ui';

export default function ScheduleDefensePage() {
  const { workId } = useParams();
  const { state, dispatch } = usePrototype();
  const navigate = useNavigate();
  const work = state.works.find((item) => item.id === workId);
  const [schedule, setSchedule] = useState(work?.schedule ?? { date: new Date().toISOString().slice(0, 10), time: '10:00', room: '' });
  if (!work) return <EmptyState title="Trabajo no encontrado" />;
  const ready = areWrittenReviewsClosed(state, work);
  const members = work.tribunalIds.map((id) => state.people.find((person) => person.id === id)).filter(Boolean);
  const students = work.studentIds.map((id) => state.people.find((person) => person.id === id)).filter(Boolean);

  const submit = async (event) => {
    event.preventDefault();
    if (!schedule.date || !schedule.time || !schedule.room.trim()) {
      await Swal.fire({ icon: 'warning', title: 'Información incompleta', text: 'Ingrese fecha, hora y sala.' });
      return;
    }
    const answer = await Swal.fire({ icon: 'question', title: work.schedule ? '¿Actualizar programación?' : '¿Programar sustentación?', html: `<strong>${formatDate(schedule.date)} · ${schedule.time}</strong><br>${schedule.room}`, showCancelButton: true, confirmButtonText: 'Confirmar programación', cancelButtonText: 'Volver y revisar', reverseButtons: true, confirmButtonColor: '#123f68' });
    if (!answer.isConfirmed) return;
    dispatch({ type: 'SCHEDULE_DEFENSE', workId: work.id, schedule: { ...schedule, room: schedule.room.trim() } });
    await Swal.fire({ icon: 'success', title: 'Sustentación programada', text: 'Los miembros del tribunal recibieron una notificación interna.', timer: 2000, showConfirmButton: false });
    navigate(`/trabajos/${work.id}`);
  };

  return (
    <>
      <PageHeader title={work.schedule ? 'Programación de sustentación' : 'Programar sustentación'} description="Defina la fecha, hora y sala para el trabajo seleccionado." breadcrumbs={['Trabajos', work.code, 'Sustentación']} />
      {!ready ? <section className="card"><div className="empty-state"><div className="empty-icon">!</div><h2>Sustentación bloqueada</h2><p>Los dos miembros del tribunal deben cerrar su revisión escrita antes de continuar.</p><button className="button button-outline" type="button" onClick={() => navigate(`/trabajos/${work.id}`)}>Volver al trabajo</button></div></section> : (
        <form onSubmit={submit}>
          <section className="card"><div className="card-header"><h2>Participantes</h2><StatusBadge tone="success">Revisión escrita 2 de 2</StatusBadge></div><div className="card-body"><dl className="info-list"><div className="wide"><dt>Trabajo</dt><dd>{work.title}</dd></div><div><dt>Estudiante(s)</dt><dd>{students.map(fullName).join(' / ')}</dd></div><div><dt>Tribunal</dt><dd>{members.map(fullName).join(' / ')}</dd></div></dl></div></section>
          <section className="card"><div className="card-header"><h2>Fecha y lugar</h2><span className="badge badge-info">Notificación interna</span></div><div className="card-body form-grid"><div className="field"><label htmlFor="defense-date">Fecha</label><input id="defense-date" className="input" type="date" value={schedule.date} onChange={(event) => setSchedule({ ...schedule, date: event.target.value })} /></div><div className="field"><label htmlFor="defense-time">Hora</label><input id="defense-time" className="input" type="time" value={schedule.time} onChange={(event) => setSchedule({ ...schedule, time: event.target.value })} /></div><div className="field span-2"><label htmlFor="defense-room">Sala</label><input id="defense-room" className="input" placeholder="Ej. Sala 2" value={schedule.room} onChange={(event) => setSchedule({ ...schedule, room: event.target.value })} /></div></div></section>
          <div className="form-actions"><button className="button button-outline" type="button" onClick={() => navigate(`/trabajos/${work.id}`)}>Cancelar</button><button className="button button-primary" type="submit">{work.schedule ? 'Guardar programación' : 'Programar y notificar'}</button></div>
        </form>
      )}
    </>
  );
}

