import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowDownUp, ArrowUp, Eye, History, Plus } from 'lucide-react';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio } from '../componentes/interfaz';
import { ModalVersionesRubrica } from '../componentes/ModalVersionesRubrica';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { crearFilasCatalogoRubricas, filtrarRubricasCatalogo, FILTRO_NO_INFORMADA, FILTRO_SIN_ASOCIACION, ordenarRubricasCatalogo } from '../dominio/catalogoRubricas';
import { usarRubricasLectura } from '../hooks/usarRubricasLectura';
import './rubricasCatalogo.css';

const COLUMNAS_ORDENABLES = [
  { clave: 'modalidad', etiqueta: 'Modalidad' },
  { clave: 'carrera', etiqueta: 'Carrera' },
  { clave: 'periodo', etiqueta: 'Período' },
  { clave: 'version', etiqueta: 'Versión' },
  { clave: 'etiquetaVigencia', etiqueta: 'Vigencia' },
];

function presentarVigencia(fila) {
  const clase = fila.vigente === true ? 'is-vigente'
    : fila.vigente === false ? 'is-no-vigente'
      : 'is-desconocida';
  return <span className={`rubricas-vigencia ${clase}`}>{fila.etiquetaVigencia}</span>;
}

export default function PaginaRubricas() {
  const { estado } = usarPrototipo();
  const lectura = usarRubricasLectura(estado.versionesRubrica);
  const esApi = lectura.fuente === 'api';
  const versiones = lectura.versiones;
  const filas = useMemo(() => crearFilasCatalogoRubricas(versiones, lectura.fuente), [versiones, lectura.fuente]);
  const [filtros, setFiltros] = useState({
    busqueda: '', carreraId: 'TODAS', modalidadId: 'TODAS', periodoId: 'TODOS', vigencia: 'TODAS',
  });
  const [orden, setOrden] = useState({ campo: 'modalidad', direccion: 'asc' });
  const [referenciaHistorial, setReferenciaHistorial] = useState(null);

  const puedeAdministrar = esApi
    ? lectura.puedeAdministrarServidor
    : true;
  const puedeCrearEnApi = esApi && lectura.puedeAdministrar && !lectura.cargando && !lectura.error;
  const filtradas = useMemo(
    () => filtrarRubricasCatalogo(filas, filtros),
    [filas, filtros],
  );
  const ordenadas = useMemo(
    () => ordenarRubricasCatalogo(filtradas, orden.campo, orden.direccion),
    [filtradas, orden],
  );
  const filasCombinacion = useMemo(
    () => filtrarRubricasCatalogo(filas, { ...filtros, vigencia: 'TODAS' }),
    [filas, filtros],
  );

  const modalidades = [...new Map(filas.map((fila) => [fila.modalidadId, { id: fila.modalidadId, nombre: fila.modalidad }])).values()]
    .filter(({ id }) => id)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const periodos = [...new Map(filas.map((fila) => [fila.periodoId, { id: fila.periodoId, codigo: fila.periodo }])).values()]
    .filter(({ id }) => id)
    .sort((a, b) => b.codigo.localeCompare(a.codigo, 'es', { numeric: true }));
  const carreras = [...new Map(filas.filter((fila) => fila.tieneAsociacion)
    .map((fila) => [fila.carreraId, { id: fila.carreraId, nombre: fila.carrera }])).values()]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const versionesHistorial = referenciaHistorial
    ? versiones.filter((version) => (
      version.idRubrica === referenciaHistorial.rubricaId
      && String(version.periodoId ?? version.periodo) === String(referenciaHistorial.periodoId)
    )).sort((a, b) => Date.parse(b.creadaEn ?? '') - Date.parse(a.creadaEn ?? ''))
    : [];

  function actualizarFiltro(campo, valor) {
    setFiltros((actuales) => ({ ...actuales, [campo]: valor }));
  }

  function cambiarOrden(campo) {
    setOrden((actual) => ({
      campo,
      direccion: actual.campo === campo && actual.direccion === 'asc' ? 'desc' : 'asc',
    }));
  }

  function abrirHistorial(fila) {
    setReferenciaHistorial(fila);
  }

  const avisoSinVigencia = filasCombinacion.length > 0
    && !filasCombinacion.some((fila) => fila.vigente === true)
    && filasCombinacion.some((fila) => fila.tieneAsociacion);

  return (
    <div className="rubricas-catalogo-page">
      <EncabezadoPagina
        eyebrow="Configuración académica"
        title="Rúbricas"
        description="Consulte versiones por carrera, modalidad y período académico."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas' }]}
        actions={puedeCrearEnApi && <Link className="button button-primary" to="/rubricas/nueva"><Plus size={18} aria-hidden="true" /> Nueva rúbrica</Link>}
      />

      {esApi && !lectura.cargando && !lectura.error && !puedeCrearEnApi && <p className="rubricas-creacion-pendiente">
        {lectura.puedeAdministrarServidor
          ? 'La creación de rúbricas requiere autorización de administración académica.'
          : 'Su perfil puede consultar las rúbricas, pero no crear versiones nuevas.'}
      </p>}
      <section className="rubricas-catalogo" aria-labelledby="rubricas-catalogo-titulo">
        <header className="rubricas-catalogo-heading">
          <div>
            <span className="section-kicker">Catálogo institucional</span>
            <h2 id="rubricas-catalogo-titulo">Versiones y vigencias</h2>
            <p>La vigencia se consulta por carrera, modalidad y período; no se deduce solo del estado de la versión.</p>
          </div>
          <span className="rubricas-catalogo-conteo" aria-live="polite">
            {lectura.error ? 'No disponible' : lectura.cargando ? 'Cargando…' : `${filtradas.length} ${filtradas.length === 1 ? 'resultado' : 'resultados'}`}
          </span>
        </header>

        <div className="rubricas-filtros" aria-label="Filtros de rúbricas">
          <label className="rubricas-busqueda" htmlFor="rubricas-buscar">
            Buscar rúbricas
            <input
              id="rubricas-buscar"
              type="search"
              value={filtros.busqueda}
              onChange={(evento) => actualizarFiltro('busqueda', evento.target.value)}
              placeholder="Modalidad, carrera o versión"
              autoComplete="off"
              disabled={lectura.cargando || Boolean(lectura.error)}
            />
          </label>
          <label htmlFor="rubricas-carrera">
            Carrera
            <select id="rubricas-carrera" value={filtros.carreraId} onChange={(evento) => actualizarFiltro('carreraId', evento.target.value)} disabled={lectura.cargando || Boolean(lectura.error)}>
              <option value="TODAS">Todas las carreras</option>
              {carreras.map((carrera) => <option key={carrera.id} value={carrera.id}>{carrera.nombre}</option>)}
              {filas.some((fila) => fila.carreraId === FILTRO_SIN_ASOCIACION)
                && <option value={FILTRO_SIN_ASOCIACION}>Sin carrera asociada</option>}
            </select>
          </label>
          <label htmlFor="rubricas-modalidad">
            Modalidad
            <select id="rubricas-modalidad" value={filtros.modalidadId} onChange={(evento) => actualizarFiltro('modalidadId', evento.target.value)} disabled={lectura.cargando || Boolean(lectura.error)}>
              <option value="TODAS">Todas las modalidades</option>
              {modalidades.map((modalidad) => <option key={modalidad.id} value={modalidad.id}>{modalidad.nombre}</option>)}
            </select>
          </label>
          <label htmlFor="rubricas-periodo">
            Período académico
            <select id="rubricas-periodo" value={filtros.periodoId} onChange={(evento) => actualizarFiltro('periodoId', evento.target.value)} disabled={lectura.cargando || Boolean(lectura.error)}>
              <option value="TODOS">Todos los períodos</option>
              {periodos.map((periodo) => <option key={periodo.id} value={periodo.id}>{periodo.codigo}</option>)}
            </select>
          </label>
          <label htmlFor="rubricas-vigencia">
            Estado de vigencia
            <select id="rubricas-vigencia" value={filtros.vigencia} onChange={(evento) => actualizarFiltro('vigencia', evento.target.value)} disabled={lectura.cargando || Boolean(lectura.error)}>
              <option value="TODAS">Todas</option>
              <option value="VIGENTE">Vigentes</option>
              <option value="NO_VIGENTE">No vigentes</option>
              {esApi && <option value={FILTRO_SIN_ASOCIACION}>Sin carrera asociada</option>}
              {!esApi && <option value={FILTRO_NO_INFORMADA}>No informada</option>}
            </select>
          </label>
        </div>

        {lectura.cargando ? (
          <p className="rubricas-catalogo-estado" role="status">Cargando rúbricas…</p>
        ) : lectura.error ? (
          <div className="rubricas-catalogo-error" role="alert">
            <strong>No fue posible cargar las rúbricas</strong>
            <p>{lectura.error.message}</p>
            <button className="button button-outline" type="button" onClick={lectura.reintentar}>Reintentar</button>
          </div>
        ) : versiones.length === 0 ? (
          <div className="rubricas-catalogo-vacio">
            <EstadoVacio title="No hay rúbricas registradas" description="El servicio no devolvió versiones para esta consulta." />
          </div>
        ) : ordenadas.length === 0 ? (
          <div className="rubricas-catalogo-vacio">
            <EstadoVacio
              title="No se encontraron resultados"
              description={filtros.vigencia === 'VIGENTE'
                ? filasCombinacion.some((fila) => fila.tieneAsociacion)
                  ? 'Hay versiones asociadas a esta combinación, pero ninguna tiene vigencia actual.'
                  : 'No hay una versión asociada a esta carrera, modalidad y período.'
                : 'Ajuste la búsqueda o los filtros para consultar otras versiones.'}
            />
          </div>
        ) : (
          <>
            {avisoSinVigencia && <p className="rubricas-aviso-vigencia" role="status">
              No hay una versión vigente para la combinación consultada; las versiones anteriores siguen disponibles.
            </p>}
            <div className="rubricas-tabla-scroll" tabIndex={0} aria-label="Tabla de rúbricas; desplazamiento horizontal disponible">
              <table className="rubricas-tabla">
                <caption className="visually-hidden">Rúbricas, versiones y vigencias por carrera</caption>
                <thead>
                  <tr>
                    {COLUMNAS_ORDENABLES.map(({ clave, etiqueta }) => {
                      const activa = orden.campo === clave;
                      return <th key={clave} scope="col" aria-sort={activa ? orden.direccion === 'asc' ? 'ascending' : 'descending' : 'none'}>
                        <button className="rubricas-orden" type="button" onClick={() => cambiarOrden(clave)}>
                          {etiqueta}
                          {activa && orden.direccion === 'asc' ? <ArrowUp size={14} aria-hidden="true" />
                            : activa ? <ArrowDown size={14} aria-hidden="true" />
                              : <ArrowDownUp size={14} aria-hidden="true" />}
                        </button>
                      </th>;
                    })}
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map((fila) => <tr key={fila.id}>
                    <td><strong>{fila.modalidad}</strong><small>{fila.nombreRubrica}</small></td>
                    <td>{fila.carrera}<small>{fila.carreraCodigo}</small></td>
                    <td>{fila.periodo}</td>
                    <td>{fila.version}</td>
                    <td>{presentarVigencia(fila)}</td>
                    <td>
                      <div className="rubricas-tabla-acciones">
                        <Link className="button button-outline" to={`/rubricas/${encodeURIComponent(fila.versionId)}`}>
                          <Eye size={16} aria-hidden="true" /> Ver rúbrica
                        </Link>
                        <button className="button button-outline" type="button" onClick={() => abrirHistorial(fila)}>
                          <History size={16} aria-hidden="true" /> Ver versiones
                        </button>
                      </div>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <ModalVersionesRubrica
        referencia={referenciaHistorial}
        versiones={versionesHistorial}
        fuente={lectura.fuente}
        puedeCrearEnApi={puedeCrearEnApi}
        onCerrar={() => setReferenciaHistorial(null)}
      />
    </div>
  );
}
