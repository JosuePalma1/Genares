import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { ROL } from '../datos/datosPrototipo';
import { formatearFecha, obtenerEtapasRubrica, redondearCalificacion } from '../dominio/flujoTrabajo';
import { usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';

const statusPresentation = {
  ACTIVA: { etiqueta: 'Activa e inmutable', tono: 'success' },
  BORRADOR: { etiqueta: 'Borrador editable', tono: 'progress' },
  ARCHIVADA: { etiqueta: 'Histórica e inmutable', tono: 'neutral' },
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
      confirmButtonColor: '#123f68',
    });
    if (!respuesta.isConfirmed) return;
    setTieneCambios(false);
    despachar({ tipo: 'GUARDAR_VERSION_RUBRICA', idRubrica: rubrica.id, ...normalized });
    despachar({ tipo: 'ACTIVAR_VERSION_RUBRICA', idRubrica: rubrica.id });
  };

  if (!rubrica) {
    return <><EncabezadoPagina title="Rúbrica no encontrada" description="La versión solicitada no existe en el prototipo." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas', to: '/rubricas' }, { etiqueta: 'No encontrada' }]} /><section className="card"><div className="card-body"><EstadoVacio title="No se encontró esta versión" description="Regrese al listado para seleccionar una rúbrica disponible." accion={<Link className="button button-primary" to="/rubricas">Volver a rúbricas</Link>} /></div></section></>;
  }

  const presentation = statusPresentation[rubrica.estado] ?? { etiqueta: rubrica.estado, tono: 'neutral' };

  return (
    <>
      <EncabezadoPagina
        eyebrow={`${rubrica.modalidad} · ${rubrica.periodo}`}
        title={rubrica.titulo}
        description={`Versión ${rubrica.version}. La estructura se obtiene de sus etapas, categorías e indicadores.`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas', to: '/rubricas' }, { etiqueta: rubrica.version }]}
        actions={<div className="header-actions"><Link className="button button-outline" to="/rubricas">Volver</Link>{canEdit ? <><button className="button button-outline" type="button" onClick={saveDraft}>Guardar borrador</button><button className="button button-primary" type="button" onClick={activateDraft}>Activar versión</button></> : null}</div>}
      />

      <section className="card"><div className="card-header"><h2>Identificación de la versión</h2><InsigniaEstado estado={presentation.etiqueta} tono={presentation.tono} /></div><div className="card-body"><dl className="info-list"><div><dt>Modalidad</dt><dd>{rubrica.modalidad}</dd></div><div><dt>Período de vigencia</dt><dd>{rubrica.periodo}</dd></div><div><dt>Versión</dt><dd>{rubrica.version}</dd></div><div><dt>Puntaje máximo</dt><dd>{maximumTotal.toFixed(2)} puntos</dd></div><div><dt>Vigente desde</dt><dd>{formatearFecha(rubrica.vigenteDesde)}</dd></div><div><dt>Vigente hasta</dt><dd>{rubrica.vigenteHasta ? formatearFecha(rubrica.vigenteHasta) : 'Sin fecha de cierre'}</dd></div></dl></div></section>

      <div className={`alert ${canEdit ? 'alert-info' : 'alert-warning'}`}><span aria-hidden="true">{canEdit ? 'ⓘ' : '!'}</span><div><strong>{canEdit ? 'Borrador editable' : 'Versión protegida'}</strong>{canEdit ? 'Los cambios solo afectan este borrador. Debe guardarlo y activarlo para usarlo en trabajos nuevos.' : 'Esta estructura no se modifica. Una nueva versión se crea como copia independiente.'}</div></div>

      {visibleStages.map((etapa) => {
        const categorias = visibleCategories.filter((categoria) => categoria.etapa === etapa.id);
        const stageTotal = redondearCalificacion(categorias.reduce((total, categoria) => total + categoryMaximum(categoria), 0));
        return (
          <section className="rubrica-section" key={etapa.id}>
            <div className="rubrica-section-header"><div><span className="prototype-note">{String(etapa.codigo).replaceAll('_', ' ')}</span>{canEdit ? <><input className="input" aria-label={`Nombre de la etapa ${etapa.codigo}`} value={etapa.nombre} onChange={(evento) => updateStage(etapa.id, 'nombre', evento.target.value)} /><input className="input mt-2" aria-label={`Descripción de la etapa ${etapa.codigo}`} value={etapa.descripcion ?? ''} onChange={(evento) => updateStage(etapa.id, 'descripcion', evento.target.value)} /></> : <><h2>{etapa.nombre}</h2><p className="text-muted mb-0">{etapa.descripcion}</p></>}</div><InsigniaEstado estado={`${stageTotal.toFixed(2)} puntos`} tono="info" /></div>
            {categorias.map((categoria) => (
              <article key={categoria.id}>
                <div className="card-header"><div><span className="prototype-note">Categoría {categoria.codigo}</span>{canEdit ? <input className="input" aria-label={`Nombre de la categoría ${categoria.codigo}`} value={categoria.nombre} onChange={(evento) => actualizarNombreCategoria(categoria.id, evento.target.value)} /> : <h3 className="mb-0">{categoria.nombre}</h3>}</div><InsigniaEstado estado={`${categoryMaximum(categoria).toFixed(2)} puntos`} tono="neutral" /></div>
                {categoria.indicadores.map((indicador, indice) => <div className="criterion" key={indicador.id}><div className="criterion-title"><strong>{categoria.codigo}.{indice + 1}</strong>{canEdit ? <input className="input" aria-label={`Nombre del indicador ${categoria.codigo}.${indice + 1}`} value={indicador.etiqueta} onChange={(evento) => updateIndicator(categoria.id, indicador.id, 'etiqueta', evento.target.value)} /> : <p>{indicador.etiqueta}</p>}</div><div className="calificacion-control"><label htmlFor={`maximo-${categoria.id}-${indicador.id}`}>Valoración máxima</label><input className="calificacion-input" id={`maximo-${categoria.id}-${indicador.id}`} type="number" min="0" step="0.01" value={indicador.maximo} readOnly={!canEdit} onChange={(evento) => updateIndicator(categoria.id, indicador.id, 'maximo', evento.target.value)} /></div><div className="criterion-note"><InsigniaEstado estado={canEdit ? 'Editable en borrador' : 'Conservado'} tono={canEdit ? 'progress' : 'success'} /></div></div>)}
                <div className="rubrica-subtotal"><span>Total categoría {categoria.codigo}</span><span>{categoryMaximum(categoria).toFixed(2)} puntos</span></div>
              </article>
            ))}
            <div className="rubrica-subtotal"><span>Total {etapa.nombreCorto ?? etapa.nombre}</span><span>{stageTotal.toFixed(2)} puntos</span></div>
          </section>
        );
      })}

      <section className="card"><div className="card-header"><div><h2>Resumen de valoraciones</h2><p className="text-muted mb-0">El resumen se genera con las categorías de esta versión.</p></div><InsigniaEstado estado={`${maximumTotal.toFixed(2)} puntos`} tono="success" /></div><div className="card-body calificacion-breakdown">{visibleCategories.map((categoria) => <div className="calificacion-row" key={`summary-${categoria.id}`}><span>{categoria.codigo}. {categoria.nombre}</span><strong>{categoryMaximum(categoria).toFixed(2)}</strong></div>)}</div></section>
    </>
  );
}
