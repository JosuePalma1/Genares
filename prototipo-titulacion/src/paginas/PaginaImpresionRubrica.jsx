import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { ESTADO_EVALUACION, ALCANCE_ETAPA_RUBRICA } from '../datos/datosPrototipo';
import { calificacionCategoria, nombreCompleto, obtenerEtapasRubrica, calificacionMiembro, maximoRubrica, maximoEtapa } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EstadoVacio, InsigniaEstado } from '../componentes/interfaz';

export default function PaginaImpresionRubrica() {
  const { idTrabajo, idEstudiante, idMiembro } = useParams();
  const { estado, despachar } = usarPrototipo();
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
    despachar({ tipo: 'MARCAR_RUBRICA_IMPRESA', idEvaluacion: evaluacion.id, idEstudiante });
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
    <div className="print-page-shell">
      <div className="print-toolbar">
        <Link className="button button-outline" to={`/resultados/${trabajo.id}/${estudiante.id}`}>
          <ArrowLeft size={17} /> Volver a resultados
        </Link>
        <div>
          <InsigniaEstado tono="success">Evaluación finalizada</InsigniaEstado>
          <button className="button button-primary" type="button" onClick={imprimirRubrica}>
            <Printer size={18} /> Imprimir nuevamente
          </button>
        </div>
      </div>

      <article className="rubrica-document">
        {etapas.map((etapa, indice) => {
          const categorias = rubrica.categorias.filter((categoria) => categoria.etapa === etapa.id);
          const calificaciones = etapa.alcance === ALCANCE_ETAPA_RUBRICA.TRABAJO_COMPARTIDO ? evaluacion.escrita.calificaciones : oral.calificaciones;
          const esUltimaPagina = indice === etapas.length - 1;
          return (
            <section className={`rubrica-print-page ${esUltimaPagina ? '' : 'rubrica-print-page-break'}`} key={etapa.id}>
              <EncabezadoInstitucional
                pagina={`Página ${indice + 1} de ${etapas.length}`}
                modalidad={trabajo.modalidad}
                parte={String(etapa.codigo).replaceAll('_', ' ')}
                etapa={`${etapa.nombre.toUpperCase()}${etapa.porcentaje ? ` (${etapa.porcentaje}%)` : ''} ${maximoEtapa(rubrica, etapa.id).toFixed(2)} PUNTOS`}
              />
              <MetadatosRubrica trabajo={trabajo} estudiante={estudiante} tutor={tutor} />
              <div className="print-categorias">
                {categorias.map((categoria) => <CategoriaRubrica key={categoria.id} categoria={categoria} calificaciones={calificaciones} />)}
              </div>
              {esUltimaPagina ? <ResumenEvaluacion rubrica={rubrica} etapas={etapas} evaluacion={evaluacion} oral={oral} calificacion={calificacion} /> : null}
              <FirmaTribunal miembro={miembro} />
            </section>
          );
        })}
      </article>
    </div>
  );
}

function EncabezadoInstitucional({ pagina, modalidad, parte, etapa }) {
  return (
    <header className="rubrica-document-header">
      <div className="institutional-header-row">
        <div className="institution-brand">
          <img src="/assets/identidad-placeholder.svg" alt="Identidad institucional provisional" />
          <div>
            <strong>ULEAM</strong>
            <span>UNIVERSIDAD LAICA</span>
            <span>ELOY ALFARO DE MANABÍ</span>
          </div>
        </div>
        <div className="faculty-heading">
          <strong>Facultad de Ciencias de la Vida</strong>
          <strong>y Tecnologías</strong>
          <span>{pagina}</span>
        </div>
      </div>
      <div className="rubrica-heading">
        <h1>RÚBRICA DE EVALUACIÓN DE TRABAJO DE INTEGRACIÓN CURRICULAR</h1>
        <h2>MODALIDAD {modalidad.toUpperCase()}</h2>
        <h2>{parte}</h2>
        <h2>{etapa}</h2>
      </div>
    </header>
  );
}

function MetadatosRubrica({ trabajo, estudiante, tutor }) {
  return (
    <section className="print-metadata">
      <div>
        <span>TÍTULO TRABAJO DE TITULACIÓN:</span>
        <strong>{trabajo.titulo}</strong>
      </div>
      <div>
        <span>NOMBRE DE ESTUDIANTE:</span>
        <strong>{nombreCompleto(estudiante)}</strong>
      </div>
      <div>
        <span>NOMBRE TUTOR:</span>
        <strong>{nombreCompleto(tutor)}</strong>
      </div>
    </section>
  );
}

function CategoriaRubrica({ categoria, calificaciones }) {
  return (
    <section className="print-categoria">
      <h3>
        {categoria.codigo}. {categoria.nombre} ({categoria.maximo.toFixed(2)} {categoria.maximo === 1 ? 'punto' : 'puntos'})
      </h3>
      <table className="rubrica-print-table">
        <thead>
          <tr>
            <th>INDICADORES</th>
            <th>VALORACIÓN</th>
            <th>CALIFICACIÓN</th>
          </tr>
        </thead>
        <tbody>
          {categoria.indicadores.map((indicador, indice) => (
            <tr key={indicador.id}>
              <td><span className="indicador-number">{indice + 1}.</span> {indicador.etiqueta}</td>
              <td>{indicador.maximo.toFixed(2)}</td>
              <td>{Number(calificaciones?.[indicador.id] ?? 0).toFixed(2)}</td>
            </tr>
          ))}
          <tr className="categoria-total-row">
            <th>SUMATORIA</th>
            <th>{categoria.maximo.toFixed(2)}</th>
            <th>{calificacionCategoria(calificaciones, categoria).toFixed(2)}</th>
          </tr>
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
        <thead>
          <tr>
            <th>CATEGORÍAS</th>
            <th>VALORACIÓN</th>
            <th>CALIFICACIÓN PARCIAL</th>
          </tr>
        </thead>
        <tbody>
          {rubrica.categorias.map((categoria) => {
            const etapa = etapas.find((elemento) => elemento.id === categoria.etapa);
            const calificaciones = etapa?.alcance === ALCANCE_ETAPA_RUBRICA.TRABAJO_COMPARTIDO ? evaluacion.escrita.calificaciones : oral.calificaciones;
            return (
              <tr key={categoria.id}>
                <td>{categoria.codigo}. {categoria.nombre}</td>
                <td>{categoria.maximo.toFixed(2)}</td>
                <td>{calificacionCategoria(calificaciones, categoria).toFixed(2)}</td>
              </tr>
            );
          })}
          <tr className="print-final-calificacion">
            <th>CALIFICACIÓN FINAL</th>
            <th>{maximoRubrica(rubrica).toFixed(2)}</th>
            <th>{calificacion.toFixed(2)}</th>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function FirmaTribunal({ miembro }) {
  return (
    <footer className="signature-area">
      <div>
        <span className="signature-line" />
        <strong>{nombreCompleto(miembro)}</strong>
        <span>MIEMBRO TRIBUNAL</span>
      </div>
    </footer>
  );
}
