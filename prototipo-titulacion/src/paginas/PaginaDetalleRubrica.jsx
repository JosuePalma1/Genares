import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  FileClock,
  GitBranch,
  Layers3,
  LockKeyhole,
  Save,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { AlertaInstitucional, BotonVolver, EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { formatearFecha, obtenerEtapasRubrica, redondearCalificacion } from '../dominio/flujoTrabajo';
import { usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';
import { usarRubricasLectura } from '../hooks/usarRubricasLectura';
import { actualizarVersionRubricaApi } from '../servicios/rubricasApi';
import { mensajeErrorEscrituraRubrica, prepararVersionApiParaGuardar } from '../dominio/rubricasApiEdicion';
import EditorEstructuraRubrica from '../componentes/EditorEstructuraRubrica';
import { claveElemento, decimalIndicador, etapasParaEditor, ordenarEstructura, revisarEstructura, subtotalCategoria, subtotalEtapa } from '../dominio/estructuraRubrica';

const statusPresentation = {
  ACTIVA: { etiqueta: 'Activa e inmutable', tono: 'success', icono: ShieldCheck },
  BORRADOR: { etiqueta: 'Borrador editable', tono: 'progress', icono: FileClock },
  ARCHIVADA: { etiqueta: 'Histórica e inmutable', tono: 'neutral', icono: LockKeyhole },
};

const clonar = (value) => JSON.parse(JSON.stringify(value ?? []));

function categoryMaximum(categoria) {
  try { return Number(subtotalCategoria(categoria)); } catch { return NaN; }
}

const puntos = (valor) => Number.isFinite(valor) ? valor.toFixed(2) : '—';

function describirVigenciaPorCarrera(carreras) {
  if (!Array.isArray(carreras) || carreras.length === 0) return 'Sin carreras asociadas';
  return carreras.map(({ nombre, vigente }) => `${nombre}: ${vigente ? 'Vigente' : 'No vigente'}`).join(' · ');
}

function VolverAlCatalogo({ esApi, children }) {
  if (!esApi) return <BotonVolver respaldo="/rubricas">{children}</BotonVolver>;
  return <Link className="button button-outline back-button" to="/rubricas"><ArrowLeft size={18} aria-hidden="true" /> {children}</Link>;
}

export default function PaginaDetalleRubrica() {
  const { idRubrica } = useParams();
  const { estado, despachar } = usarPrototipo();
  const lectura = usarRubricasLectura(estado.versionesRubrica);
  const esApi = lectura.fuente === 'api';
  const rubrica = lectura.versiones.find((elemento) => elemento.id === idRubrica);
  const [draftCategories, setDraftCategories] = useState([]);
  const [draftStages, setDraftStages] = useState([]);
  const [tieneCambios, setTieneCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [conflicto, setConflicto] = useState(false);
  const [revisionEditada, setRevisionEditada] = useState(null);
  usarAdvertenciaCambiosSinGuardar(tieneCambios, () => setTieneCambios(false));

  useEffect(() => {
    setDraftCategories(clonar(rubrica?.categorias));
    setDraftStages(clonar(rubrica ? etapasParaEditor(rubrica, esApi) : []));
    setTieneCambios(false);
    setConflicto(false);
    setRevisionEditada(null);
  }, [rubrica?.id, rubrica?.revision, rubrica?.estado]);

  const canEdit = Boolean(rubrica && rubrica.estado === 'BORRADOR' && (esApi ? lectura.puedeAdministrar : true));
  const canActivate = canEdit && !esApi;
  const visibleCategories = canEdit ? draftCategories : (rubrica?.categorias ?? []);
  const visibleStages = canEdit ? draftStages : (rubrica ? obtenerEtapasRubrica(rubrica) : []);
  const maximumTotal = useMemo(
    () => redondearCalificacion(visibleCategories.reduce((total, categoria) => total + categoryMaximum(categoria), 0)),
    [visibleCategories],
  );
  const indicatorCount = visibleCategories.reduce((total, categoria) => total + (categoria.indicadores?.length ?? 0), 0);
  const diagnostico = revisarEstructura(draftStages, draftCategories);

  const updateStage = (idEtapa, field, value) => {
    setTieneCambios(true);
    setDraftStages((etapas) => etapas.map((etapa) => claveElemento(etapa) === idEtapa ? { ...etapa, [field]: value } : etapa));
  };


  const normalizedDraft = () => {
    const ordenadas = ordenarEstructura(draftStages, draftCategories);
    const categorias = ordenadas.categorias.map((categoria) => ({ ...categoria, maximo: Number(subtotalCategoria(categoria)), indicadores: categoria.indicadores.map((indicador) => ({ ...indicador, maximo: Number(decimalIndicador(indicador)) })) }));
    const etapas = ordenadas.etapas.map((etapa) => ({ ...etapa, maximo: Number(subtotalEtapa(etapa, categorias)) }));
    return { categorias, etapas };
  };

  const recargarVersion = async () => {
    const aviso = await Swal.fire({
      icon: 'warning',
      title: 'Descartar cambios locales',
      text: 'La recarga reemplazará lo escrito en esta pantalla con la versión actual del servidor.',
      showCancelButton: true,
      confirmButtonText: 'Descartar y recargar',
      cancelButtonText: 'Seguir editando',
    });
    if (!aviso.isConfirmed) return;
    setTieneCambios(false);
    setConflicto(false);
    try {
      await lectura.reintentar();
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No fue posible recargar', text: mensajeErrorEscrituraRubrica(error) });
    }
  };

  const saveDraft = async () => {
    if (guardando) return;
    if (diagnostico.errores.length) {
      await Swal.fire({ icon: 'warning', title: 'Revise los campos del borrador', text: diagnostico.errores.join('\n') });
      return;
    }
    if (esApi) {
      setGuardando(true);
      try {
        const revision = revisionEditada ?? rubrica.revision;
        const ordenada = ordenarEstructura(draftStages, draftCategories);
        const preparada = prepararVersionApiParaGuardar(
          { ...rubrica, revision, categorias: draftCategories },
          ordenada.etapas,
          ordenada.categorias,
        );
        const respuesta = await actualizarVersionRubricaApi(preparada);
        if (respuesta?.id !== rubrica.id || !Number.isInteger(respuesta.revision) || respuesta.revision <= revision) {
          throw new Error('La API guardó la solicitud, pero devolvió una revisión inválida. Recargue antes de volver a guardar.');
        }
        setRevisionEditada(respuesta.revision);
        setTieneCambios(false);
        setConflicto(false);
        await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Borrador guardado · revisión ${respuesta.revision}`, showConfirmButton: false, timer: 1800 });
        try {
          await lectura.reintentar();
        } catch {
          await Swal.fire({ icon: 'warning', title: 'Borrador guardado', text: 'El servidor confirmó el guardado, pero no fue posible recargar los datos. Use Reintentar para consultar la revisión actual.' });
        }
      } catch (error) {
        if (error?.status === 409) {
          setConflicto(true);
          await Swal.fire({
            icon: 'warning',
            title: 'El borrador cambió en el servidor',
            text: `${mensajeErrorEscrituraRubrica(error)} Sus cambios locales se conservarán. Use “Recargar versión” para descartarlos y consultar el servidor.`,
          });
        } else {
          await Swal.fire({ icon: 'error', title: 'No se guardó el borrador', text: mensajeErrorEscrituraRubrica(error) });
        }
      } finally {
        setGuardando(false);
      }
      return;
    }
    const normalized = normalizedDraft();
    despachar({ tipo: 'GUARDAR_VERSION_RUBRICA', idRubrica: rubrica.id, ...normalized });
    setTieneCambios(false);
    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Borrador guardado', showConfirmButton: false, timer: 1600 });
  };

  const activateDraft = async () => {
    if (diagnostico.pendientes.length) {
      await Swal.fire({ icon: 'warning', title: 'Estructura incompleta', text: 'Cada etapa debe tener categorías, indicadores y una valoración mayor que cero.' });
      return;
    }
    const normalized = normalizedDraft();
    const respuesta = await Swal.fire({
      icon: 'warning',
      title: '¿Activar esta versión?',
      text: 'Será la versión vigente para esta modalidad y período. Los trabajos y evaluaciones anteriores conservarán la versión que ya tienen asignada.',
      showCancelButton: true,
      confirmButtonText: 'Activar versión',
      cancelButtonText: 'Volver y revisar',
      reverseButtons: true,
    });
    if (!respuesta.isConfirmed) return;
    setTieneCambios(false);
    despachar({ tipo: 'GUARDAR_VERSION_RUBRICA', idRubrica: rubrica.id, ...normalized });
    despachar({ tipo: 'ACTIVAR_VERSION_RUBRICA', idRubrica: rubrica.id });
  };

  if (!rubrica && esApi && lectura.cargando) {
    return <><EncabezadoPagina title="Cargando rúbrica" description="Consultando la versión en PostgreSQL." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas', to: '/rubricas' }, { etiqueta: 'Cargando' }]} /><p role="status">Consultando rúbricas del backend…</p></>;
  }

  if (!rubrica && esApi && lectura.error) {
    return <><EncabezadoPagina title="No fue posible cargar la rúbrica" description="La API no respondió con datos disponibles." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas', to: '/rubricas' }, { etiqueta: 'Error' }]} /><AlertaInstitucional tono="danger" titulo="Error de consulta"><p>{lectura.error.message}</p><button className="button button-outline" type="button" onClick={lectura.reintentar}>Reintentar</button></AlertaInstitucional><VolverAlCatalogo esApi={esApi}>Volver al listado</VolverAlCatalogo></>;
  }

  if (!rubrica) {
    return (
      <>
        <EncabezadoPagina
          title="Rúbrica no encontrada"
          description={esApi ? 'La API no devolvió esta versión.' : 'La versión solicitada no existe en el prototipo.'}
          breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas', to: '/rubricas' }, { etiqueta: 'No encontrada' }]}
        />
      <AlertaInstitucional tono="info" titulo={esApi ? `Origen: API PostgreSQL - ${canEdit ? 'borrador editable' : 'solo lectura'}` : 'Origen: prototipo local'}>
        <p>{esApi ? canEdit ? 'Este borrador se edita en PostgreSQL. Active e históricas permanecen en consulta.' : 'Esta versión del backend es de solo lectura con la autorización actual.' : 'Esta versión pertenece a los datos simulados locales del prototipo.'}</p>
      </AlertaInstitucional>
        <section className="card"><div className="card-body"><EstadoVacio title="No se encontró esta versión" description="Regrese al listado para seleccionar una rúbrica disponible." accion={<VolverAlCatalogo esApi={esApi}>Volver a rúbricas</VolverAlCatalogo>} /></div></section>
      </>
    );
  }

  const presentation = esApi && rubrica.estado === 'BORRADOR'
    ? { etiqueta: canEdit ? 'Borrador editable' : 'Borrador - solo lectura', tono: 'progress', icono: FileClock }
    : statusPresentation[rubrica.estado] ?? { etiqueta: rubrica.estado, tono: 'neutral', icono: LockKeyhole };
  const StatusIcon = presentation.icono;

  return (
    <div className={`rubrica-detalle-page ${canEdit ? 'is-editable' : 'is-read-only'}`}>
      <EncabezadoPagina
        eyebrow={`${rubrica.modalidad} · ${rubrica.periodo}`}
        title={rubrica.titulo}
        description={`Versión ${rubrica.version} · ${canEdit ? 'Edición de estructura y valoraciones' : 'Consulta de estructura protegida'}`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas', to: '/rubricas' }, { etiqueta: rubrica.version }]}
        actions={<>
          {esApi && lectura.puedeAdministrar && rubrica?.idRubrica && <Link className="button button-primary" to={`/rubricas/${encodeURIComponent(rubrica.idRubrica)}/nueva-version/${encodeURIComponent(rubrica.id)}`}><GitBranch size={17} aria-hidden="true" /> Nueva versión</Link>}
          <VolverAlCatalogo esApi={esApi}>Volver al listado</VolverAlCatalogo>
        </>}
      />

      <AlertaInstitucional tono="info" titulo={esApi ? `Origen: API PostgreSQL - ${canEdit ? 'borrador editable' : 'solo lectura'}` : 'Origen: prototipo local'}>
        <p>{esApi ? canEdit ? 'Este borrador se edita en PostgreSQL. Active e históricas permanecen en consulta.' : 'Esta versión del backend es de solo lectura con la autorización actual.' : 'Esta versión pertenece a los datos simulados locales del prototipo.'}</p>
      </AlertaInstitucional>

      <section className="rubrica-version-hero" aria-labelledby="rubrica-version-title">
        <div className="rubrica-version-hero-heading">
          <span className="rubrica-version-hero-icon" aria-hidden="true"><StatusIcon size={24} /></span>
          <div>
            <span className="section-kicker">Versión consultada</span>
            <h2 id="rubrica-version-title">{rubrica.version} · {rubrica.modalidad}</h2>
            <p>{canEdit ? 'Los cambios pertenecen únicamente a este borrador.' : 'Esta versión permanece disponible únicamente para consulta.'}</p>
          </div>
          <InsigniaEstado estado={presentation.etiqueta} tono={presentation.tono} />
        </div>
        <dl className="rubrica-version-summary">
          <div><dt><CalendarRange size={16} /> Período</dt><dd>{rubrica.periodo}</dd></div>
          <div><dt><Scale size={16} /> Máximos por etapa · suma estructural</dt><dd>{puntos(maximumTotal)} puntos · no es nota final</dd></div>
          <div><dt><Layers3 size={16} /> Estructura</dt><dd>{visibleCategories.length} categorías · {indicatorCount} indicadores</dd></div>
          <div><dt><BookOpenCheck size={16} /> {esApi ? 'Vigencia por carrera' : 'Vigencia'}</dt><dd>{esApi ? describirVigenciaPorCarrera(rubrica.carreras) : (rubrica.vigenteDesde ? `Desde ${formatearFecha(rubrica.vigenteDesde)}` : 'Aún no activada')}{!esApi && rubrica.vigenteHasta ? ` hasta ${formatearFecha(rubrica.vigenteHasta)}` : ''}</dd></div>
        </dl>
      </section>

      <div className={`rubrica-editing-note ${canEdit ? 'is-editable' : 'is-protected'}`} role="note">
        {canEdit ? <FileClock size={21} aria-hidden="true" /> : <LockKeyhole size={21} aria-hidden="true" />}
        <div>
          <strong>{canEdit ? 'Borrador editable' : esApi ? 'Consulta API de solo lectura' : 'Versión protegida'}</strong>
          <p>{canEdit ? 'Puede construir categorías e indicadores dentro de las etapas escrita y oral. Guardar conserva el borrador y sus cambios pendientes de activación.' : esApi ? 'Esta versión de PostgreSQL está disponible solo para consulta con la autorización actual.' : 'No puede modificarse ni altera evaluaciones históricas. Para realizar cambios debe crearse una versión nueva.'}</p>
        </div>
      </div>

      <div className="rubrica-editor-intro">
        <div>
          <span className="section-kicker">Estructura de evaluación</span>
          <h2>Etapas, categorías e indicadores</h2>
          <p>El máximo de cada categoría es la suma de sus indicadores. El máximo de cada etapa suma sus categorías.</p>
        </div>
        <div className="rubrica-score-legend" aria-label="Leyenda de puntuaciones">
          <span><i className="is-indicator" /> Indicador</span>
          <span><i className="is-category" /> Categoría</span>
          <span><i className="is-stage" /> Etapa</span>
        </div>
      </div>

      {canEdit ? <>
        <AlertaInstitucional tono={diagnostico.pendientes.length ? 'warning' : 'info'} titulo={diagnostico.pendientes.length ? 'Pendiente para una futura activación' : 'Estructura completa'}>
          {diagnostico.pendientes.length ? <ul>{diagnostico.pendientes.map((mensaje) => <li key={mensaje}>{mensaje}</li>)}</ul> : <p>La estructura cumple las comprobaciones actuales de campos y subtotales. La activación API se gestionará en una etapa posterior.</p>}
        </AlertaInstitucional>
        <EditorEstructuraRubrica etapas={draftStages} categorias={draftCategories} esApi={esApi} bloqueado={guardando}
          cambiarEtapa={updateStage} cambiarCategorias={(categorias) => { setDraftCategories(categorias); setTieneCambios(true); }} />
      </> : visibleStages.map((etapa, stageIndex) => {
        const categorias = visibleCategories.filter((categoria) => categoria.etapa === etapa.id);
        const stageTotal = redondearCalificacion(categorias.reduce((total, categoria) => total + categoryMaximum(categoria), 0));
        return <section className="rubrica-editor-stage" key={etapa.id} aria-labelledby={`etapa-${etapa.id}-title`}>
          <header className="rubrica-editor-stage-heading">
            <span className="rubrica-stage-number" aria-hidden="true">{String(stageIndex + 1).padStart(2, '0')}</span>
            <div className="rubrica-stage-copy"><span className="section-kicker">{etapa.codigo}</span><h2 id={`etapa-${etapa.id}-title`}>{etapa.nombre}</h2><p>{etapa.descripcion}</p></div>
            <div className="rubrica-stage-score"><span>Máximo de etapa</span><strong>{puntos(stageTotal)}</strong><small>puntos de esta etapa</small></div>
          </header>
          <div className="rubrica-editor-categories">{categorias.map((categoria) => <article className="rubrica-editor-category" key={categoria.id} aria-labelledby={`categoria-${categoria.id}-title`}>
            <header className="rubrica-editor-category-heading">
              <div><span className="rubrica-category-code">Categoría {categoria.codigo}</span><h3 id={`categoria-${categoria.id}-title`}>{categoria.nombre}</h3></div>
              <div className="rubrica-category-score"><span>Máximo de categoría</span><strong>{puntos(categoryMaximum(categoria))} pts</strong></div>
            </header>
            <div className="rubrica-editor-indicators">{categoria.indicadores.map((indicador, indice) => <div className="rubrica-editor-indicator" key={indicador.id}>
              <span className="rubrica-indicator-index" aria-hidden="true">{categoria.codigo}.{indice + 1}</span>
              <div className="rubrica-indicator-copy"><p>{indicador.etiqueta}</p></div>
              <div className="rubrica-indicator-score"><label htmlFor={`maximo-${categoria.id}-${indicador.id}`}>Máximo del indicador</label><input id={`maximo-${categoria.id}-${indicador.id}`} className="calificacion-input" type="number" min="0" step="0.01" value={decimalIndicador(indicador)} readOnly /><small>Puntos</small></div>
            </div>)}</div>
            <footer className="rubrica-category-total"><span>Suma de indicadores · Categoría {categoria.codigo}</span><strong>{puntos(categoryMaximum(categoria))} puntos</strong></footer>
          </article>)}</div>
          <footer className="rubrica-stage-total"><span>Total de {etapa.nombreCorto ?? etapa.nombre}</span><strong>{puntos(stageTotal)} puntos</strong></footer>
        </section>;
      })}

      <section className="rubrica-values-summary" aria-labelledby="rubrica-summary-title">
        <header>
          <div><span className="section-kicker">Comprobación de máximos</span><h2 id="rubrica-summary-title">Resumen de valoraciones</h2><p>Esta suma describe la estructura y no es la calificación final de un estudiante. El resultado consultivo se expresa sobre 10.00.</p></div>
          <div className="rubrica-summary-total"><span>Suma de máximos por etapa</span><strong>{puntos(maximumTotal)}</strong><small>puntos</small></div>
        </header>
        <div className="rubrica-summary-grid">
          {visibleCategories.map((categoria) => <div key={`summary-${claveElemento(categoria)}`}><span>{categoria.codigo}. {categoria.nombre}</span><strong>{puntos(categoryMaximum(categoria))} pts</strong></div>)}
        </div>
      </section>

      {canEdit ? (
        <div className="rubrica-editor-actions" role="region" aria-label="Acciones del borrador">
          <div className={`rubrica-save-status ${tieneCambios ? 'has-changes' : 'is-saved'}`} aria-live="polite">
            {tieneCambios ? <FileClock size={18} /> : <CheckCircle2 size={18} />}
            <span><strong>{tieneCambios ? 'Cambios sin guardar' : 'Borrador actualizado'}</strong><small>{tieneCambios ? 'Guarde antes de salir.' : esApi ? `Revisión ${revisionEditada ?? rubrica.revision} - no hay cambios pendientes.` : 'No hay cambios pendientes.'}</small></span>
          </div>
          <div>
            {conflicto ? <button className="button button-outline" type="button" disabled={guardando} onClick={recargarVersion}>Recargar versión</button> : null}
            <button className="button button-outline" type="button" disabled={!tieneCambios || guardando} onClick={saveDraft}><Save size={17} /> {guardando ? 'Guardando...' : 'Guardar borrador'}</button>
            {canActivate ? <button className="button button-primary" type="button" onClick={activateDraft}><ShieldCheck size={17} /> Activar versión</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
