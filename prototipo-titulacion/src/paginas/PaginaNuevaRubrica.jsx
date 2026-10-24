import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { AlertaInstitucional, EncabezadoPagina } from '../componentes/interfaz';
import { FUENTE_RUBRICAS, ESCRITURA_RUBRICAS_API_HABILITADA } from '../configuracion/rubricas';
import {
  agregarCategoriaRubrica,
  agregarEtapaRubrica,
  agregarIndicadorRubrica,
  cambiarCategoriaRubrica,
  cambiarEtapaRubrica,
  cambiarIndicadorRubrica,
  crearEstructuraInicialRubrica,
  eliminarCategoriaRubrica,
  eliminarEtapaRubrica,
  eliminarIndicadorRubrica,
  formatearCentesimas,
  moverElementoRubrica,
  resumenPonderacionEtapa,
  subtotalCategoriaCompleta,
  validarRubricaCompleta,
} from '../dominio/creacionRubricaCompleta';
import { prepararClonVersionRubrica } from '../dominio/clonacionVersionRubrica';
import { usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';
import { cargarCarrerasApi } from '../servicios/carrerasApi';
import {
  cargarCapacidadesRubricasApi,
  cargarCatalogosRubricasApi,
  cargarRubricasApi,
  crearRubricaCompletaApi,
  crearVersionCompletaRubricaApi,
} from '../servicios/rubricasApi';
import './rubricaCompleta.css';

const SCOPE_OPTIONS = [
  { value: 'TRABAJO_COMPARTIDO', label: 'Por trabajo (se traspasa a cada estudiante)' },
  { value: 'ESTUDIANTE_INDIVIDUAL', label: 'Por estudiante' },
];

export function enfocarResumenErroresRubrica(documento = globalThis.document) {
  const titulo = documento?.getElementById('rubrica-completa-errors-title');
  if (!titulo) return false;
  titulo.focus();
  return true;
}

function vigenteActual(versiones, modalidadId, periodoId, carreraId) {
  if (!modalidadId || !periodoId || !carreraId) return null;
  return versiones.find((version) => (
    version.modalidadId === modalidadId
    && version.periodoId === periodoId
    && version.carreras?.some((carrera) => carrera.id === carreraId && carrera.vigente)
  ))?.id ?? null;
}

function mensajeError(error) {
  if (error?.status === 409) return 'La revisión de una carrera o su vigencia cambió mientras preparaba esta rúbrica. Sus datos siguen en el editor; actualice carreras y vigencias antes de volver a guardar.';
  if (error?.status === 400) return error.message || 'El servidor rechazó algunos datos. Revise las etapas y sus ponderaciones.';
  if (error?.status === 401) return 'El servidor no habilitó el guardado en el entorno actual.';
  if (error?.status === 403) return 'El servidor denegó la creación. Sus datos siguen en el editor.';
  if (error?.status >= 500) return 'El servidor no pudo completar el guardado. Sus datos siguen en el editor.';
  return error?.message || 'No fue posible guardar la rúbrica. Sus datos siguen en el editor.';
}

function BotonesOrden({ etiqueta, indice, longitud, bloqueado, mover, eliminar }) {
  return <div className="rubrica-completa-actions" role="group" aria-label={`Acciones de ${etiqueta}`}>
    <button className="button button-outline button-sm" type="button" disabled={bloqueado || indice === 0} aria-label={`Subir ${etiqueta}`} onClick={() => mover(-1)}><ArrowUp size={15} aria-hidden="true" /></button>
    <button className="button button-outline button-sm" type="button" disabled={bloqueado || indice === longitud - 1} aria-label={`Bajar ${etiqueta}`} onClick={() => mover(1)}><ArrowDown size={15} aria-hidden="true" /></button>
    <button className="button button-outline button-sm rubrica-completa-delete" type="button" disabled={bloqueado} aria-label={`Eliminar ${etiqueta}`} onClick={eliminar}><Trash2 size={15} aria-hidden="true" /></button>
  </div>;
}

export default function PaginaNuevaRubrica() {
  const navigate = useNavigate();
  const { idRubrica, idVersion } = useParams();
  const clonandoVersion = Boolean(idRubrica && idVersion);
  const esApi = FUENTE_RUBRICAS === 'api';
  const [contexto, setContexto] = useState(null);
  const [cargando, setCargando] = useState(esApi);
  const [actualizando, setActualizando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);
  const [datos, setDatos] = useState(() => ({ modalidadId: '', periodoId: '', nombre: '', version: '', etapas: crearEstructuraInicialRubrica() }));
  const [seleccionCarreras, setSeleccionCarreras] = useState({});
  const [tieneCambios, setTieneCambios] = useState(false);
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [conflicto, setConflicto] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const envioEnCurso = useRef(false);
  const versionPrecargada = useRef(null);
  usarAdvertenciaCambiosSinGuardar(tieneCambios, () => setTieneCambios(false));

  const cargarContexto = useCallback(async (signal) => {
    if (!esApi) return;
    setActualizando(true);
    setCargando(true);
    setErrorCarga(null);
    try {
      const [rubricas, capacidades, catalogos, carreras] = await Promise.all([
        cargarRubricasApi({ signal }),
        cargarCapacidadesRubricasApi({ signal }),
        cargarCatalogosRubricasApi({ signal }),
        cargarCarrerasApi({ signal }),
      ]);
      if (signal?.aborted) return;
      const nuevoContexto = { rubricas, capacidades, catalogos, carreras: carreras.filter((carrera) => carrera.estaActivo) };
      setContexto(nuevoContexto);
      setErrorCarga(null);
      return nuevoContexto;
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') return;
      setErrorCarga(error instanceof Error ? error : new Error('No fue posible consultar los datos de configuración.'));
      return false;
    } finally {
      if (!signal?.aborted) {
        setCargando(false);
        setActualizando(false);
      }
    }
  }, [esApi]);

  const versionBase = clonandoVersion
    ? contexto?.rubricas.find((version) => version.id === idVersion && version.idRubrica === idRubrica)
    : null;

  useEffect(() => {
    if (!clonandoVersion || !versionBase || versionPrecargada.current === idVersion) return;
    const clon = prepararClonVersionRubrica(versionBase);
    setDatos(clon.datos);
    setSeleccionCarreras(clon.seleccionCarreras);
    setIntentoGuardar(false);
    setTieneCambios(false);
    versionPrecargada.current = idVersion;
  }, [clonandoVersion, idVersion, versionBase]);

  useEffect(() => {
    if (!esApi) return undefined;
    const controlador = new AbortController();
    cargarContexto(controlador.signal);
    return () => controlador.abort();
  }, [esApi, cargarContexto]);

  const puedeCrear = Boolean(
    esApi
    && contexto?.capacidades.puedeAdministrar
    && ESCRITURA_RUBRICAS_API_HABILITADA,
  );
  const carrerasActivas = contexto?.carreras ?? [];
  const carrerasElegidas = useMemo(() => carrerasActivas.filter((carrera) => seleccionCarreras[carrera.id]), [carrerasActivas, seleccionCarreras]);
  const carrerasDto = carrerasElegidas.map((carrera) => ({
    carreraId: carrera.id,
    revision: carrera.revision,
    vigente: seleccionCarreras[carrera.id].vigente,
    vigenciaEsperada: { versionId: vigenteActual(contexto?.rubricas ?? [], datos.modalidadId, datos.periodoId, carrera.id) },
  }));
  const formulario = {
    ...datos,
    version: clonandoVersion ? 'V1' : datos.version,
    carreras: carrerasDto,
  };
  const errores = useMemo(() => intentoGuardar ? validarRubricaCompleta(formulario) : [], [
    intentoGuardar, datos, carrerasDto,
  ]);
  const resumenes = datos.etapas.map((etapa) => resumenPonderacionEtapa(etapa));

  function cambiarDato(campo, valor) {
    setDatos((actual) => ({ ...actual, [campo]: valor }));
    setTieneCambios(true);
  }

  function cambiarEtapas(etapas) {
    setDatos((actual) => ({ ...actual, etapas }));
    setTieneCambios(true);
  }

  function actualizarCarrera(carreraId, seleccionado) {
    setSeleccionCarreras((actual) => {
      const siguiente = { ...actual };
      if (seleccionado) siguiente[carreraId] = siguiente[carreraId] ?? { vigente: false };
      else delete siguiente[carreraId];
      return siguiente;
    });
    setTieneCambios(true);
  }

  function cambiarVigencia(carreraId, vigente) {
    setSeleccionCarreras((actual) => ({ ...actual, [carreraId]: { ...actual[carreraId], vigente } }));
    setTieneCambios(true);
  }

  async function eliminarConConfirmacion(etiqueta, detalle, eliminar, enfocarId) {
    const confirmacion = await Swal.fire({
      icon: 'warning', title: `Eliminar ${etiqueta}`, text: detalle,
      showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Conservar', reverseButtons: true,
    });
    if (!confirmacion.isConfirmed) return;
    eliminar();
    setTieneCambios(true);
    setAnuncio(`${etiqueta} eliminada del editor.`);
    requestAnimationFrame(() => document.getElementById(enfocarId)?.focus());
  }

  async function cancelar() {
    if (tieneCambios) {
      const confirmacion = await Swal.fire({
        icon: 'warning', title: clonandoVersion ? '¿Descartar esta nueva versión?' : '¿Descartar la rúbrica?',
        text: 'Los datos escritos en este editor se perderán.',
        showCancelButton: true, confirmButtonText: 'Descartar y salir', cancelButtonText: 'Seguir editando', reverseButtons: true,
      });
      if (!confirmacion.isConfirmed) return;
    }
    setTieneCambios(false);
    navigate('/rubricas');
  }

  async function recargarVersionBase() {
    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: 'Descartar cambios y recargar versión base',
      text: 'Se reemplazarán la estructura editada, la revisión base y las vigencias con los datos actuales del servidor.',
      showCancelButton: true,
      confirmButtonText: 'Descartar y recargar',
      cancelButtonText: 'Seguir editando',
      reverseButtons: true,
    });
    if (!confirmacion.isConfirmed) return;
    const actualizado = await cargarContexto();
    const baseActualizada = actualizado?.rubricas.find((version) => version.id === idVersion && version.idRubrica === idRubrica);
    if (!baseActualizada) {
      setErrorCarga(new Error('La versión base ya no está disponible en la familia consultada.'));
      return;
    }
    const clon = prepararClonVersionRubrica(baseActualizada);
    setDatos(clon.datos);
    setSeleccionCarreras(clon.seleccionCarreras);
    setTieneCambios(false);
    setIntentoGuardar(false);
    setConflicto(false);
    versionPrecargada.current = idVersion;
  }

  async function guardar(evento) {
    evento.preventDefault();
    if (!puedeCrear || guardando || envioEnCurso.current || conflicto || actualizando || (clonandoVersion && !versionBase)) return;
    envioEnCurso.current = true;
    setIntentoGuardar(true);
    const problemas = validarRubricaCompleta(formulario);
    if (problemas.length) {
      requestAnimationFrame(() => enfocarResumenErroresRubrica(document));
      envioEnCurso.current = false;
      return;
    }
    const vigencias = carrerasDto.filter((carrera) => carrera.vigente).map((carrera) => (
      carrerasActivas.find((elemento) => elemento.id === carrera.carreraId)?.nombre
    )).filter(Boolean);
    const confirmacion = await Swal.fire({
      icon: 'question',
      title: clonandoVersion ? 'Crear nueva versión completa' : 'Guardar rúbrica completa',
      text: clonandoVersion
        ? `Basada en ${versionBase.version} · el servidor asignará el identificador de versión · ${carrerasDto.length} ${carrerasDto.length === 1 ? 'carrera' : 'carreras'}${vigencias.length ? ` · vigencia explícita para: ${vigencias.join(', ')}` : ' · sin establecer vigencia'}.`
        : `${datos.nombre.trim()} · versión ${datos.version.trim()} · ${carrerasDto.length} ${carrerasDto.length === 1 ? 'carrera' : 'carreras'}${vigencias.length ? ` · vigencia explícita para: ${vigencias.join(', ')}` : ' · sin establecer vigencia'}.`,
      showCancelButton: true,
      confirmButtonText: clonandoVersion ? 'Crear versión' : 'Guardar rúbrica',
      cancelButtonText: 'Volver al editor',
      reverseButtons: true,
    });
    if (!confirmacion.isConfirmed) {
      envioEnCurso.current = false;
      return;
    }

    setGuardando(true);
    try {
      const respuesta = clonandoVersion
        ? await crearVersionCompletaRubricaApi({ ...formulario, versionBase })
        : await crearRubricaCompletaApi(formulario);
      if (!respuesta || typeof respuesta.id !== 'string' || !respuesta.rubrica?.id) {
        throw new Error('La API no devolvió el identificador de la versión creada. Compruebe el catálogo antes de repetir el guardado.');
      }
      setTieneCambios(false);
      const pudoRecargar = await cargarContexto();
      await Swal.fire({
        icon: pudoRecargar ? 'success' : 'warning',
        title: pudoRecargar
          ? clonandoVersion ? 'Nueva versión creada' : 'Rúbrica guardada'
          : clonandoVersion ? 'Versión creada; catálogo pendiente' : 'Rúbrica guardada; catálogo pendiente',
        text: pudoRecargar
          ? `Se creó la versión ${respuesta.version} y quedó asociada a las carreras seleccionadas. La versión de origen conserva su estructura e identificadores.`
          : 'El servidor confirmó el guardado, pero no se pudo actualizar la lectura. Consulte el catálogo antes de volver a guardar.',
        confirmButtonText: 'Continuar',
      });
      navigate(pudoRecargar ? `/rubricas/${encodeURIComponent(respuesta.id)}` : '/rubricas');
    } catch (error) {
      if (error?.status === 409) setConflicto(true);
      await Swal.fire({
        icon: error?.status === 409 ? 'warning' : 'error',
        title: error?.status === 409 ? 'Cambió la configuración' : 'No se guardó la rúbrica',
        text: mensajeError(error),
      });
    } finally {
      setGuardando(false);
      envioEnCurso.current = false;
    }
  }

  if (!esApi) {
    return <div className="rubrica-completa-page">
      <EncabezadoPagina eyebrow="Configuración académica" title={clonandoVersion ? 'Nueva versión de rúbrica' : 'Nueva rúbrica'} description="Editor integral de etapas, categorías e indicadores." breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas', to: '/rubricas' }, { etiqueta: clonandoVersion ? 'Nueva versión' : 'Nueva rúbrica' }]} />
      <AlertaInstitucional tono="info" titulo={clonandoVersion ? 'Clonación no disponible en modo prototipo' : 'Alta institucional no disponible en modo prototipo'}>
        <p>Este modo usa datos de demostración y no registra rúbricas en PostgreSQL. Cambie a la fuente API con autorización administrativa para crear y asignar vigencias.</p>
      </AlertaInstitucional>
      <button className="button button-outline" type="button" onClick={() => navigate('/rubricas')}><ArrowLeft size={17} /> Volver a Rúbricas</button>
    </div>;
  }

  const categoriasDisponibles = contexto?.catalogos.modalidades.length > 0 && contexto?.catalogos.periodos.length > 0 && carrerasActivas.length > 0;
  const periodosDisponibles = contexto?.catalogos.periodos ?? [];
  const periodosSelector = clonandoVersion && versionBase
    && !periodosDisponibles.some((periodo) => periodo.id === versionBase.periodoId)
    ? [...periodosDisponibles, { id: versionBase.periodoId, codigo: versionBase.periodo }]
    : periodosDisponibles;

  return <div className="rubrica-completa-page">
    <EncabezadoPagina
      eyebrow="Configuración académica"
      title={clonandoVersion ? 'Nueva versión de rúbrica' : 'Nueva rúbrica'}
      description={clonandoVersion
        ? `Basada en la versión ${versionBase?.version ?? '…'}. La versión de origen se conserva sin cambios.`
        : 'Configure en una sola operación sus carreras, vigencias, etapas, categorías e indicadores.'}
      breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Rúbricas', to: '/rubricas' }, { etiqueta: clonandoVersion ? 'Nueva versión' : 'Nueva rúbrica' }]}
      actions={<button className="button button-outline" type="button" onClick={cancelar}><ArrowLeft size={17} /> Cancelar</button>}
    />

    {cargando && <p role="status" className="rubrica-completa-loading">Consultando modalidades, períodos, carreras y vigencias actuales…</p>}
    {errorCarga && <AlertaInstitucional tono="danger" titulo="No fue posible preparar el editor">
      <p>{errorCarga.message}</p>
      <button className="button button-outline" type="button" disabled={actualizando} onClick={() => cargarContexto()}><RefreshCw size={16} /> {actualizando ? 'Actualizando…' : 'Reintentar consulta'}</button>
    </AlertaInstitucional>}

    {contexto && !contexto.capacidades.puedeAdministrar && <AlertaInstitucional tono="warning" titulo="El servidor no autorizó la creación">
      <p>El servidor dejó esta vista en modo de consulta. No se muestran controles para guardar.</p>
    </AlertaInstitucional>}
    {contexto?.capacidades.puedeAdministrar && !ESCRITURA_RUBRICAS_API_HABILITADA && <AlertaInstitucional tono="warning" titulo="Escritura local deshabilitada">
      <p>El servidor reconoce la capacidad administrativa, pero este cliente está configurado en modo de solo lectura. No se muestran controles para guardar.</p>
    </AlertaInstitucional>}
    {conflicto && <AlertaInstitucional tono="warning" titulo="Cambió la versión base o la configuración de una carrera">
      <p>{clonandoVersion ? 'Sus cambios siguen en el editor. Para resolver el conflicto, confirme una recarga de la versión base, revisiones y vigencias; esa acción reemplazará lo editado.' : 'El editor conserva sus cambios. Actualice el contexto y revise las vigencias antes de volver a intentar.'}</p>
      <button className="button button-outline" type="button" disabled={actualizando} onClick={clonandoVersion ? recargarVersionBase : async () => { if (await cargarContexto()) setConflicto(false); }}><RefreshCw size={16} /> {actualizando ? 'Actualizando…' : clonandoVersion ? 'Recargar base y descartar cambios' : 'Actualizar carreras y vigencias'}</button>
    </AlertaInstitucional>}

    {clonandoVersion && contexto && !cargando && !versionBase && <AlertaInstitucional tono="danger" titulo="No se encontró la versión de origen">
      <p>La versión solicitada no pertenece a esta rúbrica o ya no está disponible en el catálogo. No se habilitó el guardado.</p>
      <button className="button button-outline" type="button" onClick={() => navigate('/rubricas')}><ArrowLeft size={16} /> Volver al catálogo</button>
    </AlertaInstitucional>}

    {contexto && categoriasDisponibles && (!clonandoVersion || versionBase) && <form className="rubrica-completa-form" onSubmit={guardar} noValidate>
      <section className="rubrica-completa-section" aria-labelledby="rubrica-completa-general">
        <div className="rubrica-completa-section-heading"><span className="section-kicker">A. Configuración general</span><h2 id="rubrica-completa-general">Identificación y alcance académico</h2></div>
        <div className="rubrica-completa-metadata">
          {clonandoVersion
            ? <div className="field"><span className="rubrica-completa-label">Modalidad</span><p>{versionBase.modalidad}</p></div>
            : <div className="field"><label htmlFor="rubrica-modalidad">Modalidad <span aria-hidden="true">*</span></label><select id="rubrica-modalidad" className="select" value={datos.modalidadId} disabled={!puedeCrear || guardando} aria-invalid={errores.some(({ campo }) => campo === 'modalidadId')} onChange={(e) => cambiarDato('modalidadId', e.target.value)}><option value="">Seleccione una modalidad</option>{contexto.catalogos.modalidades.map((modalidad) => <option key={modalidad.id} value={modalidad.id}>{modalidad.nombre}</option>)}</select></div>}
          <div className="field"><label htmlFor="rubrica-periodo">Período académico <span aria-hidden="true">*</span></label><select id="rubrica-periodo" className="select" value={datos.periodoId} disabled={!puedeCrear || guardando} aria-invalid={errores.some(({ campo }) => campo === 'periodoId')} onChange={(e) => cambiarDato('periodoId', e.target.value)}><option value="">Seleccione un período</option>{periodosSelector.map((periodo) => <option key={periodo.id} value={periodo.id}>{periodo.codigo}</option>)}</select></div>
          {clonandoVersion
            ? <div className="field"><span className="rubrica-completa-label">Rúbrica</span><p>{versionBase.titulo}</p></div>
            : <div className="field"><label htmlFor="rubrica-nombre">Nombre de la rúbrica <span aria-hidden="true">*</span></label><input id="rubrica-nombre" className="input" maxLength={220} value={datos.nombre} disabled={!puedeCrear || guardando} aria-invalid={errores.some(({ campo }) => campo === 'nombre')} onChange={(e) => cambiarDato('nombre', e.target.value)} /></div>}
          {clonandoVersion
            ? <div className="field"><span className="rubrica-completa-label">Versión de origen</span><p>Basada en {versionBase.version}</p><small>El servidor asignará el identificador de esta nueva versión.</small></div>
            : <div className="field"><label htmlFor="rubrica-version">Versión <span aria-hidden="true">*</span></label><input id="rubrica-version" className="input" maxLength={30} value={datos.version} placeholder="Ej. 1.0" disabled={!puedeCrear || guardando} aria-invalid={errores.some(({ campo }) => campo === 'version')} onChange={(e) => cambiarDato('version', e.target.value)} /><small>Identificador visible de esta versión.</small></div>}
        </div>

        <fieldset className="rubrica-completa-careers" disabled={!puedeCrear || guardando}>
          <legend>Carreras asociadas <span aria-hidden="true">*</span></legend>
          <p>Seleccione una o más carreras. La vigencia se decide por separado para cada una.</p>
          {carrerasActivas.map((carrera) => {
            const seleccionada = Boolean(seleccionCarreras[carrera.id]);
            const idActual = vigenteActual(contexto.rubricas, datos.modalidadId, datos.periodoId, carrera.id);
            const versionActual = contexto.rubricas.find((version) => version.id === idActual)?.version;
            return <div className="rubrica-completa-career" key={carrera.id}>
              <label className="rubrica-completa-career-select"><input type="checkbox" checked={seleccionada} onChange={(e) => actualizarCarrera(carrera.id, e.target.checked)} /><span><strong>{carrera.codigo}</strong> · {carrera.nombre}</span></label>
              {seleccionada && <div className="rubrica-completa-career-vigencia">
                <label><input type="checkbox" checked={seleccionCarreras[carrera.id].vigente} disabled={!datos.modalidadId || !datos.periodoId} onChange={(e) => cambiarVigencia(carrera.id, e.target.checked)} /> Establecer esta versión como vigente para esta carrera</label>
                <small>{idActual ? `Vigencia actual: versión ${versionActual ?? 'registrada'}.` : 'No existe una vigencia actual para esta modalidad, período y carrera.'}</small>
              </div>}
            </div>;
          })}
        </fieldset>
      </section>

      <section className="rubrica-completa-section" aria-labelledby="rubrica-completa-etapas">
        <div className="rubrica-completa-section-heading rubrica-completa-stages-heading"><div><span className="section-kicker">B. Estructura de evaluación</span><h2 id="rubrica-completa-etapas">Etapas</h2><p>Los ámbitos son editables y no dependen del nombre de la etapa.</p></div><button id="agregar-etapa-rubrica" className="button button-outline" type="button" disabled={!puedeCrear || guardando} onClick={() => { const etapas = agregarEtapaRubrica(datos.etapas); cambiarEtapas(etapas); setAnuncio('Etapa agregada.'); requestAnimationFrame(() => document.getElementById(`etapa-nombre-${etapas.at(-1).claveLocal}`)?.focus()); }}><Plus size={16} /> Agregar etapa</button></div>
        <p role="status" aria-live="polite" className="rubrica-completa-announcement">{anuncio}</p>
        {datos.etapas.map((etapa, indiceEtapa) => {
          const resumen = resumenes[indiceEtapa];
          const totalTexto = resumen.total === null ? '—' : formatearCentesimas(resumen.total);
          const nombreEtapa = etapa.nombre.trim() || `etapa ${indiceEtapa + 1}`;
          return <article className="rubrica-completa-stage" key={etapa.claveLocal} aria-labelledby={`etapa-title-${etapa.claveLocal}`}>
            <header className="rubrica-completa-stage-heading">
              <span className="rubrica-stage-number" aria-hidden="true">{indiceEtapa + 1}</span>
              <div className="rubrica-completa-stage-fields">
                <div className="field"><label htmlFor={`etapa-nombre-${etapa.claveLocal}`}>Nombre de etapa <span aria-hidden="true">*</span></label><input id={`etapa-nombre-${etapa.claveLocal}`} className="input" maxLength={220} value={etapa.nombre} disabled={!puedeCrear || guardando} aria-invalid={errores.some(({ campo }) => campo === `etapas.${indiceEtapa}.nombre`)} onChange={(e) => cambiarEtapas(cambiarEtapaRubrica(datos.etapas, etapa.claveLocal, { nombre: e.target.value }))} /></div>
                <div className="field"><label htmlFor={`etapa-alcance-${etapa.claveLocal}`}>Ámbito de evaluación <span aria-hidden="true">*</span></label><select id={`etapa-alcance-${etapa.claveLocal}`} className="select" value={etapa.alcance} disabled={!puedeCrear || guardando} aria-invalid={errores.some(({ campo }) => campo === `etapas.${indiceEtapa}.alcance`)} onChange={(e) => cambiarEtapas(cambiarEtapaRubrica(datos.etapas, etapa.claveLocal, { alcance: e.target.value }))}><option value="">Seleccione un ámbito</option>{SCOPE_OPTIONS.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}</select></div>
                <h3 id={`etapa-title-${etapa.claveLocal}`} className="sr-only">Etapa {indiceEtapa + 1}: {nombreEtapa}</h3>
              </div>
              <div className={`rubrica-completa-total is-${resumen.estado}`} aria-live="polite" aria-invalid={errores.some(({ campo }) => campo === `etapas.${indiceEtapa}.total`)}><span>Total de etapa</span><strong>{totalTexto} <small>/ 10.00</small></strong><small>{resumen.mensaje}</small></div>
              <BotonesOrden etiqueta={nombreEtapa} indice={indiceEtapa} longitud={datos.etapas.length} bloqueado={!puedeCrear || guardando}
                mover={(direccion) => { cambiarEtapas(moverElementoRubrica(datos.etapas, indiceEtapa, direccion)); setAnuncio(`La etapa ${nombreEtapa} fue reordenada.`); }}
                eliminar={() => eliminarConConfirmacion(nombreEtapa, 'También se eliminarán sus categorías e indicadores.', () => cambiarEtapas(eliminarEtapaRubrica(datos.etapas, etapa.claveLocal)), 'agregar-etapa-rubrica')} />
            </header>

            <div className="rubrica-completa-categories">
              {etapa.categorias.map((categoria, indiceCategoria) => {
                const subtotal = subtotalCategoriaCompleta(categoria);
                const subtotalTexto = subtotal === null ? '—' : formatearCentesimas(subtotal);
                const nombreCategoria = categoria.nombre.trim() || `categoría ${indiceCategoria + 1}`;
                return <section className="rubrica-completa-category" key={categoria.claveLocal} aria-label={`${nombreEtapa}, ${nombreCategoria}`}>
                  <header className="rubrica-completa-category-heading">
                    <div className="field"><label htmlFor={`categoria-${categoria.claveLocal}`}>Categoría <span aria-hidden="true">*</span></label><input id={`categoria-${categoria.claveLocal}`} className="input" maxLength={240} value={categoria.nombre} disabled={!puedeCrear || guardando} aria-invalid={errores.some(({ campo }) => campo === `etapas.${indiceEtapa}.categorias.${indiceCategoria}.nombre`)} onChange={(e) => cambiarEtapas(cambiarCategoriaRubrica(datos.etapas, etapa.claveLocal, categoria.claveLocal, { nombre: e.target.value }))} /></div>
                    <strong className="rubrica-completa-subtotal">Subtotal: {subtotalTexto} pts</strong>
                    <BotonesOrden etiqueta={nombreCategoria} indice={indiceCategoria} longitud={etapa.categorias.length} bloqueado={!puedeCrear || guardando}
                      mover={(direccion) => {
                        const categorias = moverElementoRubrica(etapa.categorias, indiceCategoria, direccion);
                        cambiarEtapas(cambiarEtapaRubrica(datos.etapas, etapa.claveLocal, { categorias }));
                      }}
                      eliminar={() => eliminarConConfirmacion(nombreCategoria, 'Se retirarán sus indicadores y ponderaciones.', () => cambiarEtapas(eliminarCategoriaRubrica(datos.etapas, etapa.claveLocal, categoria.claveLocal)), `agregar-categoria-${etapa.claveLocal}`)} />
                  </header>
                  <div className="rubrica-completa-table-wrap">
                    <table className="rubrica-completa-table"><thead><tr><th scope="col">Indicador</th><th scope="col">Ponderación</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead><tbody>
                      {categoria.indicadores.map((indicador, indiceIndicador) => <tr key={indicador.claveLocal}>
                        <th scope="row"><label className="sr-only" htmlFor={`indicador-${indicador.claveLocal}`}>Descripción del indicador {indiceIndicador + 1} de {nombreCategoria}</label><input id={`indicador-${indicador.claveLocal}`} className="input" value={indicador.descripcion} placeholder="Describa el criterio de evaluación" disabled={!puedeCrear || guardando} aria-invalid={errores.some(({ campo }) => campo === `etapas.${indiceEtapa}.categorias.${indiceCategoria}.indicadores.${indiceIndicador}.descripcion`)} onChange={(e) => cambiarEtapas(cambiarIndicadorRubrica(datos.etapas, etapa.claveLocal, categoria.claveLocal, indicador.claveLocal, { descripcion: e.target.value }))} /></th>
                        <td><label className="sr-only" htmlFor={`ponderacion-${indicador.claveLocal}`}>Ponderación del indicador {indiceIndicador + 1}</label><input id={`ponderacion-${indicador.claveLocal}`} className="input rubrica-completa-weight" type="text" inputMode="decimal" value={indicador.calificacionMaxima} placeholder="0.00" disabled={!puedeCrear || guardando} aria-invalid={errores.some(({ campo }) => campo === `etapas.${indiceEtapa}.categorias.${indiceCategoria}.indicadores.${indiceIndicador}.calificacionMaxima`)} onChange={(e) => cambiarEtapas(cambiarIndicadorRubrica(datos.etapas, etapa.claveLocal, categoria.claveLocal, indicador.claveLocal, { calificacionMaxima: e.target.value.replace(',', '.') }))} /></td>
                        <td><BotonesOrden etiqueta={`indicador ${indiceIndicador + 1}`} indice={indiceIndicador} longitud={categoria.indicadores.length} bloqueado={!puedeCrear || guardando}
                          mover={(direccion) => {
                            const indicadores = moverElementoRubrica(categoria.indicadores, indiceIndicador, direccion);
                            cambiarEtapas(cambiarCategoriaRubrica(datos.etapas, etapa.claveLocal, categoria.claveLocal, { indicadores }));
                          }}
                          eliminar={() => eliminarConConfirmacion(`indicador ${indiceIndicador + 1}`, 'Se retirarán su descripción y ponderación.', () => cambiarEtapas(eliminarIndicadorRubrica(datos.etapas, etapa.claveLocal, categoria.claveLocal, indicador.claveLocal)), `agregar-indicador-${categoria.claveLocal}`)} /></td>
                      </tr>)}
                    </tbody></table>
                  </div>
                  <footer className="rubrica-completa-category-footer"><button id={`agregar-indicador-${categoria.claveLocal}`} className="button button-outline button-sm" type="button" disabled={!puedeCrear || guardando} onClick={() => { const etapas = agregarIndicadorRubrica(datos.etapas, etapa.claveLocal, categoria.claveLocal); cambiarEtapas(etapas); const nuevo = etapas.find(({ claveLocal }) => claveLocal === etapa.claveLocal).categorias.find(({ claveLocal }) => claveLocal === categoria.claveLocal).indicadores.at(-1); requestAnimationFrame(() => document.getElementById(`indicador-${nuevo.claveLocal}`)?.focus()); }}><Plus size={15} /> Agregar indicador</button><span>{categoria.indicadores.length} {categoria.indicadores.length === 1 ? 'indicador' : 'indicadores'}</span></footer>
                </section>;
              })}
              <button id={`agregar-categoria-${etapa.claveLocal}`} className="button button-outline button-sm" type="button" disabled={!puedeCrear || guardando} onClick={() => { const etapas = agregarCategoriaRubrica(datos.etapas, etapa.claveLocal); cambiarEtapas(etapas); const nueva = etapas.find(({ claveLocal }) => claveLocal === etapa.claveLocal).categorias.at(-1); requestAnimationFrame(() => document.getElementById(`categoria-${nueva.claveLocal}`)?.focus()); }}><Plus size={15} /> Agregar categoría a {nombreEtapa}</button>
            </div>
          </article>;
        })}
      </section>

      <section className="rubrica-completa-section" aria-labelledby="rubrica-completa-resumen">
        <div className="rubrica-completa-section-heading"><span className="section-kicker">C. Revisión</span><h2 id="rubrica-completa-resumen">Resumen de ponderaciones</h2></div>
        <div className="rubrica-completa-summary" role="list">
          {datos.etapas.map((etapa, indice) => {
            const resumen = resumenes[indice];
            return <div className={`rubrica-completa-summary-row is-${resumen.estado}`} role="listitem" key={etapa.claveLocal}><strong>{etapa.nombre.trim() || `Etapa ${indice + 1}`}</strong><span>{resumen.total === null ? '—' : `${formatearCentesimas(resumen.total)} / 10.00`}</span><small>{resumen.mensaje}</small></div>;
          })}
        </div>
        {errores.length > 0 && <div className="rubrica-completa-errors" role="alert" aria-labelledby="rubrica-completa-errors-title"><h3 id="rubrica-completa-errors-title" tabIndex={-1}>Revise estos campos antes de guardar</h3><ul>{errores.map((error, indice) => <li key={`${error.campo}-${indice}`}>{error.mensaje}</li>)}</ul></div>}
      </section>

      <footer className="rubrica-completa-footer">
        {conflicto && <span role="status">Los cambios escritos se conservan; actualice el contexto antes de reintentar.</span>}
        <button className="button button-outline" type="button" disabled={guardando} onClick={cancelar}>Cancelar</button>
        {puedeCrear && <button className="button button-primary" type="submit" disabled={guardando || actualizando || conflicto || (clonandoVersion && !versionBase)}><Save size={17} /> {guardando ? 'Guardando…' : clonandoVersion ? 'Crear nueva versión' : 'Guardar rúbrica'}</button>}
      </footer>
    </form>}

    {contexto && !categoriasDisponibles && <AlertaInstitucional tono="warning" titulo="Faltan datos maestros activos">
      <p>Para crear una rúbrica se necesita al menos una modalidad, un período y una carrera activos. No se agregarán registros de catálogo automáticamente.</p>
    </AlertaInstitucional>}

    {esApi && !contexto && !cargando && !errorCarga && <AlertaInstitucional tono="danger" titulo="No fue posible preparar el editor"><p>No se recibió el contexto de creación.</p></AlertaInstitucional>}
  </div>;
}
