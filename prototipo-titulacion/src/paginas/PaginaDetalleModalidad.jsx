import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, Layers, PencilLine, RefreshCw } from 'lucide-react';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { AlertaInstitucional, BotonVolver, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { modalidades as modalidadesPrototipo } from '../datos/datosPrototipo';
import { FUENTE_RUBRICAS } from '../configuracion/rubricas';
import { confirmarDescarteCambiosConDialogo, usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';
import { actualizarModalidadApi, cargarCapacidadesModalidadesApi, cargarModalidadApi } from '../servicios/modalidadesApi';
import { ErrorApiHttp } from '../servicios/clienteHttp';
import './modalidades.css';

const vacio = (modalidad) => ({ codigo: modalidad?.codigo ?? '', nombre: modalidad?.nombre ?? '', descripcion: modalidad?.descripcion ?? '' });

function mensajeError(error) {
  if (error instanceof ErrorApiHttp && error.status === 401) return 'Su perfil no tiene permiso para consultar esta modalidad.';
  if (error instanceof ErrorApiHttp && error.status === 403) return 'Su perfil no tiene permiso para consultar esta modalidad.';
  return error?.message || 'No fue posible cargar la modalidad.';
}

export default function PaginaDetalleModalidad() {
  const { id } = useParams();
  const esApi = FUENTE_RUBRICAS === 'api';
  const [modalidad, setModalidad] = useState(null);
  const [puedeAdministrar, setPuedeAdministrar] = useState(false);
  const [cargando, setCargando] = useState(esApi);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(false);
  const [formulario, setFormulario] = useState(vacio(null));
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [conflicto, setConflicto] = useState(false);
  const [revisionGuardada, setRevisionGuardada] = useState(0);
  const dirty = editando && modalidad && (
    formulario.nombre !== modalidad.nombre || formulario.descripcion !== (modalidad.descripcion ?? '')
  );
  usarAdvertenciaCambiosSinGuardar(dirty);

  const recargar = useCallback(async (signal) => {
    if (!esApi) return;
    setCargando(true);
    setError(null);
    try {
      const [registro, capacidades] = await Promise.all([
        cargarModalidadApi(id, { signal }),
        cargarCapacidadesModalidadesApi({ signal }),
      ]);
      if (signal?.aborted) return;
      setModalidad(registro);
      setFormulario(vacio(registro));
      setRevisionGuardada(registro.revision);
      setConflicto(false);
      setPuedeAdministrar(capacidades.puedeAdministrar);
    } catch (causa) {
      if (signal?.aborted || causa?.name === 'AbortError') return;
      setError(mensajeError(causa));
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, [esApi, id]);

  useEffect(() => {
    if (!esApi) {
      const encontrada = modalidadesPrototipo.find((item) => item.id === id);
      if (encontrada) setModalidad({ ...encontrada, descripcion: null, familiaRubricas: null, fuenteDatos: 'prototipo' });
      else setError('No existe la modalidad solicitada.');
      return undefined;
    }
    const controlador = new AbortController();
    recargar(controlador.signal);
    return () => controlador.abort();
  }, [esApi, id, recargar]);

  const guardar = async (evento) => {
    evento.preventDefault();
    if (!puedeAdministrar || !modalidad || guardando) return;
    setGuardando(true);
    setAviso('');
    setConflicto(false);
    try {
      const actualizada = await actualizarModalidadApi({ id: modalidad.id, revision: modalidad.revision, ...formulario });
      setModalidad(actualizada);
      setFormulario(vacio(actualizada));
      setRevisionGuardada(actualizada.revision);
      setEditando(false);
      await Swal.fire({
        icon: 'success',
        title: 'Modalidad actualizada',
        text: `${actualizada.codigo} se guardó correctamente.`,
        confirmButtonText: 'Continuar',
      });
    } catch (causa) {
      const hayConflicto = causa instanceof ErrorApiHttp && causa.status === 409;
      const texto = mensajeError(causa);
      setAviso(texto);
      setConflicto(hayConflicto);
      await Swal.fire({
        icon: hayConflicto ? 'warning' : 'error',
        title: hayConflicto ? 'La modalidad cambió en otra sesión' : 'No se guardaron los cambios',
        text: texto,
        confirmButtonText: 'Entendido',
      });
    } finally {
      setGuardando(false);
    }
  };

  const descartarEdicion = async () => {
    if (!(await confirmarDescarteCambiosConDialogo())) return;
    setFormulario(vacio(modalidad));
    setEditando(false);
    setConflicto(false);
    setAviso('');
  };

  const recargarConflicto = async () => {
    if (dirty) {
      const confirmacion = await Swal.fire({
        icon: 'warning',
        title: 'Recargar datos de modalidad',
        text: 'Se descartarán los cambios locales del formulario. ¿Desea continuar?',
        showCancelButton: true,
        confirmButtonText: 'Recargar datos',
        cancelButtonText: 'Seguir editando',
        reverseButtons: true,
      });
      if (!confirmacion.isConfirmed) return;
    }
    setEditando(false);
    setConflicto(false);
    recargar();
  };

  const volver = <BotonVolver respaldo="/maestros/modalidades" />;
  const puedeAsociarFamilia = modalidad?.estaActivo && puedeAdministrar;
  if (cargando) return <div className="modalidades-page"><EncabezadoPagina title="Modalidad de titulación" actions={volver} /><p className="modalidades-status" role="status">Consultando modalidad…</p></div>;
  if (error) return <div className="modalidades-page"><EncabezadoPagina title="Modalidad de titulación" actions={volver} /><AlertaInstitucional tono="danger" titulo="No fue posible cargar el detalle"><p role="alert">{error}</p>{esApi && <button className="button button-outline" type="button" onClick={() => recargar()}>Reintentar</button>}</AlertaInstitucional></div>;
  if (!modalidad) return <div className="modalidades-page"><EncabezadoPagina title="Modalidad de titulación" actions={volver} /><EstadoVacio title="Modalidad no encontrada" /></div>;

  return (
    <div className="modalidades-page">
      <EncabezadoPagina
        eyebrow="Maestros / Catálogos"
        title={modalidad.nombre}
        description={`Código estable: ${modalidad.codigo}`}
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Modalidades', to: '/maestros/modalidades' }, { etiqueta: modalidad.nombre }]}
        actions={<>{esApi && puedeAdministrar && !editando && <button className="button button-primary" type="button" onClick={() => { setFormulario(vacio(modalidad)); setEditando(true); setAviso(''); }}><PencilLine size={17} /> Editar datos</button>}{volver}</>}
      />

      <p role="note">El estado de la modalidad es independiente del estado de sus versiones de rúbrica. Desactivarla no altera evaluaciones ni versiones existentes.</p>

      {aviso && <AlertaInstitucional tono={conflicto ? 'warning' : 'danger'} titulo={conflicto ? 'Cambios concurrentes detectados' : 'No se guardaron los cambios'}><p role="alert">{aviso}</p>{conflicto && <button className="button button-outline" type="button" onClick={recargarConflicto}><RefreshCw size={16} /> Recargar versión actual</button>}</AlertaInstitucional>}

      {editando && esApi ? <form className="card modalidades-form" onSubmit={guardar}>
        <header><div><span className="section-kicker">Datos del catálogo</span><h2>Editar modalidad</h2></div><span>Revisión {revisionGuardada}</span></header>
        <div className="modalidades-fields">
          <label>Código estable<input value={formulario.codigo} readOnly aria-describedby="modalidad-codigo-ayuda" /></label>
          <p className="modalidad-code-help" id="modalidad-codigo-ayuda">El código no se puede cambiar una vez registrado.</p>
          <label>Nombre<input required minLength={1} maxLength={160} value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} /></label>
          <label className="modalidades-field-wide">Descripción<textarea maxLength={4000} rows={4} value={formulario.descripcion} onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })} /></label>
        </div>
        <footer><button className="button button-primary" type="submit" disabled={guardando || !dirty}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button><button className="button button-outline" type="button" onClick={descartarEdicion}>Cancelar</button></footer>
      </form> : <section className="card modalidad-detail-card">
        <header><div><span className="section-kicker">Ficha de modalidad</span><h2>Datos principales</h2></div><InsigniaEstado estado={modalidad.estaActivo ? 'ACTIVA' : 'INACTIVA'} tono={modalidad.estaActivo ? 'success' : 'neutral'}>{modalidad.estaActivo ? 'Activa' : 'Inactiva'}</InsigniaEstado></header>
        <dl className="modalidad-detail-grid"><div><dt>Código</dt><dd>{modalidad.codigo}</dd></div><div><dt>Nombre</dt><dd>{modalidad.nombre}</dd></div><div className="modalidades-field-wide"><dt>Descripción</dt><dd>{modalidad.descripcion || 'Sin descripción'}</dd></div>{esApi && <div><dt>Revisión</dt><dd>{modalidad.revision}</dd></div>}</dl>
      </section>}

      <section className="card modalidad-family-card">
        <header><div><span className="section-kicker">Rúbricas</span><h2>Familia asociada</h2></div></header>
        {!esApi ? <p>La asociación de familias y sus versiones no están disponibles en esta consulta.</p>
          : !modalidad.familiaRubricas ? <EstadoVacio
            className="modalidad-family-empty"
            icon={Layers}
            title="Aún no hay una familia asociada"
            description={!modalidad.estaActivo
              ? 'Activa esta modalidad para poder vincularla con una familia de rúbricas.'
              : !puedeAdministrar
                ? 'La asociación de familias requiere autorización administrativa.'
              : 'Puedes vincular una familia al crear una rúbrica para esta modalidad.'}
            accion={puedeAsociarFamilia && <Link className="button button-outline" to="/rubricas/nueva">Crear rúbrica</Link>}
          />
            : <><div className="modalidad-family-summary"><div><span>Familia</span><h3>{modalidad.familiaRubricas.nombre}</h3>{modalidad.familiaRubricas.descripcion && <p>{modalidad.familiaRubricas.descripcion}</p>}</div><InsigniaEstado estado={`${modalidad.familiaRubricas.cantidadVersiones} versiones`} tono="info" /></div>
              {modalidad.familiaRubricas.versiones?.length ? <div className="modalidad-versiones">
                {modalidad.familiaRubricas.versiones.map((version) => <article key={version.id}>
                  <div><strong>{version.version}</strong><span>{version.periodo.codigo}</span></div>
                  <InsigniaEstado estado={version.estado} />
                  <Link className="button button-outline" to={`/rubricas/${version.id}`}>Consultar versión <ArrowUpRight size={16} /></Link>
                </article>)}
              </div> : <p className="modalidades-status">La familia aún no tiene versiones de rúbrica.</p>}
              <Link className="button button-outline" to="/rubricas">Administrar versiones</Link>
            </>}
      </section>
    </div>
  );
}
