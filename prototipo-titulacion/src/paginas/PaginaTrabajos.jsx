import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  GraduationCap,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { ROL } from '../datos/datosPrototipo';
import { derivarEstadoTrabajo, nombreCompleto, tonoEstado } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';

const ETAPAS_PROCESO = [
  'Registrado',
  'Tribunal asignado',
  'Revisión escrita pendiente',
  'Revisión escrita completada',
  'Sustentación programada',
  'Sustentación pendiente',
  'Evaluación completada',
  'Finalizado',
];

export default function PaginaTrabajos() {
  const { estado, actorActual } = usarPrototipo();
  const [consulta, establecerConsulta] = useState('');
  const [filtroEstado, establecerFiltroEstado] = useState('Todos');
  const [periodo, establecerPeriodo] = useState('Todos');
  const puedeGestionar = actorActual.roles.some((role) => [ROL.COMISION, ROL.ADMIN].includes(role));
  const filtrosActivos = Boolean(consulta || filtroEstado !== 'Todos' || periodo !== 'Todos');

  const filas = useMemo(() => estado.trabajos.map((trabajo) => ({
    ...trabajo,
    estadoProceso: derivarEstadoTrabajo(estado, trabajo),
    estudiantes: trabajo.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean),
    tutor: estado.personas.find((persona) => persona.id === trabajo.idTutor),
    tribunal: trabajo.idsTribunal.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean),
  })).filter((trabajo) => {
    const textoBusqueda = [trabajo.codigo, trabajo.titulo, trabajo.carrera, ...trabajo.estudiantes.map(nombreCompleto)].join(' ').toLocaleLowerCase('es');
    return textoBusqueda.includes(consulta.toLocaleLowerCase('es'))
      && (filtroEstado === 'Todos' || trabajo.estadoProceso === filtroEstado)
      && (periodo === 'Todos' || trabajo.periodo === periodo);
  }), [estado, consulta, filtroEstado, periodo]);

  const opcionesEstado = [...new Set(estado.trabajos.map((trabajo) => derivarEstadoTrabajo(estado, trabajo)))];
  const opcionesPeriodo = [...new Set(estado.trabajos.map((trabajo) => trabajo.periodo))];

  const limpiarFiltros = () => {
    establecerConsulta('');
    establecerFiltroEstado('Todos');
    establecerPeriodo('Todos');
  };

  return (
    <div className="trabajos-page">
      <EncabezadoPagina
        eyebrow="Seguimiento académico"
        title="Trabajos de titulación"
        description="Consulte el avance del tribunal, las evaluaciones y la sustentación de cada trabajo."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Trabajos' }]}
        meta={<InsigniaEstado tono="neutral">{estado.trabajos.length} trabajos registrados</InsigniaEstado>}
        actions={puedeGestionar && <Link className="button button-primary" to="/trabajos/nuevo"><Plus size={18} /> Registrar trabajo</Link>}
      />

      <section className="trabajos-filters" aria-labelledby="trabajos-filters-title">
        <header>
          <div>
            <span className="section-kicker">Consulta del expediente</span>
            <h2 id="trabajos-filters-title"><SlidersHorizontal size={20} /> Buscar y filtrar</h2>
          </div>
          <span className="trabajos-result-count" aria-live="polite">{filas.length} de {estado.trabajos.length}</span>
        </header>
        <div className="trabajos-filter-grid">
          <div className="field trabajos-search-field">
            <label htmlFor="trabajo-search">Buscar trabajo o estudiante</label>
            <div className="trabajos-search-control">
              <Search size={18} aria-hidden="true" />
              <input id="trabajo-search" className="input" type="search" placeholder="Código, título, carrera o estudiante" value={consulta} onChange={(evento) => establecerConsulta(evento.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="trabajo-periodo">Período</label>
            <select id="trabajo-periodo" className="select" value={periodo} onChange={(evento) => establecerPeriodo(evento.target.value)}><option>Todos</option>{opcionesPeriodo.map((elemento) => <option key={elemento}>{elemento}</option>)}</select>
          </div>
          <div className="field">
            <label htmlFor="trabajo-estado">Estado del proceso</label>
            <select id="trabajo-estado" className="select" value={filtroEstado} onChange={(evento) => establecerFiltroEstado(evento.target.value)}><option>Todos</option>{opcionesEstado.map((elemento) => <option key={elemento}>{elemento}</option>)}</select>
          </div>
          {filtrosActivos ? <button className="button button-outline trabajos-clear-filters" type="button" onClick={limpiarFiltros}><X size={17} /> Limpiar</button> : null}
        </div>
      </section>

      {filas.length === 0 ? (
        <EstadoVacio
          icon={Search}
          title="No hay coincidencias"
          description="No existen trabajos que coincidan con la búsqueda y los filtros seleccionados."
          accion={filtrosActivos ? <button className="button button-outline" type="button" onClick={limpiarFiltros}>Limpiar filtros</button> : null}
          className="trabajos-empty"
        />
      ) : (
        <section className="trabajos-results" aria-labelledby="trabajos-results-title">
          <div className="trabajos-results-heading">
            <div>
              <span className="section-kicker">Expedientes visibles</span>
              <h2 id="trabajos-results-title">Seguimiento de trabajos</h2>
            </div>
            <p>Los estados reflejan el avance registrado actualmente en el prototipo.</p>
          </div>
          <div className="trabajos-card-grid">
            {filas.map((trabajo) => {
              const etapa = Math.max(ETAPAS_PROCESO.indexOf(trabajo.estadoProceso) + 1, 1);
              return (
                <article className="trabajo-list-card" key={trabajo.id}>
                  <header>
                    <div className="trabajo-list-code"><BriefcaseBusiness size={17} /><span>{trabajo.codigo}</span></div>
                    <InsigniaEstado tono={tonoEstado(trabajo.estadoProceso)}>{trabajo.estadoProceso}</InsigniaEstado>
                  </header>
                  <div className="trabajo-list-main">
                    <h3>{trabajo.titulo}</h3>
                    <div className="trabajo-list-tags" aria-label="Información académica">
                      <span><GraduationCap size={15} /> {trabajo.modalidad}</span>
                      <span>{trabajo.carrera}</span>
                      <span>{trabajo.periodo}</span>
                    </div>
                  </div>
                  <div className="trabajo-list-people">
                    <div>
                      <span className="trabajo-list-label"><UsersRound size={16} /> Estudiante{trabajo.estudiantes.length === 1 ? '' : 's'}</span>
                      <strong>{trabajo.estudiantes.map(nombreCompleto).join(' / ')}</strong>
                    </div>
                    <div>
                      <span className="trabajo-list-label"><UserRound size={16} /> Tutor</span>
                      <strong>{nombreCompleto(trabajo.tutor)}</strong>
                    </div>
                  </div>
                  <div className="trabajo-list-tribunal">
                    <span className="trabajo-list-label"><BookOpenCheck size={16} /> Tribunal</span>
                    {trabajo.tribunal.length === 2 ? (
                      <span>{trabajo.tribunal.map(nombreCompleto).join(' · ')}</span>
                    ) : (
                      <span className="trabajo-list-pending">Pendiente de asignación</span>
                    )}
                  </div>
                  <footer>
                    <div className="trabajo-stage-progress">
                      <span><strong>Etapa {etapa}</strong> de {ETAPAS_PROCESO.length}</span>
                      <progress value={etapa} max={ETAPAS_PROCESO.length} aria-label={`Avance: etapa ${etapa} de ${ETAPAS_PROCESO.length}`} />
                    </div>
                    <Link className="button button-outline" to={`/trabajos/${trabajo.id}`}>Ver seguimiento <ArrowRight size={17} /></Link>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
