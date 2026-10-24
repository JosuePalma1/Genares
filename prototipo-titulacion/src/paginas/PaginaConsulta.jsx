import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { FUENTE_TRABAJOS } from '../configuracion/trabajos';
import { ConsultaSeguimientoApi } from './SeguimientoApi';
import {
  calificacionFinalEstudiante,
  derivarEstadoTrabajo,
  nombreCompleto,
  tonoEstado,
} from '../dominio/flujoTrabajo';

function PaginaConsultaPrototipo() {
  const { estado } = usarPrototipo();
  const [consulta, establecerConsulta] = useState('');
  const campoBusqueda = useRef(null);

  const registros = useMemo(() => estado.trabajos.flatMap((trabajo) => (
    trabajo.idsEstudiantes.map((idEstudiante) => ({
      trabajo,
      estudiante: estado.personas.find((persona) => persona.id === idEstudiante),
    }))
  )), [estado.personas, estado.trabajos]);

  const resultados = useMemo(() => registros.filter(({ trabajo, estudiante }) => (
    `${estudiante?.cedula} ${nombreCompleto(estudiante)} ${trabajo.titulo}`
      .toLocaleLowerCase('es')
      .includes(consulta.toLocaleLowerCase('es'))
  )), [consulta, registros]);

  const limpiarBusqueda = () => {
    establecerConsulta('');
    window.requestAnimationFrame(() => campoBusqueda.current?.focus());
  };

  return (
    <div className="consulta-page">
      <EncabezadoPagina
        eyebrow="Consulta académica"
        title="Consulta e historial"
        description="Evaluaciones generadas desde la puesta en marcha del prototipo; sin migración de datos antiguos."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Consulta' }]}
        meta={<InsigniaEstado tono="neutral">Solo lectura</InsigniaEstado>}
      />

      <AlertaInstitucional titulo="Fuente de demostración">
        Estos datos son locales y ficticios. No existe una conexión con API institucional.
      </AlertaInstitucional>

      <section className="consulta-search-panel" aria-labelledby="consulta-search-title">
        <header>
          <div>
            <span className="section-kicker">Expedientes disponibles</span>
            <h2 id="consulta-search-title"><Search size={20} aria-hidden="true" /> Buscar estudiante o trabajo</h2>
          </div>
          <span className="consulta-result-count" role="status" aria-live="polite">
            {resultados.length} de {registros.length} coincidencias
          </span>
        </header>
        <div className="consulta-search-body">
          <div className="field consulta-search-field">
            <label htmlFor="history-search">Cédula, nombre o título</label>
            <div className="consulta-search-control">
              <Search size={18} aria-hidden="true" />
              <input
                ref={campoBusqueda}
                id="history-search"
                className="input"
                type="search"
                value={consulta}
                onChange={(evento) => establecerConsulta(evento.target.value)}
                placeholder="Ej.: nombre del estudiante o título del trabajo"
                aria-describedby="history-search-help"
              />
            </div>
            <small id="history-search-help">La búsqueda filtra los expedientes visibles sin modificar sus datos.</small>
          </div>
        </div>
      </section>

      {resultados.length === 0 ? (
        <EstadoVacio
          icon={Search}
          title="No se encontraron coincidencias"
          description="Pruebe con otra cédula, nombre o parte del título del trabajo."
          accion={consulta ? (
            <button className="button button-outline" type="button" onClick={limpiarBusqueda}>
              Limpiar búsqueda
            </button>
          ) : null}
          className="consulta-empty"
        />
      ) : (
        <section className="consulta-results" aria-labelledby="consulta-results-title">
          <div className="consulta-results-heading">
            <div>
              <span className="section-kicker">Resultados visibles</span>
              <h2 id="consulta-results-title">Trabajos y estudiantes</h2>
            </div>
            <p>Las calificaciones se muestran únicamente cuando el proceso correspondiente está disponible.</p>
          </div>

          <div className="consulta-results-card">
            <div className="table-wrap">
              <table className="data-table responsive-table consulta-table">
                <caption className="sr-only">Resultados de la búsqueda de trabajos y estudiantes</caption>
                <thead>
                  <tr>
                    <th scope="col">Estudiante</th>
                    <th scope="col">Trabajo</th>
                    <th scope="col">Período</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Calificación final</th>
                    <th scope="col">Consulta</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map(({ trabajo, estudiante }) => {
                    const estadoProceso = derivarEstadoTrabajo(estado, trabajo);
                    const calificacion = calificacionFinalEstudiante(estado, trabajo, estudiante.id);
                    const nombreEstudiante = nombreCompleto(estudiante);

                    return (
                      <tr key={`${trabajo.id}-${estudiante.id}`}>
                        <td data-label="Estudiante">
                          <span className="cell-title">{nombreEstudiante}</span>
                          <span className="cell-subtitle">Cédula: {estudiante.cedula}</span>
                        </td>
                        <td data-label="Trabajo"><span className="consulta-work-title">{trabajo.titulo}</span></td>
                        <td data-label="Período">{trabajo.periodo}</td>
                        <td data-label="Estado"><InsigniaEstado tono={tonoEstado(estadoProceso)}>{estadoProceso}</InsigniaEstado></td>
                        <td data-label="Calificación">{calificacion?.toFixed(2) ?? '—'}</td>
                        <td data-label="Consulta">
                          <Link
                            className="button button-outline consulta-detail-link"
                            to={`/resultados/${trabajo.id}/${estudiante.id}`}
                            aria-label={`Ver detalle de ${nombreEstudiante}`}
                          >
                            Ver detalle <ArrowRight size={17} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function PaginaConsulta() {
  return FUENTE_TRABAJOS === 'api' ? <ConsultaSeguimientoApi /> : <PaginaConsultaPrototipo />;
}
