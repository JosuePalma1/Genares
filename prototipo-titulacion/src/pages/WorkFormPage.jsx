import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Plus, Trash2 } from 'lucide-react';
import { ROLE } from '../data/prototypeData';
import { usePrototype } from '../state/PrototypeContext';
import { PageHeader } from '../components/ui';

const emptyStudent = () => ({ cedula: '', firstNames: '', lastNames: '', career: 'Tecnologías de la Información' });

export default function WorkFormPage() {
  const { state, currentActor, dispatch } = usePrototype();
  const navigate = useNavigate();
  const canManage = currentActor.roles.some((role) => [ROLE.COMMISSION, ROLE.ADMIN].includes(role));
  const teachers = state.people.filter((person) => person.kind === 'TEACHER');
  const [form, setForm] = useState({ title: '', modality: 'Proyecto integrador', period: '2026-2', career: 'Tecnologías de la Información', tutorId: '' });
  const [students, setStudents] = useState([emptyStudent()]);

  if (!canManage) return <div className="alert alert-warning"><span>!</span><div><strong>Acción no disponible</strong>Solo Comisión Académica o Administración puede registrar trabajos.</div></div>;

  const changeStudent = (index, field, value) => setStudents((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const submit = async (event) => {
    event.preventDefault();
    const completeStudents = students.every((student) => student.cedula.trim() && student.firstNames.trim() && student.lastNames.trim());
    if (!form.title.trim() || !form.tutorId || !completeStudents) {
      await Swal.fire({ icon: 'warning', title: 'Información incompleta', text: 'Complete el título, tutor y los datos de cada estudiante.' });
      return;
    }
    const duplicateIds = new Set(students.map((student) => student.cedula.trim()));
    if (duplicateIds.size !== students.length) {
      await Swal.fire({ icon: 'warning', title: 'Estudiantes duplicados', text: 'Cada estudiante debe tener una cédula diferente.' });
      return;
    }
    const suffix = Date.now().toString(36);
    const createdStudents = students.map((student, index) => ({ ...student, id: `student-${suffix}-${index + 1}`, kind: 'STUDENT', cedula: student.cedula.trim(), firstNames: student.firstNames.trim(), lastNames: student.lastNames.trim() }));
    const rubric = state.rubricVersions.find((item) => item.status === 'ACTIVE' && item.modality === form.modality && item.period === form.period);
    if (!rubric) {
      await Swal.fire({ icon: 'error', title: 'No existe una rúbrica vigente', text: 'Active una versión para esta modalidad y período antes de registrar el trabajo.' });
      return;
    }
    const id = `work-${suffix}`;
    const work = {
      id,
      code: `TT-${form.period.slice(0, 4)}-${String(state.works.length + 1).padStart(4, '0')}`,
      title: form.title.trim(), modality: form.modality, period: form.period, career: form.career,
      studentIds: createdStudents.map((student) => student.id), tutorId: form.tutorId, tribunalIds: [],
      rubricVersionId: rubric.id, registeredAt: new Date().toISOString(), schedule: null,
    };
    dispatch({ type: 'REGISTER_WORK', work, students: createdStudents });
    await Swal.fire({ icon: 'success', title: 'Trabajo registrado', text: 'Ahora puede asignar los dos miembros del tribunal.', confirmButtonText: 'Continuar' });
    navigate(`/trabajos/${id}`);
  };

  return (
    <>
      <PageHeader title="Registrar trabajo de titulación" description="La información del trabajo se registra en este sistema; no proviene de una API institucional." breadcrumbs={['Trabajos', 'Nuevo trabajo']} />
      <form onSubmit={submit}>
        <section className="card">
          <div className="card-header"><h2>Datos del trabajo</h2><span className="badge badge-neutral">Estado inicial: Registrado</span></div>
          <div className="card-body form-grid">
            <div className="field span-2"><label htmlFor="work-title">Título del trabajo</label><textarea id="work-title" className="textarea" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
            <div className="field"><label htmlFor="work-mode">Modalidad</label><select id="work-mode" className="select" value={form.modality} onChange={(event) => setForm({ ...form, modality: event.target.value })}><option>Proyecto integrador</option></select></div>
            <div className="field"><label htmlFor="work-period-form">Período académico</label><select id="work-period-form" className="select" value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })}><option>2026-2</option><option>2026-1</option></select></div>
            <div className="field"><label htmlFor="work-career-form">Carrera</label><select id="work-career-form" className="select" value={form.career} onChange={(event) => setForm({ ...form, career: event.target.value })}><option>Tecnologías de la Información</option><option>Software</option><option>Agropecuaria</option><option>Ingeniería Ambiental</option></select></div>
            <div className="field"><label htmlFor="work-tutor">Tutor</label><select id="work-tutor" className="select" value={form.tutorId} onChange={(event) => setForm({ ...form, tutorId: event.target.value })}><option value="">Seleccione un docente</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstNames} {teacher.lastNames} · {teacher.career}</option>)}</select><small>El tutor es un docente; no se crea un tipo de persona separado.</small></div>
          </div>
        </section>
        <section className="card">
          <div className="card-header"><div><h2>Estudiantes / autores</h2><p className="text-muted mb-0">El trabajo debe tener uno o más estudiantes.</p></div><button className="button button-sm button-outline" type="button" onClick={() => setStudents([...students, emptyStudent()])}><Plus size={17} /> Agregar estudiante</button></div>
          <div className="card-body stack">
            {students.map((student, index) => (
              <fieldset className="student-fieldset" key={index}>
                <legend>Estudiante {index + 1}</legend>
                <div className="student-fields">
                  <div className="field"><label htmlFor={`student-id-${index}`}>Cédula</label><input id={`student-id-${index}`} className="input" value={student.cedula} onChange={(event) => changeStudent(index, 'cedula', event.target.value)} /></div>
                  <div className="field"><label htmlFor={`student-names-${index}`}>Nombres</label><input id={`student-names-${index}`} className="input" value={student.firstNames} onChange={(event) => changeStudent(index, 'firstNames', event.target.value)} /></div>
                  <div className="field"><label htmlFor={`student-lastnames-${index}`}>Apellidos</label><input id={`student-lastnames-${index}`} className="input" value={student.lastNames} onChange={(event) => changeStudent(index, 'lastNames', event.target.value)} /></div>
                  {students.length > 1 && <button className="button button-danger icon-button" type="button" aria-label={`Eliminar estudiante ${index + 1}`} onClick={() => setStudents(students.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={18} /></button>}
                </div>
              </fieldset>
            ))}
          </div>
        </section>
        <div className="form-actions"><button className="button button-outline" type="button" onClick={() => navigate('/trabajos')}>Cancelar</button><button className="button button-primary" type="submit">Registrar trabajo</button></div>
      </form>
    </>
  );
}

