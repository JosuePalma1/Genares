import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import {
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  FileClock,
  Layers3,
  LockKeyhole,
  Save,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { BotonVolver, EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { ROL } from '../datos/datosPrototipo';
import { formatearFecha, obtenerEtapasRubrica, redondearCalificacion } from '../dominio/flujoTrabajo';
import { usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';

const statusPresentation = {
  ACTIVA: { etiqueta: 'Activa e inmutable', tono: 'success', icono: ShieldCheck },
  BORRADOR: { etiqueta: 'Borrador editable', tono: 'progress', icono: FileClock },
  ARCHIVADA: { etiqueta: 'Histórica e inmutable', tono: 'neutral', icono: LockKeyhole },
};

const clonar = (value) => JSON.parse(JSON.stringify(value ?? []));

function categoryMaximum(categoria) {
  return redondearCalificacion((categoria.indicadores ?? []).reduce((total, indicador) => total + Number(indicador.maximo || 0), 0));
}

export default function PaginaDetalleRubrica() {
  const { idRubrica } = useParams();
  const { estado, actorActual, despachar } = usarPrototipo();
  const rubrica = estado.versionesRubrica.find((elemento) => elemento.id === idRubrica);
  const [draftCategories, setDraftCategories] = useState([]);
  const [draftStages, setDraftStages] = useState([]);
  const [tieneCambios, setTieneCambios] = useState(false);
  usarAdvertenciaCambiosSinGuardar(tieneCambios, () => setTieneCambios(false));

  useEffect(() => {
    setDraftCategories(clonar(rubrica?.categorias));
    setDraftStages(clonar(rubrica ? obtenerEtapasRubrica(rubrica) : []));
    setTieneCambios(false);
  }, [rubrica?.id]);

  const puedeGestionar = actorActual?.roles.some((role) => role === ROL.COMISION || role === ROL.ADMIN);
  const canEdit = Boolean(rubrica && rubrica.estado === 'BORRADOR' && puedeGestionar);
  const visibleCategories = canEdit ? draftCategories : (rubrica?.categorias ?? []);
  const visibleStages = canEdit ? draftStages : (rubrica ? obtenerEtapasRubrica(rubrica) : []);
  const maximumTotal = useMemo(
    () => redondearCalificacion(visibleCategories.reduce((total, categoria) => total + categoryMaximum(categoria), 0)),
    [visibleCategories],
  );
  const indicatorCount = visibleCategories.reduce((total, categoria) => total + (categoria.indicadores?.length ?? 0), 0);

  const updateStage = (idEtapa, field, value) => {
    setTieneCambios(true);
    setDraftStages((etapas) => etapas.map((etapa) => etapa.id === idEtapa ? { ...etapa, [field]: value } : etapa));
  };

  const actualizarNombreCategoria = (idCategoria, nombre) => {
    setTieneCambios(true);
    setDraftCategories((categorias) => categorias.map((categoria) => categoria.id === idCategoria ? { ...categoria, nombre } : categoria));
  };

  const updateIndicator = (categoryId, indicatorId, field, value) => {
    setTieneCambios(true);
    setDraftCategories((categorias) => categorias.map((categoria) => {
      if (categoria.id !== categoryId) return categoria;
      return {
        ...categoria,
        indicadores: categoria.indicadores.map((indicador) => indicador.id === indicatorId ? {
          ...indicador,
          [field]: field === 'maximo' ? redondearCalificacion(Math.max(0, Number(value) || 0)) : value,
        } : indicador),
      };
    }));
  };

  const normalizedDraft = () => {
    const categorias = draftCategories.map((categoria) => ({ ...categoria, maximo: categoryMaximum(categoria) }));
    const etapas = draftStages.map((etapa) => ({
      ...etapa,
      maximo: redondearCalificacion(categorias.filter((categoria) => categoria.etapa === etapa.id).reduce((suma, categoria) => suma + categoria.maximo, 0)),
    }));
    return { categorias, etapas };
  };

  const saveDraft = async () => {
    const normalized = normalizedDraft();
    despachar({ tipo: 'GUARDAR_VERSION_RUBRICA', idRubrica: rubrica.id, ...normalized });
    setTieneCambios(false);
    await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Borrador guardado', showConfirmButton: false, timer: 1600 });
  };

  const activateDraft = async () => {
    const normalized = normalizedDraft();
    const invalid = normalized.etapas.some((etapa) => etapa.maximo <= 0 || !normalized.categorias.some((categoria) => categoria.etapa === etapa.id && categoria.indicadores?.length));
    if (invalid) {
      await Swal.fire({ icon: 'warning', title: 'Estructura incompleta', text: 'Cada etapa debe tener categorías, indicadores y una valoración mayor que cero.' });
      return;
    }
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

  if (!rubrica) {
    return <><EncabezadoPagina title="Rúbrica no encontrada" description="La versión solicitada no existe en el prototipo." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas', to: '/rubricas' }, { etiqueta: 'No encontrada' }]} /><section className="card"><div className="card-body"><EstadoVacio title="No se encontró esta versión" description="Regrese al listado para seleccionar una rúbrica disponible." accion={<BotonVolver respaldo="/rubricas">Volver a rúbricas</BotonVolver>} /></div></section></>;
  }

  const presentation = statusPresentation[rubrica.estado] ?? { etiqueta: rubrica.estado, tono: 'neutral', icono: LockKeyhole };
  const StatusIcon = presentation.icono;

  return (
    <div className={`rubrica-detalle-page ${canEdit ? 'is-editable' : 'is-read-only'}`}>
      <EncabezadoPagina
        eyebrow={`${rubrica.modalidad} · ${rubrica.periodo}`}
        title={rubrica.titulo}
        description={`Versión ${rubrica.version} · ${canEdit ? 'Edición de estructura y valoraciones' : 'Consulta de estructura protegida'}`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas', to: '/rubricas' }, { etiqueta: rubrica.version }]}
        actions={<BotonVolver respaldo="/rubricas">Volver al listado</BotonVolver>}
      />

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
          <div><dt><Scale size={16} /> Puntaje total</dt><dd>{maximumTotal.toFixed(2)} puntos</dd></div>
          <div><dt><Layers3 size={16} /> Estructura</dt><dd>{visibleCategories.length} categorías · {indicatorCount} indicadores</dd></div>
          <div><dt><BookOpenCheck size={16} /> Vigencia</dt><dd>{rubrica.vigenteDesde ? `Desde ${formatearFecha(rubrica.vigenteDesde)}` : 'Aún no activada'}{rubrica.vigenteHasta ? ` hasta ${formatearFecha(rubrica.vigenteHasta)}` : ''}</dd></div>
        </dl>
      </section>

      <div className={`rubrica-editing-note ${canEdit ? 'is-editable' : 'is-protected'}`} role="note">
        {canEdit ? <FileClock size={21} aria-hidden="true" /> : <LockKeyhole size={21} aria-hidden="true" />}
        <div>
          <strong>{canEdit ? 'Borrador editable' : 'Versión protegida'}</strong>
          <p>{canEdit ? 'Puede ajustar los textos y máximos existentes. Guardar conserva el borrador; activar lo convierte en la versión vigente.' : 'No puede modificarse ni altera evaluaciones históricas. Para realizar cambios debe crearse una versión nueva.'}</p>
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

      {visibleStages.map((etapa, stageIndex) => {
        const categorias = visibleCategories.filter((categoria) => categoria.etapa === etapa.id);
        const stageTotal = redondearCalificacion(categorias.reduce((total, categoria) => total + categoryMaximum(categoria), 0));
        const stageNameId = `etapa-${etapa.id}-nombre`;
        const stageDescriptionId = `etapa-${etapa.id}-descripcion`;
        return (
          <section className="rubrica-editor-stage" key={etapa.id} aria-label={canEdit ? `${etapa.codigo}: ${etapa.nombre}` : undefined} aria-labelledby={canEdit ? undefined : `etapa-${etapa.id}-title`}>
            <header className="rubrica-editor-stage-heading">
              <span className="rubrica-stage-number" aria-hidden="true">{String(stageIndex + 1).padStart(2, '0')}</span>
              <div className="rubrica-stage-copy">
                <span className="section-kicker">{String(etapa.codigo).replaceAll('_', ' ')}</span>
                {canEdit ? (
                  <div className="rubrica-stage-fields">
                    <div className="field">
                      <label htmlFor={stageNameId}>Nombre de la etapa</label>
                      <input className="input" id={stageNameId} value={etapa.nombre} onChange={(evento) => updateStage(etapa.id, 'nombre', evento.target.value)} />
                    </div>
                    <div className="field">
                      <label htmlFor={stageDescriptionId}>Descripción de la etapa</label>
                      <input className="input" id={stageDescriptionId} value={etapa.descripcion ?? ''} onChange={(evento) => updateStage(etapa.id, 'descripcion', evento.target.value)} />
                    </div>
                  </div>
                ) : (
                  <><h2 id={`etapa-${etapa.id}-title`}>{etapa.nombre}</h2><p>{etapa.descripcion}</p></>
                )}
              </div>
              <div className="rubrica-stage-score"><span>Máximo de etapa</span><strong>{stageTotal.toFixed(2)}</strong><small>puntos</small></div>
            </header>

            <div className="rubrica-editor-categories">
              {categorias.map((categoria) => {
                const categoryTotal = categoryMaximum(categoria);
                const categoryNameId = `categoria-${categoria.id}-nombre`;
                return (
                  <article className="rubrica-editor-category" key={categoria.id} aria-label={canEdit ? `Categoría ${categoria.codigo}: ${categoria.nombre}` : undefined} aria-labelledby={canEdit ? undefined : `categoria-${categoria.id}-title`}>
                    <header className="rubrica-editor-category-heading">
                      <div>
                        <span className="rubrica-category-code">Categoría {categoria.codigo}</span>
                        {canEdit ? (
                          <div className="field">
                            <label htmlFor={categoryNameId}>Nombre de la categoría</label>
                            <input className="input" id={categoryNameId} value={categoria.nombre} onChange={(evento) => actualizarNombreCategoria(categoria.id, evento.target.value)} />
                          </div>
                        ) : <h3 id={`categoria-${categoria.id}-title`}>{categoria.nombre}</h3>}
                      </div>
                      <div className="rubrica-category-score"><span>Máximo de categoría</span><strong>{categoryTotal.toFixed(2)} pts</strong></div>
                    </header>

                    <div className="rubrica-editor-indicators">
                      {categoria.indicadores.map((indicador, indice) => {
                        const indicatorLabelId = `indicador-${categoria.id}-${indicador.id}-texto`;
                        const indicatorMaxId = `maximo-${categoria.id}-${indicador.id}`;
                        return (
                          <div className="rubrica-editor-indicator" key={indicador.id}>
                            <div className="rubrica-indicator-index" aria-hidden="true">{categoria.codigo}.{indice + 1}</div>
                            <div className="rubrica-indicator-copy">
                              {canEdit ? (
                                <div className="field">
                                  <label htmlFor={indicatorLabelId}>Descripción del indicador {categoria.codigo}.{indice + 1}</label>
                                  <textarea className="textarea" id={indicatorLabelId} value={indicador.etiqueta} onChange={(evento) => updateIndicator(categoria.id, indicador.id, 'etiqueta', evento.target.value)} />
                                </div>
                              ) : <p>{indicador.etiqueta}</p>}
                            </div>
                            <div className="rubrica-indicator-score">
                              <label htmlFor={indicatorMaxId}>Máximo del indicador</label>
                              <input
                                className="calificacion-input"
                                id={indicatorMaxId}
                                type="number"
                                min="0"
                                step="0.01"
                                value={indicador.maximo}
                                readOnly={!canEdit}
                                onChange={(evento) => updateIndicator(categoria.id, indicador.id, 'maximo', evento.target.value)}
                              />
                              <small>Puntos</small>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <footer className="rubrica-category-total"><span>Suma de indicadores · Categoría {categoria.codigo}</span><strong>{categoryTotal.toFixed(2)} puntos</strong></footer>
                  </article>
                );
              })}
            </div>

            <footer className="rubrica-stage-total"><span>Total de {etapa.nombreCorto ?? etapa.nombre}</span><strong>{stageTotal.toFixed(2)} puntos</strong></footer>
          </section>
        );
      })}

      <section className="rubrica-values-summary" aria-labelledby="rubrica-summary-title">
        <header>
          <div><span className="section-kicker">Comprobación de máximos</span><h2 id="rubrica-summary-title">Resumen de valoraciones</h2><p>Totales calculados a partir de los indicadores de esta versión.</p></div>
          <div className="rubrica-summary-total"><span>Total de la rúbrica</span><strong>{maximumTotal.toFixed(2)}</strong><small>puntos</small></div>
        </header>
        <div className="rubrica-summary-grid">
          {visibleCategories.map((categoria) => <div key={`summary-${categoria.id}`}><span>{categoria.codigo}. {categoria.nombre}</span><strong>{categoryMaximum(categoria).toFixed(2)} pts</strong></div>)}
        </div>
      </section>

      {canEdit ? (
        <div className="rubrica-editor-actions" role="region" aria-label="Acciones del borrador">
          <div className={`rubrica-save-status ${tieneCambios ? 'has-changes' : 'is-saved'}`} aria-live="polite">
            {tieneCambios ? <FileClock size={18} /> : <CheckCircle2 size={18} />}
            <span><strong>{tieneCambios ? 'Cambios sin guardar' : 'Borrador actualizado'}</strong><small>{tieneCambios ? 'Guarde antes de salir o activar la versión.' : 'No hay cambios pendientes.'}</small></span>
          </div>
          <div>
            <button className="button button-outline" type="button" onClick={saveDraft}><Save size={17} /> Guardar borrador</button>
            <button className="button button-primary" type="button" onClick={activateDraft}><ShieldCheck size={17} /> Activar versión</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
