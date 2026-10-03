import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ROL } from '../datos/datosPrototipo';
import { derivarEstadoTrabajo, nombreCompleto, tonoEstado } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';

export default function PaginaTrabajos() {
  const { estado, actorActual } = usarPrototipo();
  const [consulta, establecerConsulta] = useState('');
  const [filtroEstado, establecerFiltroEstado] = useState('Todos');
  const [periodo, establecerPeriodo] = useState('Todos');
  const puedeGestionar = actorActual.roles.some((role) => [ROL.COMISION, ROL.ADMIN].includes(role));

  const filas = useMemo(() => estado.trabajos.map((trabajo) => ({
    ...trabajo,
    estadoProceso: derivarEstadoTrabajo(estado, trabajo),
    estudiantes: trabajo.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean),
    tutor: estado.personas.find((persona) => persona.id === trabajo.idTutor),
  })).filter((trabajo) => {
    const textoBusqueda = [trabajo.codigo, trabajo.titulo, trabajo.carrera, ...trabajo.estudiantes.map(nombreCompleto)].join(' ').toLocaleLowerCase('es');
    return textoBusqueda.includes(consulta.toLocaleLowerCase('es'))
      && (filtroEstado === 'Todos' || trabajo.estadoProceso === filtroEstado)
      && (periodo === 'Todos' || trabajo.periodo === periodo);
  }), [estado, consulta, filtroEstado, periodo]);

  const opcionesEstado = [...new Set(estado.trabajos.map((trabajo) => derivarEstadoTrabajo(estado, trabajo)))];
  const opcionesPeriodo = [...new Set(estado.trabajos.map((trabajo) => trabajo.periodo))];

  return (
    <>
      <EncabezadoPagina
        title="Trabajos de titulación"
        description="Registro y seguimiento del proceso de evaluación desde la designación del tribunal."
        breadcrumbs={['Inicio', 'Trabajos']}
        actions={puedeGestionar && <Link className="button button-primary" to="/trabajos/nuevo"><Plus size={18} /> Registrar trabajo</Link>}
      />
      <section className="card">
        <div className="card-header"><h2>Filtros</h2><span className="badge badge-info">{filas.length} trabajos</span></div>
        <div className="card-body">
          <div className="filters filters-compact">
            <div className="field"><label htmlFor="trabajo-search">Buscar</label><input id="trabajo-search" className="input" type="search" placeholder="Código, título o estudiante" value={consulta} onChange={(evento) => establecerConsulta(evento.target.value)} /></div>
            <div className="field"><label htmlFor="trabajo-periodo">Período</label><select id="trabajo-periodo" className="select" value={periodo} onChange={(evento) => establecerPeriodo(evento.target.value)}><option>Todos</option>{opcionesPeriodo.map((elemento) => <option key={elemento}>{elemento}</option>)}</select></div>
            <div className="field"><label htmlFor="trabajo-estado">Estado</label><select id="trabajo-estado" className="select" value={filtroEstado} onChange={(evento) => establecerFiltroEstado(evento.target.value)}><option>Todos</option>{opcionesEstado.map((elemento) => <option key={elemento}>{elemento}</option>)}</select></div>
          </div>
        </div>
      </section>
      {filas.length === 0 ? <EstadoVacio title="No hay coincidencias" description="Ajuste los filtros de búsqueda." /> : (
        <section className="card">
          <div className="table-wrap">
            <table className="data-table responsive-table">
              <thead><tr><th>Trabajo</th><th>Estudiante(s)</th><th>Modalidad / período</th><th>Tutor</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>{filas.map((trabajo) => (
                <tr key={trabajo.id}>
                  <td data-label="Trabajo"><span className="cell-title">{trabajo.codigo}</span><span className="cell-subtitle">{trabajo.titulo}</span></td>
                  <td data-label="Estudiante(s)">{trabajo.estudiantes.map((estudiante) => <span className="cell-title compact" key={estudiante.id}>{nombreCompleto(estudiante)}</span>)}</td>
                  <td data-label="Modalidad / período">{trabajo.modalidad}<span className="cell-subtitle">{trabajo.periodo} · {trabajo.carrera}</span></td>
                  <td data-label="Tutor">{nombreCompleto(trabajo.tutor)}</td>
                  <td data-label="Estado"><InsigniaEstado tono={tonoEstado(trabajo.estadoProceso)}>{trabajo.estadoProceso}</InsigniaEstado></td>
                  <td data-label="Acción"><Link className="button button-sm button-outline" to={`/trabajos/${trabajo.id}`}>Ver detalle</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
