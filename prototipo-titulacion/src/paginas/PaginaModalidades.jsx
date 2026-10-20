import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenCheck, Plus, RefreshCw, Search } from 'lucide-react';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { AlertaInstitucional, EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';
import { ROL, modalidades as modalidadesPrototipo } from '../datos/datosPrototipo';
import { FUENTE_RUBRICAS, ESCRITURA_MODALIDADES_API_HABILITADA } from '../configuracion/rubricas';
import { confirmarDescarteCambios, usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { cargarCapacidadesModalidadesApi, cargarModalidadesApi, cambiarEstadoModalidadApi, crearModalidadApi } from '../servicios/modalidadesApi';
import { ErrorApiHttp } from '../servicios/clienteHttp';
import './modalidades.css';

const vacio = { codigo: '', nombre: '', descripcion: '', estaActivo: 'true' };

function permisoError(error) {
  if (error instanceof ErrorApiHttp && error.status === 401) return 'La API requiere una identidad validada.';
  if (error instanceof ErrorApiHttp && error.status === 403) return 'La identidad no tiene permiso para consultar este catálogo.';
  return error?.message || 'No fue posible consultar modalidades.';
}

export default function PaginaModalidades() {
  const { actorActual } = usarPrototipo();
  const esApi = FUENTE_RUBRICAS === 'api';
  const rolAdministrador = actorActual?.roles.includes(ROL.ADMIN) ?? false;
  const [modalidades, setModalidades] = useState([]);
  const [puedeAdministrar, setPuedeAdministrar] = useState(false);
  const [cargando, setCargando] = useState(esApi);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODAS');
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [formulario, setFormulario] = useState(vacio);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const [cambiandoId, setCambiandoId] = useState(null);
  const [aviso, setAviso] = useState('');

  const dirty = formularioAbierto && JSON.stringify(formulario) !== JSON.stringify(vacio);
  usarAdvertenciaCambiosSinGuardar(dirty);

  const recargar = useCallback(async (signal) => {
    if (!esApi) return;
    setCargando(true);
    setError(null);
    try {
      const [registros, capacidades] = await Promise.all([
        cargarModalidadesApi({ signal }),
        cargarCapacidadesModalidadesApi({ signal }),
      ]);
      if (signal?.aborted) return;
      setModalidades(registros);
      setPuedeAdministrar(capacidades.puedeAdministrar && ESCRITURA_MODALIDADES_API_HABILITADA);
    } catch (causa) {
      if (signal?.aborted || causa?.name === 'AbortError') return;
      setModalidades([]);
      setPuedeAdministrar(false);
      setError(permisoError(causa));
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, [esApi]);

  useEffect(() => {
    if (!esApi) return undefined;
    const controlador = new AbortController();
    recargar(controlador.signal);
    return () => controlador.abort();
  }, [esApi, recargar]);

  const registros = esApi ? modalidades : modalidadesPrototipo.map((modalidad) => ({ ...modalidad, fuenteDatos: 'prototipo' }));
  const filtradas = useMemo(() => registros.filter((modalidad) => {
    const texto = `${modalidad.codigo} ${modalidad.nombre}`.toLocaleLowerCase();
    const coincideTexto = texto.includes(busqueda.trim().toLocaleLowerCase());
    const coincideEstado = filtroEstado === 'TODAS'
      || (filtroEstado === 'ACTIVAS' && modalidad.estaActivo)
      || (filtroEstado === 'INACTIVAS' && !modalidad.estaActivo);
    return coincideTexto && coincideEstado;
  }), [registros, busqueda, filtroEstado]);

  const crear = async (evento) => {
    evento.preventDefault();
    if (!puedeAdministrar || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    setAviso('');
    try {
      await crearModalidadApi({ ...formulario, estaActivo: formulario.estaActivo === 'true' });
      setFormulario(vacio);
      setFormularioAbierto(false);
      try {
        await recargar();
      } catch {
        setAviso('La modalidad se guardó en PostgreSQL, pero no se pudo actualizar el listado.');
      }
    } catch (causa) {
      setAviso(permisoError(causa));
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  const cambiarEstado = async (modalidad) => {
    if (!puedeAdministrar || cambiandoId) return;
    const activar = !modalidad.estaActivo;
    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: activar ? 'Activar modalidad' : 'Desactivar modalidad',
      text: `${modalidad.codigo} · ${modalidad.nombre}. Esto no cambiará el estado de sus rúbricas ni sus evaluaciones históricas.`,
      showCancelButton: true,
      confirmButtonText: activar ? 'Activar modalidad' : 'Desactivar modalidad',
      cancelButtonText: 'Cancelar',
    });
    if (!confirmacion.isConfirmed) return;
    setCambiandoId(modalidad.id);
    setAviso('');
    try {
      await cambiarEstadoModalidadApi({ id: modalidad.id, revision: modalidad.revision, estaActivo: activar });
      await recargar();
    } catch (causa) {
      setAviso(permisoError(causa));
    } finally {
      setCambiandoId(null);
    }
  };

  return (
    <div className="modalidades-page">
      <EncabezadoPagina
        eyebrow="Maestros / Catálogos"
        title="Modalidades de titulación"
        description="Consulte el catálogo y la familia de rúbricas asociada a cada modalidad."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Maestros / Catálogos' }, { etiqueta: 'Modalidades de titulación' }]}
        actions={esApi && puedeAdministrar ? <button className="button button-primary" type="button" disabled={formularioAbierto} onClick={() => { setAviso(''); setFormulario(vacio); setFormularioAbierto(true); }}><Plus size={18} /> Nueva modalidad</button> : null}
      />

      <AlertaInstitucional tono="info" titulo={esApi ? `Origen: API PostgreSQL${puedeAdministrar ? ' · administración autorizada' : ' · solo lectura'}` : 'Origen: prototipo local'}>
        <p>{esApi ? 'Los registros se consultan directamente en PostgreSQL. Los cambios solo se confirman cuando NestJS responde correctamente.' : 'Se presenta el catálogo simulado existente. En modo prototipo esta vista es informativa y no guarda ni simula cambios administrativos.'}</p>
      </AlertaInstitucional>

      {!esApi && rolAdministrador && <div className="modalidades-local-note">La edición de modalidades requiere el modo API autorizado; no se guardarán cambios en el prototipo.</div>}
      {!esApi && !rolAdministrador && <EstadoVacio title="Permiso insuficiente" description="Esta sección administrativa está disponible para el perfil administrador." />}

      {aviso && <AlertaInstitucional tono="danger" titulo="No se completó la operación"><p role="alert">{aviso}</p></AlertaInstitucional>}

      {formularioAbierto && puedeAdministrar && <form className="card modalidades-form" onSubmit={crear}>
        <header><div><span className="section-kicker">Nuevo registro</span><h2>Crear modalidad</h2></div></header>
        <div className="modalidades-fields">
          <label>Código estable<input required maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" autoComplete="off" value={formulario.codigo} onChange={(e) => setFormulario({ ...formulario, codigo: e.target.value })} /></label>
          <label>Nombre<input required minLength={1} maxLength={160} value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} /></label>
          <label className="modalidades-field-wide">Descripción (opcional)<textarea maxLength={4000} rows={3} value={formulario.descripcion} onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })} /></label>
          <label>Estado inicial<select required value={formulario.estaActivo} onChange={(e) => setFormulario({ ...formulario, estaActivo: e.target.value })}><option value="true">Activa</option><option value="false">Inactiva</option></select></label>
        </div>
        <footer><button className="button button-primary" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Crear modalidad'}</button><button className="button button-outline" type="button" onClick={() => { if (confirmarDescarteCambios()) { setFormulario(vacio); setFormularioAbierto(false); } }}>Cancelar</button></footer>
      </form>}

      {(esApi || rolAdministrador) && <section className="card modalidades-catalog" aria-labelledby="modalidades-titulo">
        <header className="modalidades-catalog-header"><div><span className="section-kicker">Catálogo institucional</span><h2 id="modalidades-titulo">Modalidades registradas</h2></div>{esApi && <button className="button button-outline" type="button" onClick={() => recargar()} disabled={cargando}><RefreshCw size={16} /> Actualizar</button>}</header>
        <div className="modalidades-filtros">
          <label><span>Buscar por código o nombre</span><div><Search size={17} aria-hidden="true" /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar modalidad" /></div></label>
          <label>Estado<select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}><option value="TODAS">Todas</option><option value="ACTIVAS">Activas</option><option value="INACTIVAS">Inactivas</option></select></label>
        </div>
        {esApi && cargando ? <p className="modalidades-status" role="status">Consultando modalidades…</p>
          : esApi && error ? <AlertaInstitucional tono="danger" titulo="No fue posible cargar el catálogo"><p role="alert">{error}</p><button className="button button-outline" type="button" onClick={() => recargar()}>Reintentar</button></AlertaInstitucional>
            : filtradas.length === 0 ? <EstadoVacio title="No hay modalidades para mostrar" description={busqueda ? 'Pruebe con otro código o nombre.' : 'No existen registros para este filtro.'} />
              : <div className="modalidades-list" role="list">
                {filtradas.map((modalidad) => <article className="modalidad-row" role="listitem" key={modalidad.id}>
                  <div className="modalidad-identity"><span>{modalidad.codigo}</span><h3>{modalidad.nombre}</h3>{modalidad.descripcion && <p>{modalidad.descripcion}</p>}</div>
                  <div className="modalidad-family"><span>Familia de rúbricas</span>{esApi ? modalidad.familiaRubricas ? <><strong>{modalidad.familiaRubricas.nombre}</strong><small>{modalidad.familiaRubricas.cantidadVersiones} versiones</small></> : <span>Sin asociación</span> : <span>No consultable en modo prototipo</span>}</div>
                  <InsigniaEstado estado={modalidad.estaActivo ? 'ACTIVA' : 'INACTIVA'} tono={modalidad.estaActivo ? 'success' : 'neutral'}>{modalidad.estaActivo ? 'Activa' : 'Inactiva'}</InsigniaEstado>
                  <div className="modalidad-actions"><Link className="button button-outline" to={`/maestros/modalidades/${modalidad.id}`}><BookOpenCheck size={16} /> Detalle</Link>{esApi && puedeAdministrar && <button className="button button-outline" type="button" disabled={cambiandoId !== null} onClick={() => cambiarEstado(modalidad)}>{cambiandoId === modalidad.id ? 'Actualizando…' : modalidad.estaActivo ? 'Desactivar' : 'Activar'}</button>}</div>
                </article>)}
              </div>}
      </section>}
    </div>
  );
}
