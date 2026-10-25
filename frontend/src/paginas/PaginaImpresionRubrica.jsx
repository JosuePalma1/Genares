import { useEffect, useRef } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { FileText, GraduationCap, Layers3, Printer, UserRound } from 'lucide-react';
import { ESTADO_EVALUACION, ALCANCE_ETAPA_RUBRICA } from '../datos/datosPrototipo';
import {
  calificacionCategoria,
  calificacionEtapa,
  calificacionMiembro,
  maximoEtapa,
  maximoRubrica,
  nombreCompleto,
  obtenerEtapasRubrica,
} from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { BotonVolver, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { DOCUMENTOS_API_HABILITADA } from '../servicios/documentosApi';
import { esUuidPostgres } from '../adaptadores/uuidPostgres';
import { destinoDocumentosRubrica } from '../dominio/documentosRubrica';
import { FUENTE_EVALUACIONES } from '../configuracion/evaluaciones';

function formatearFechaHora(valor) {
  if (!valor) return 'Sin fecha registrada';
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(valor));
}

export default function PaginaImpresionRubrica() {
  const { idTrabajo, idEstudiante, idMiembro } = useParams();
  const ubicacion = useLocation();

  if (FUENTE_EVALUACIONES === 'api') {
    if (!DOCUMENTOS_API_HABILITADA) return <EstadoVacio
      title="Impresión no disponible"
      description="La generación de documentos de rúbrica no está disponible actualmente."
    />;
    if (![idTrabajo, idEstudiante, idMiembro].every(esUuidPostgres)) {
      return <EstadoVacio
        title="Rúbrica no disponible"
        description="No fue posible localizar la rúbrica solicitada. Verifique el enlace e inténtelo de nuevo."
        accion={<a className="button button-outline" href="/trabajos">Volver a trabajos</a>}
      />;
    }
    const autoPrint = ubicacion.state?.autoPrint || new URLSearchParams(ubicacion.search).get('autoPrint') === '1';
    return <Navigate replace to={destinoDocumentosRubrica(idTrabajo, idEstudiante, idMiembro, autoPrint)} />;
  }

  return <PaginaImpresionRubricaPrototipo />;
}

function PaginaImpresionRubricaPrototipo() {
  const { idTrabajo, idEstudiante, idMiembro } = useParams();
  const { estado } = usarPrototipo();
  const ubicacion = useLocation();
  const autoimpresionIniciada = useRef(false);
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const estudiante = estado.personas.find((persona) => persona.id === idEstudiante);
  const miembro = estado.personas.find((persona) => persona.id === idMiembro);
  const tutor = estado.personas.find((persona) => persona.id === trabajo?.idTutor);
  const evaluacion = estado.evaluaciones.find((elemento) => elemento.idTrabajo === idTrabajo && elemento.idMiembro === idMiembro);
  const oral = evaluacion?.oralPorEstudiante?.[idEstudiante];
  const imprimible = evaluacion?.escrita.estado === ESTADO_EVALUACION.CERRADA && oral?.estado === ESTADO_EVALUACION.CERRADA;

  const imprimirRubrica = () => {
    window.setTimeout(() => window.print(), 120);
  };

  useEffect(() => {
    if (!ubicacion.state?.autoPrint || !imprimible || autoimpresionIniciada.current) return;
    const marca = `genares-autoprint-${ubicacion.key}`;
    if (window.sessionStorage.getItem(marca)) return;
    window.sessionStorage.setItem(marca, '1');
    autoimpresionIniciada.current = true;
    const temporizador = window.setTimeout(imprimirRubrica, 350);
    return () => window.clearTimeout(temporizador);
  }, [ubicacion.key, ubicacion.state?.autoPrint, imprimible]);

  if (!trabajo || !estudiante || !miembro || !evaluacion || !imprimible) {
    return (
      <EstadoVacio
        title="Rúbrica aún no disponible"
        description="La revisión escrita y la evaluación oral deben estar finalizadas para este estudiante."
      />
    );
  }

  const rubrica = evaluacion.instantaneaRubrica;
  const etapas = obtenerEtapasRubrica(rubrica);
  const calificacion = calificacionMiembro(evaluacion, idEstudiante);

  return (
    <div className="print-page-shell rubrica-preview-page">
      <header className="print-preview-header no-print">
        <div className="print-preview-icon" aria-hidden="true"><FileText size={25} /></div>
        <div>
          <span className="section-kicker">Documento académico interno</span>
          <h1>Vista previa de la rúbrica</h1>
          <p>{trabajo.codigo} · {nombreCompleto(estudiante)}</p>
        </div>
        <InsigniaEstado tono="success">Documento preliminar · evaluación cerrada</InsigniaEstado>
      </header>

      <section className="print-preview-context no-print" aria-label="Información de la vista previa">
        <div><GraduationCap size={18} aria-hidden="true" /><span>Modalidad</span><strong>{trabajo.modalidad}</strong></div>
        <div><Layers3 size={18} aria-hidden="true" /><span>Versión utilizada</span><strong>{rubrica.version} · {rubrica.periodo}</strong></div>
        <div><UserRound size={18} aria-hidden="true" /><span>Evaluador</span><strong>{nombreCompleto(miembro)}</strong></div>
        <div><FileText size={18} aria-hidden="true" /><span>Formato</span><strong>A4 vertical · {etapas.length} páginas</strong></div>
      </section>

      <div className="print-toolbar no-print" aria-label="Acciones del documento">
        <BotonVolver respaldo={`/resultados/${trabajo.id}/${estudiante.id}`}>Volver a resultados</BotonVolver>
        <div>
          <span className="print-preview-hint">Revise estudiante y evaluador antes de imprimir.</span>
          <button className="button button-primary" type="button" onClick={imprimirRubrica}>
            <Printer size={18} /> Imprimir rúbrica
          </button>
        </div>
      </div>

      <div className="print-document-viewport" role="region" aria-label="Vista previa del documento A4" tabIndex="0">
        <article className="rubrica-document">
          {etapas.map((etapa, indice) => {
            const categorias = rubrica.categorias.filter((categoria) => categoria.etapa === etapa.id);
            const calificaciones = etapa.alcance === ALCANCE_ETAPA_RUBRICA.TRABAJO_COMPARTIDO ? evaluacion.escrita.calificaciones : oral.calificaciones;
            const esUltimaPagina = indice === etapas.length - 1;
            return (
              <section className={`rubrica-print-page ${esUltimaPagina ? '' : 'rubrica-print-page-break'}`} aria-label={`${etapa.nombre}, página ${indice + 1} de ${etapas.length}`} key={etapa.id}>
                <EncabezadoInstitucional
                  pagina={`Página ${indice + 1} de ${etapas.length}`}
                  modalidad={trabajo.modalidad}
                  parte={String(etapa.codigo).replaceAll('_', ' ')}
                  etapa={`${etapa.nombre.toUpperCase()}${etapa.porcentaje ? ` (${etapa.porcentaje}%)` : ''} ${maximoEtapa(rubrica, etapa.id).toFixed(2)} PUNTOS`}
                  version={rubrica.version}
                  periodo={rubrica.periodo}
                />
                <MetadatosRubrica trabajo={trabajo} estudiante={estudiante} tutor={tutor} miembro={miembro} rubrica={rubrica} fechaEvaluacion={oral.finalizedAt ?? evaluacion.escrita.finalizedAt} />
                <div className="print-categorias">
                  {categorias.map((categoria) => <CategoriaRubrica key={categoria.id} categoria={categoria} calificaciones={calificaciones} />)}
                </div>
                <div className="print-stage-total" aria-label={`Subtotal de ${etapa.nombre}`}>
                  <span>Subtotal · {etapa.nombreCorto ?? etapa.nombre}</span>
                  <strong>{calificacionEtapa(evaluacion, etapa.id, estudiante.id).toFixed(2)} / {maximoEtapa(rubrica, etapa.id).toFixed(2)}</strong>
                </div>
                {esUltimaPagina ? <ResumenEvaluacion rubrica={rubrica} etapas={etapas} evaluacion={evaluacion} oral={oral} calificacion={calificacion} /> : null}
                <FirmaTribunal miembro={miembro} />
              </section>
            );
          })}
        </article>
      </div>
    </div>
  );
}

function EncabezadoInstitucional({ pagina, modalidad, parte, etapa, version, periodo }) {
  return (
    <header className="rubrica-document-header">
      <div className="institutional-header-row">
        <div className="institution-brand">
          <img src="/assets/ULEAM.png" alt="Identidad institucional provisional" />
          <div><strong>ULEAM</strong><span>UNIVERSIDAD LAICA</span><span>ELOY ALFARO DE MANABÍ</span></div>
        </div>
        <div className="faculty-heading"><strong>Facultad de Ciencias de la Vida</strong><strong>y Tecnologías</strong><span>{pagina}</span></div>
      </div>
      <div className="rubrica-heading">
        <span className="rubrica-document-version">Rúbrica {version} · Período {periodo}</span>
        <h1>RÚBRICA DE EVALUACIÓN DE TRABAJO DE INTEGRACIÓN CURRICULAR</h1>
        <h2>MODALIDAD {modalidad.toUpperCase()}</h2>
        <h2>{parte}</h2>
        <h2>{etapa}</h2>
      </div>
    </header>
  );
}

function MetadatosRubrica({ trabajo, estudiante, tutor, miembro, rubrica, fechaEvaluacion }) {
  return (
    <section className="print-metadata" aria-label="Identificación del documento">
      <div className="print-metadata-wide"><span>TÍTULO DEL TRABAJO:</span><strong>{trabajo.titulo}</strong></div>
      <div><span>CÓDIGO:</span><strong>{trabajo.codigo}</strong></div>
      <div><span>CARRERA:</span><strong>{trabajo.carrera}</strong></div>
      <div className="print-metadata-wide"><span>ESTUDIANTE:</span><strong>{nombreCompleto(estudiante)} · {estudiante.cedula}</strong></div>
      <div><span>TUTOR:</span><strong>{nombreCompleto(tutor)}</strong></div>
      <div><span>EVALUADOR:</span><strong>{nombreCompleto(miembro)}</strong></div>
      <div><span>RÚBRICA:</span><strong>{rubrica.version} · {rubrica.periodo}</strong></div>
      <div><span>FECHA DE EVALUACIÓN:</span><strong>{formatearFechaHora(fechaEvaluacion)}</strong></div>
    </section>
  );
}

function CategoriaRubrica({ categoria, calificaciones }) {
  return (
    <section className="print-categoria">
      <h3>{categoria.codigo}. {categoria.nombre} <span>Máximo: {categoria.maximo.toFixed(2)} {categoria.maximo === 1 ? 'punto' : 'puntos'}</span></h3>
      <table className="rubrica-print-table">
        <caption className="sr-only">Indicadores y calificaciones de {categoria.nombre}</caption>
        <thead><tr><th scope="col">INDICADORES</th><th scope="col">VALORACIÓN</th><th scope="col">CALIFICACIÓN</th></tr></thead>
        <tbody>
          {categoria.indicadores.map((indicador, indice) => (
            <tr key={indicador.id}><td><span className="indicador-number">{indice + 1}.</span> {indicador.etiqueta}</td><td>{indicador.maximo.toFixed(2)}</td><td>{Number(calificaciones?.[indicador.id] ?? 0).toFixed(2)}</td></tr>
          ))}
          <tr className="categoria-total-row"><th scope="row">SUMATORIA</th><th>{categoria.maximo.toFixed(2)}</th><th>{calificacionCategoria(calificaciones, categoria).toFixed(2)}</th></tr>
        </tbody>
      </table>
    </section>
  );
}

function ResumenEvaluacion({ rubrica, etapas, evaluacion, oral, calificacion }) {
  return (
    <section className="print-summary">
      <h2>RESUMEN DE LA EVALUACIÓN</h2>
      <table className="rubrica-print-table summary-table">
        <caption className="sr-only">Resumen de calificaciones por categoría</caption>
        <thead><tr><th scope="col">CATEGORÍAS</th><th scope="col">VALORACIÓN</th><th scope="col">CALIFICACIÓN PARCIAL</th></tr></thead>
        <tbody>
          {rubrica.categorias.map((categoria) => {
            const etapa = etapas.find((elemento) => elemento.id === categoria.etapa);
            const calificaciones = etapa?.alcance === ALCANCE_ETAPA_RUBRICA.TRABAJO_COMPARTIDO ? evaluacion.escrita.calificaciones : oral.calificaciones;
            return <tr key={categoria.id}><td>{categoria.codigo}. {categoria.nombre}</td><td>{categoria.maximo.toFixed(2)}</td><td>{calificacionCategoria(calificaciones, categoria).toFixed(2)}</td></tr>;
          })}
          <tr className="print-final-calificacion"><th scope="row">CALIFICACIÓN FINAL</th><th>{maximoRubrica(rubrica).toFixed(2)}</th><th>{calificacion.toFixed(2)}</th></tr>
        </tbody>
      </table>
      <div className="print-result-callout"><span>Resultado registrado por el evaluador</span><strong>{calificacion.toFixed(2)} / {maximoRubrica(rubrica).toFixed(2)}</strong></div>
    </section>
  );
}

function FirmaTribunal({ miembro }) {
  return (
    <footer className="signature-area">
      <div><span className="signature-line" /><strong>{nombreCompleto(miembro)}</strong><span>MIEMBRO DEL TRIBUNAL</span></div>
    </footer>
  );
}
