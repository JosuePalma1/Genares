import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { canEditTribunal, fullName } from '../domain/workflow';
import { usePrototype } from '../state/PrototypeContext';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';

export default function TribunalAssignmentPage() {
  const { workId } = useParams();
  const { state, dispatch } = usePrototype();
  const navigate = useNavigate();
  const work = state.works.find((item) => item.id === workId);
  const [memberIds, setMemberIds] = useState(work?.tribunalIds?.length === 2 ? work.tribunalIds : ['', '']);
  const teachers = state.people.filter((person) => person.kind === 'TEACHER' && person.id !== work?.tutorId);
  const editable = work ? canEditTribunal(state, work) : false;
  const workload = useMemo(() => Object.fromEntries(teachers.map((teacher) => [teacher.id, state.works.filter((item) => item.tribunalIds.includes(teacher.id)).length])), [teachers, state.works]);
  if (!work) return <EmptyState title="Trabajo no encontrado" />;

  const selected = memberIds.map((id) => teachers.find((teacher) => teacher.id === id));
  const confirm = async () => {
    if (memberIds.some((id) => !id) || new Set(memberIds).size !== 2) {
      await Swal.fire({ icon: 'warning', title: 'Seleccione dos docentes distintos', text: 'El tribunal debe estar compuesto exactamente por dos miembros.' });
      return;
    }
    const answer = await Swal.fire({
      icon: 'question', title: '¿Confirmar asignación?',
      html: `Se notificará internamente a <strong>${selected.map(fullName).join('</strong> y <strong>')}</strong>.`,
      showCancelButton: true, confirmButtonText: 'Confirmar asignación', cancelButtonText: 'Volver y revisar', reverseButtons: true,
      confirmButtonColor: '#123f68',
    });
    if (!answer.isConfirmed) return;
    dispatch({ type: 'ASSIGN_TRIBUNAL', workId: work.id, memberIds });
    await Swal.fire({ icon: 'success', title: 'Tribunal asignado', text: 'Se generó una notificación interna para cada miembro.', timer: 1800, showConfirmButton: false });
    navigate(`/trabajos/${work.id}`);
  };

  return (
    <>
      <PageHeader title="Asignación de tribunal" description="Seleccione manualmente dos docentes; el sistema solo muestra información de apoyo." breadcrumbs={['Trabajos', work.code, 'Tribunal']} />
      {!editable && <div className="alert alert-warning"><span>!</span><div><strong>Asignación bloqueada</strong>Al menos un miembro ya cerró la revisión escrita. Se conserva la asignación para proteger la evaluación histórica.</div></div>}
      <section className="card"><div className="card-header"><h2>Trabajo seleccionado</h2><StatusBadge tone="info">{work.studentIds.length} estudiante(s)</StatusBadge></div><div className="card-body"><dl className="info-list"><div className="wide"><dt>Título</dt><dd>{work.title}</dd></div><div><dt>Carrera</dt><dd>{work.career}</dd></div><div><dt>Tutor</dt><dd>{fullName(state.people.find((person) => person.id === work.tutorId))}</dd></div></dl></div></section>
      <div className="grid-2">
        <section className="card"><div className="card-header"><h2>Miembros del tribunal</h2><span className="badge badge-neutral">2 requeridos</span></div><div className="card-body stack">
          {[0, 1].map((position) => <div className="field" key={position}><label htmlFor={`tribunal-${position}`}>Miembro {position + 1}</label><select id={`tribunal-${position}`} className="select" disabled={!editable} value={memberIds[position]} onChange={(event) => setMemberIds(memberIds.map((item, index) => index === position ? event.target.value : item))}><option value="">Seleccione un docente</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id} disabled={memberIds[1 - position] === teacher.id}>{fullName(teacher)} · {teacher.career} · {workload[teacher.id]} tribunal(es)</option>)}</select></div>)}
          <div className="alert alert-info mb-0"><span>ⓘ</span><div><strong>Selección no automatizada</strong>La carrera y la carga actual se muestran como apoyo. La decisión corresponde a Comisión Académica.</div></div>
        </div></section>
        <section className="card"><div className="card-header"><h2>Resumen</h2></div><div className="card-body activity-list">{selected.map((teacher, index) => teacher ? <div className="activity-item" key={teacher.id}><span className="avatar">{index + 1}</span><div className="activity-content"><strong>{fullName(teacher)}</strong><small>{teacher.career} · {workload[teacher.id]} asignación(es) actuales</small></div><StatusBadge tone="info">Seleccionado</StatusBadge></div> : <div className="activity-item" key={index}><span className="avatar">{index + 1}</span><div className="activity-content"><strong>Sin seleccionar</strong><small>Miembro {index + 1}</small></div></div>)}</div>
          <div className="card-footer form-actions compact-actions"><button className="button button-outline" type="button" onClick={() => navigate(`/trabajos/${work.id}`)}>Volver</button><button className="button button-primary" type="button" disabled={!editable} onClick={confirm}>Confirmar asignación</button></div>
        </section>
      </div>
    </>
  );
}

