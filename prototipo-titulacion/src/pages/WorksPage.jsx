import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ROLE } from '../data/prototypeData';
import { deriveWorkStatus, fullName, statusTone } from '../domain/workflow';
import { usePrototype } from '../state/PrototypeContext';
import { PageHeader, StatusBadge, EmptyState } from '../components/ui';

export default function WorksPage() {
  const { state, currentActor } = usePrototype();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [period, setPeriod] = useState('Todos');
  const canManage = currentActor.roles.some((role) => [ROLE.COMMISSION, ROLE.ADMIN].includes(role));

  const rows = useMemo(() => state.works.map((work) => ({
    ...work,
    processStatus: deriveWorkStatus(state, work),
    students: work.studentIds.map((id) => state.people.find((person) => person.id === id)).filter(Boolean),
    tutor: state.people.find((person) => person.id === work.tutorId),
  })).filter((work) => {
    const haystack = [work.code, work.title, work.career, ...work.students.map(fullName)].join(' ').toLocaleLowerCase('es');
    return haystack.includes(query.toLocaleLowerCase('es'))
      && (status === 'Todos' || work.processStatus === status)
      && (period === 'Todos' || work.period === period);
  }), [state, query, status, period]);

  const statusOptions = [...new Set(state.works.map((work) => deriveWorkStatus(state, work)))];
  const periodOptions = [...new Set(state.works.map((work) => work.period))];

  return (
    <>
      <PageHeader
        title="Trabajos de titulación"
        description="Registro y seguimiento del proceso de evaluación desde la designación del tribunal."
        breadcrumbs={['Inicio', 'Trabajos']}
        actions={canManage && <Link className="button button-primary" to="/trabajos/nuevo"><Plus size={18} /> Registrar trabajo</Link>}
      />
      <section className="card">
        <div className="card-header"><h2>Filtros</h2><span className="badge badge-info">{rows.length} trabajos</span></div>
        <div className="card-body">
          <div className="filters filters-compact">
            <div className="field"><label htmlFor="work-search">Buscar</label><input id="work-search" className="input" type="search" placeholder="Código, título o estudiante" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <div className="field"><label htmlFor="work-period">Período</label><select id="work-period" className="select" value={period} onChange={(event) => setPeriod(event.target.value)}><option>Todos</option>{periodOptions.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label htmlFor="work-status">Estado</label><select id="work-status" className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></div>
          </div>
        </div>
      </section>
      {rows.length === 0 ? <EmptyState title="No hay coincidencias" description="Ajuste los filtros de búsqueda." /> : (
        <section className="card">
          <div className="table-wrap">
            <table className="data-table responsive-table">
              <thead><tr><th>Trabajo</th><th>Estudiante(s)</th><th>Modalidad / período</th><th>Tutor</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>{rows.map((work) => (
                <tr key={work.id}>
                  <td data-label="Trabajo"><span className="cell-title">{work.code}</span><span className="cell-subtitle">{work.title}</span></td>
                  <td data-label="Estudiante(s)">{work.students.map((student) => <span className="cell-title compact" key={student.id}>{fullName(student)}</span>)}</td>
                  <td data-label="Modalidad / período">{work.modality}<span className="cell-subtitle">{work.period} · {work.career}</span></td>
                  <td data-label="Tutor">{fullName(work.tutor)}</td>
                  <td data-label="Estado"><StatusBadge tone={statusTone(work.processStatus)}>{work.processStatus}</StatusBadge></td>
                  <td data-label="Acción"><Link className="button button-sm button-outline" to={`/trabajos/${work.id}`}>Ver detalle</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

