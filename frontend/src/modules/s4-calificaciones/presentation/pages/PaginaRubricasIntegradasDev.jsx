import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenCheck, RefreshCw } from 'lucide-react';
import { getJsonApi } from '../services/clienteHttp';
import { cargarCapacidadesRubricasApi } from '../services/rubricasApi';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio } from '../components/interfaz';
import { FormularioRubrica } from '../components/FormularioRubrica';
import { adaptarEtapaRubricaMer } from '../../domain/adaptacionRubricaMer';
import './evaluacionesMerDev.css';

function VistaRubricaMer({ versionId, practica }) {
  const [consulta, setConsulta] = useState({ etapas: null, error: null });
  const [calificaciones, setCalificaciones] = useState({});
  const [observaciones, setObservaciones] = useState({});
  useEffect(() => {
    const controlador = new AbortController();
    getJsonApi(`/integracion-dev/evaluaciones/rubricas/${encodeURIComponent(versionId)}`, { signal: controlador.signal })
      .then(({ etapas }) => {
        if (!controlador.signal.aborted) setConsulta({ etapas, error: null });
      })
      .catch((error) => {
        if (!controlador.signal.aborted) setConsulta({ etapas: null, error });
      });
    return () => controlador.abort();
  }, [versionId]);

  if (consulta.error) return <p role="alert">{consulta.error.message}</p>;
  if (!consulta.etapas) return <p role="status">Cargando estructura de la rúbrica…</p>;
  return <>
    {practica && <p className="em-ayuda">Vista de práctica. Las notas y observaciones que ingreses aquí son temporales.</p>}
    {consulta.etapas.map((etapa) => <FormularioRubrica
      key={etapa.id}
      rubrica={adaptarEtapaRubricaMer(etapa)}
      etapa={etapa.id}
      calificaciones={calificaciones}
      observaciones={observaciones}
      alCambiarCalificacion={(id, valor) => setCalificaciones((actual) => ({ ...actual, [id]: valor }))}
      alCambiarObservacion={(id, valor) => setObservaciones((actual) => ({ ...actual, [id]: valor }))}
      readOnly={!practica}
      showCompletionState={practica}
      preservarPrecision
      mostrarEtiquetaCerrada={false}
      className="em-rubrica-formulario em-rubrica-vista"
      idPrefix={`catalogo-${versionId}`}
    />)}
  </>;
}

export default function PaginaRubricasIntegradasDev() {
  const [consulta, setConsulta] = useState({ estado: 'cargando', rubricas: [], error: null });
  const [recarga, setRecarga] = useState(0);
  const [versionAbierta, setVersionAbierta] = useState(null);
  const [puedeAdministrar, setPuedeAdministrar] = useState(false);
  useEffect(() => {
    const controlador = new AbortController();
    setConsulta((anterior) => ({ ...anterior, estado: 'cargando', error: null }));
    getJsonApi('/evaluaciones/mer/catalogo-rubricas', { signal: controlador.signal })
      .then((resultado) => {
        if (!controlador.signal.aborted) {
          if (!Array.isArray(resultado?.rubricas)) throw new Error('El catálogo no tiene un formato válido.');
          setConsulta({ estado: 'listo', rubricas: resultado.rubricas, error: null });
        }
      })
      .catch((error) => {
        if (!controlador.signal.aborted) setConsulta({ estado: 'error', rubricas: [], error });
      });
    cargarCapacidadesRubricasApi({ signal: controlador.signal })
      .then((capacidad) => {
        if (!controlador.signal.aborted) setPuedeAdministrar(capacidad.puedeAdministrar);
      })
      .catch(() => {
        if (!controlador.signal.aborted) setPuedeAdministrar(false);
      });
    return () => controlador.abort();
  }, [recarga]);

  return <div className="evaluaciones-mer-page">
    <EncabezadoPagina eyebrow="MER unificado · S4" title="Rúbricas"
      description="Versiones y estructuras almacenadas en el PostgreSQL de desarrollo."
      breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, 'Rúbricas']}
      actions={<button className="button button-outline" type="button" onClick={() => setRecarga((n) => n + 1)}>
        <RefreshCw size={16}/> Actualizar</button>} />
    {puedeAdministrar && <p><Link className="button button-primary" to="/rubricas/nueva">Nueva rúbrica</Link></p>}
    {consulta.estado === 'cargando' && <div className="card" role="status">Cargando rúbricas…</div>}
    {consulta.estado === 'error' && <AlertaInstitucional tono="danger" titulo="No se pudo cargar el catálogo">
      {consulta.error?.message ?? 'Error de consulta.'}</AlertaInstitucional>}
    {consulta.estado === 'listo' && consulta.rubricas.length === 0 && <EstadoVacio title="Sin rúbricas registradas" description="Carga los seeders S4 para visualizar una rúbrica de prueba." />}
    {consulta.estado === 'listo' && consulta.rubricas.map((r) => <article className="card em-seccion" key={r.versionId}>
      <h2><BookOpenCheck size={20}/>{r.nombre}</h2>
      <p className="em-ayuda">{r.descripcion || 'Sin descripción'}</p>
      <div className="em-fila"><span>Modalidad</span><strong>{r.modalidad}</strong></div>
      <div className="em-fila"><span>Versión</span><strong>{r.version || 'Sin número'}</strong><span>Estado: {r.estado}</span></div>
      <div className="em-fila"><span>Estructura</span><strong>{r.numeroEtapas} etapas · {r.numeroCategorias} categorías · {r.numeroIndicadores} indicadores</strong></div>
      <div className="em-fila"><span>Procesos asociados</span><strong>{r.procesosAsignados}</strong></div>
      <Link className="button button-outline em-abrir-rubrica" to={`/rubricas/${r.id}`}>Ver versiones</Link>
      <button className="button button-outline em-abrir-rubrica" type="button"
        aria-expanded={versionAbierta === r.versionId}
        onClick={() => setVersionAbierta(versionAbierta === r.versionId ? null : r.versionId)}>
        {versionAbierta === r.versionId ? 'Ocultar formulario' : 'Ver formulario'}
      </button>
      {versionAbierta === r.versionId && <VistaRubricaMer versionId={r.versionId} practica={r.version === 'DEV-ETAPA-5'} />}
    </article>)}
    <p><Link className="button button-outline" to="/trabajos">Ver trabajos y rúbricas asignadas</Link></p>
  </div>;
}
