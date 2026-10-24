import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenCheck, Pencil, Plus, RefreshCw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { AlertaInstitucional, EncabezadoPagina, InsigniaEstado } from '../componentes/interfaz';
import { ModalFormularioCatalogo } from '../componentes/ModalFormularioCatalogo';
import { TablaCatalogo } from '../componentes/TablaCatalogo';
import { modalidades as modalidadesPrototipo } from '../datos/datosPrototipo';
import { FUENTE_RUBRICAS, ESCRITURA_MODALIDADES_API_HABILITADA } from '../configuracion/rubricas';
import { confirmarDescarteCambiosConDialogo, usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';
import {
  actualizarModalidadApi, cambiarEstadoModalidadApi, cargarCapacidadesModalidadesApi,
  cargarModalidadApi, cargarModalidadesApi, crearModalidadApi,
} from '../servicios/modalidadesApi';
import { ErrorApiHttp } from '../servicios/clienteHttp';
import './modalidades.css';

const FORMULARIO_VACIO = { codigo: '', nombre: '', descripcion: '', estaActivo: true };

function mensajeError(error, modo) {
  if (error instanceof ErrorApiHttp && error.status === 401) return 'El servidor no habilitó esta operación en el entorno actual.';
  if (error instanceof ErrorApiHttp && error.status === 403) return 'La operación no está disponible en el entorno actual.';
  if (error instanceof ErrorApiHttp && error.status === 404) return 'La modalidad ya no existe. Recargue el catálogo.';
  if (error instanceof ErrorApiHttp && error.status === 409) {
    if (modo === 'editar') return 'Otra sesión modificó esta modalidad. Sus campos siguen aquí; recargue los datos del servidor si desea sustituirlos.';
    if (modo === 'estado') return 'Otra sesión modificó el estado de esta modalidad. Se recargaron los datos actuales.';
    return 'Ya existe una modalidad con ese código. Revise el código técnico e inténtelo de nuevo.';
  }
  return error?.message || 'No fue posible completar la operación.';
}

export default function PaginaModalidades() {
  const esApi = FUENTE_RUBRICAS === 'api';
  const puedeEscribir = esApi && ESCRITURA_MODALIDADES_API_HABILITADA;
  const [modalidades, setModalidades] = useState([]);
  const [puedeAdministrar, setPuedeAdministrar] = useState(!esApi);
  const puedeGestionarCatalogo = !esApi || puedeAdministrar;
  const [cargando, setCargando] = useState(esApi);
  const [mostrarAvisoOrigen, setMostrarAvisoOrigen] = useState(true);
  const [errorLectura, setErrorLectura] = useState('');
  const [modo, setModo] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [original, setOriginal] = useState(FORMULARIO_VACIO);
  const [registroEditado, setRegistroEditado] = useState(null);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [conflictoFormulario, setConflictoFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const [cambiandoId, setCambiandoId] = useState(null);
  const sucio = modo !== null && JSON.stringify(formulario) !== JSON.stringify(original);
  usarAdvertenciaCambiosSinGuardar(sucio);

  const recargar = useCallback(async (signal) => {
    if (!esApi) return false;
    setCargando(true);
    setErrorLectura('');
    try {
      const [registros, capacidades] = await Promise.all([
        cargarModalidadesApi({ signal }), cargarCapacidadesModalidadesApi({ signal }),
      ]);
      if (signal?.aborted) return false;
      setModalidades(registros);
      setPuedeAdministrar(capacidades.puedeAdministrar && puedeEscribir);
      return true;
    } catch (causa) {
      if (signal?.aborted || causa?.name === 'AbortError') return false;
      setPuedeAdministrar(false);
      setErrorLectura(mensajeError(causa));
      return false;
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, [esApi, puedeEscribir]);

  useEffect(() => {
    if (!esApi) return undefined;
    const controlador = new AbortController();
    void recargar(controlador.signal);
    return () => controlador.abort();
  }, [esApi, recargar]);

  const registros = esApi
    ? modalidades
    : modalidadesPrototipo.map((modalidad) => ({ ...modalidad, fuenteDatos: 'prototipo' }));

  const columnas = useMemo(() => [
    { key: 'codigo', label: 'Código', sortable: true, render: (modalidad) => <span className="tabla-catalogo-codigo">{modalidad.codigo}</span> },
    { key: 'nombre', label: 'Nombre', sortable: true },
    {
      key: 'familiaRubricas', label: 'Familia de rúbricas',
      render: (modalidad) => esApi
        ? modalidad.familiaRubricas
          ? <span className="modalidad-familia-celda"><strong>{modalidad.familiaRubricas.nombre}</strong><small>{modalidad.familiaRubricas.cantidadVersiones} versiones</small></span>
          : <span className="tabla-catalogo-muted">Sin asociación</span>
        : <span className="tabla-catalogo-muted">No consultable en prototipo</span>,
    },
    {
      key: 'estaActivo', label: 'Estado', sortable: true,
      sortValue: (modalidad) => modalidad.estaActivo,
      render: (modalidad) => <InsigniaEstado estado={modalidad.estaActivo ? 'ACTIVA' : 'INACTIVA'} tono={modalidad.estaActivo ? 'success' : 'neutral'}>
        {modalidad.estaActivo ? 'Activa' : 'Inactiva'}
      </InsigniaEstado>,
    },
    {
      key: 'acciones', label: 'Acciones', alineacion: 'derecha',
      render: (modalidad) => <div className="tabla-catalogo-acciones">
        <Link className="button button-outline" to={`/maestros/modalidades/${modalidad.id}`} aria-label={`Ver modalidad ${modalidad.codigo}`}>
          <BookOpenCheck size={15} aria-hidden="true" /> Detalle
        </Link>
        {puedeAdministrar && <>
          <button className="button button-outline" type="button" aria-label={`Editar modalidad ${modalidad.codigo}`} onClick={() => abrirEdicion(modalidad)}>
            <Pencil size={15} aria-hidden="true" /> Editar
          </button>
          <button className="button button-outline" type="button" disabled={cambiandoId !== null} onClick={() => cambiarEstado(modalidad)}>
            {cambiandoId === modalidad.id ? 'Actualizando…' : modalidad.estaActivo ? 'Desactivar' : 'Activar'}
          </button>
        </>}
      </div>,
    },
  ], [esApi, puedeAdministrar, cambiandoId]);

  async function cerrarFormulario() {
    if (guardando || !(await confirmarDescarteCambiosConDialogo())) return;
    setModo(null);
    setRegistroEditado(null);
    setFormulario(FORMULARIO_VACIO);
    setOriginal(FORMULARIO_VACIO);
    setErrorFormulario('');
    setConflictoFormulario(false);
  }

  async function abrirNuevo() {
    if (!puedeAdministrar || !(await confirmarDescarteCambiosConDialogo())) return;
    setModo('crear');
    setRegistroEditado(null);
    setFormulario(FORMULARIO_VACIO);
    setOriginal(FORMULARIO_VACIO);
    setErrorFormulario('');
    setConflictoFormulario(false);
  }

  async function abrirEdicion(modalidad) {
    if (!puedeAdministrar || !(await confirmarDescarteCambiosConDialogo())) return;
    const datos = {
      codigo: modalidad.codigo, nombre: modalidad.nombre,
      descripcion: modalidad.descripcion ?? '', estaActivo: modalidad.estaActivo,
    };
    setModo('editar');
    setRegistroEditado(modalidad);
    setFormulario(datos);
    setOriginal(datos);
    setErrorFormulario('');
    setConflictoFormulario(false);
  }

  async function guardar(evento) {
    evento.preventDefault();
    if (!puedeAdministrar || guardandoRef.current || !modo) return;
    guardandoRef.current = true;
    setGuardando(true);
    setErrorFormulario('');
    setConflictoFormulario(false);
    const operacion = modo;
    const codigo = operacion === 'crear' ? formulario.codigo.trim() : registroEditado.codigo;
    try {
      if (operacion === 'crear') {
        await crearModalidadApi(formulario);
      } else {
        await actualizarModalidadApi({
          id: registroEditado.id, revision: registroEditado.revision,
          codigo: formulario.codigo, nombre: formulario.nombre, descripcion: formulario.descripcion,
        });
      }
      setModo(null);
      setRegistroEditado(null);
      setFormulario(FORMULARIO_VACIO);
      setOriginal(FORMULARIO_VACIO);
      const listaActualizada = await recargar();
      const titulo = operacion === 'crear' ? 'Modalidad creada' : 'Modalidad actualizada';
      await Swal.fire({
        icon: listaActualizada ? 'success' : 'warning',
        title: listaActualizada ? titulo : `${titulo}; listado pendiente`,
        text: listaActualizada
          ? `${codigo} se guardó correctamente.`
          : 'NestJS confirmó el cambio, pero no se pudo actualizar el catálogo. Use Actualizar para consultar el estado actual.',
        confirmButtonText: 'Continuar',
      });
    } catch (causa) {
      const texto = mensajeError(causa, operacion);
      const conflicto = causa instanceof ErrorApiHttp && causa.status === 409 && operacion === 'editar';
      setErrorFormulario(texto);
      setConflictoFormulario(conflicto);
      await Swal.fire({
        icon: causa instanceof ErrorApiHttp && causa.status === 409 ? 'warning' : 'error',
        title: conflicto ? 'La modalidad cambió en otra sesión' : operacion === 'crear' ? 'No se creó la modalidad' : 'No se guardaron los cambios',
        text: texto,
        confirmButtonText: 'Entendido',
      });
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  async function recargarEdicion() {
    if (!registroEditado || !(await confirmarDescarteCambiosConDialogo())) return;
    try {
      const actual = await cargarModalidadApi(registroEditado.id);
      const datos = {
        codigo: actual.codigo, nombre: actual.nombre,
        descripcion: actual.descripcion ?? '', estaActivo: actual.estaActivo,
      };
      setRegistroEditado(actual);
      setFormulario(datos);
      setOriginal(datos);
      setErrorFormulario('');
      setConflictoFormulario(false);
      await recargar();
    } catch (causa) {
      const texto = mensajeError(causa, 'editar');
      setErrorFormulario(texto);
      await Swal.fire({
        icon: causa instanceof ErrorApiHttp && causa.status === 409 ? 'warning' : 'error',
        title: 'No se pudieron recargar los datos',
        text: texto,
        confirmButtonText: 'Entendido',
      });
    }
  }

  async function cambiarEstado(modalidad) {
    if (!puedeAdministrar || cambiandoId !== null) return;
    const activar = !modalidad.estaActivo;
    const confirmacion = await Swal.fire({
      icon: 'warning', title: activar ? 'Activar modalidad' : 'Desactivar modalidad',
      text: `${modalidad.codigo} · ${modalidad.nombre}. Sus rúbricas y evaluaciones existentes permanecerán intactas.`,
      showCancelButton: true, confirmButtonText: activar ? 'Activar modalidad' : 'Desactivar modalidad', cancelButtonText: 'Cancelar',
    });
    if (!confirmacion.isConfirmed) return;
    setCambiandoId(modalidad.id);
    try {
      await cambiarEstadoModalidadApi({ id: modalidad.id, revision: modalidad.revision, estaActivo: activar });
      const listaActualizada = await recargar();
      await Swal.fire({
        icon: listaActualizada ? 'success' : 'warning',
        title: listaActualizada
          ? activar ? 'Modalidad activada' : 'Modalidad desactivada'
          : activar ? 'Activación confirmada; listado pendiente' : 'Desactivación confirmada; listado pendiente',
        text: listaActualizada
          ? `${modalidad.codigo} quedó ${activar ? 'activa' : 'inactiva'}. Sus rúbricas y evaluaciones existentes permanecen intactas.`
          : 'NestJS confirmó el cambio, pero no se pudo actualizar el catálogo. Use Actualizar para consultar el estado actual.',
        confirmButtonText: 'Continuar',
      });
    } catch (causa) {
      const conflicto = causa instanceof ErrorApiHttp && causa.status === 409;
      if (conflicto) await recargar();
      await Swal.fire({
        icon: conflicto ? 'warning' : 'error',
        title: conflicto ? 'La modalidad cambió en otra sesión' : 'No se cambió el estado',
        text: mensajeError(causa, 'estado'),
        confirmButtonText: 'Entendido',
      });
    } finally {
      setCambiandoId(null);
    }
  }

  return <div className="modalidades-page">
    <EncabezadoPagina
      eyebrow="Maestros / Catálogos"
      title="Modalidades de titulación"
      description="Consulte el catálogo y la familia de rúbricas asociada a cada modalidad."
      breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Maestros / Catálogos' }, { etiqueta: 'Modalidades de titulación' }]}
      actions={esApi ? <>
        <button className="button button-outline" type="button" onClick={() => recargar()} disabled={cargando}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button>
        {puedeAdministrar && <button className="button button-primary" type="button" onClick={abrirNuevo}><Plus size={18} aria-hidden="true" /> Nueva modalidad</button>}
      </> : null}
    />

    {mostrarAvisoOrigen && <div className="modalidades-origen-alerta">
      <AlertaInstitucional className="modalidades-origen-alerta-contenido" tono="info" titulo={esApi ? `Origen: API PostgreSQL · ${puedeAdministrar ? 'administración autorizada' : 'solo lectura'}` : 'Origen: prototipo local'}>
        <p>{esApi
          ? 'Los registros se consultan directamente en PostgreSQL. Los cambios se muestran después de que NestJS los confirma.'
          : 'El catálogo simulado es de solo lectura. El modo prototipo no envía escrituras API ni modifica datos locales.'}</p>
      </AlertaInstitucional>
      <button
        className="modalidades-origen-alerta-cerrar"
        type="button"
        aria-label="Cerrar aviso de origen"
        title="Cerrar aviso"
        onClick={() => setMostrarAvisoOrigen(false)}
      ><X size={18} aria-hidden="true" /></button>
    </div>}

    {(esApi || puedeGestionarCatalogo) && <section className="card modalidades-catalog" aria-labelledby="modalidades-titulo">
      <header className="modalidades-catalog-header"><div><span className="section-kicker">Catálogo institucional</span><h2 id="modalidades-titulo">Modalidades registradas</h2></div></header>
      <TablaCatalogo
        caption="Modalidades registradas"
        registros={registros}
        columnas={columnas}
        cargando={esApi && cargando}
        error={esApi ? errorLectura : ''}
        onReintentar={esApi ? () => recargar() : undefined}
        etiquetaRegistro="modalidades"
      />
    </section>}

    <ModalFormularioCatalogo
      abierto={Boolean(modo && puedeAdministrar)}
      titulo={modo === 'crear' ? 'Nueva modalidad' : `Editar modalidad${registroEditado ? ` · ${registroEditado.codigo}` : ''}`}
      descripcion={modo === 'crear' ? 'Registre los datos de la modalidad con su código técnico estable.' : 'El código técnico identifica la modalidad y permanece estable.'}
      error={errorFormulario}
      mostrarRecarga={conflictoFormulario}
      alRecargar={recargarEdicion}
      alCerrar={cerrarFormulario}
      alEnviar={guardar}
      guardando={guardando}
      deshabilitarGuardar={modo === 'editar' && !sucio}
      textoGuardar={modo === 'crear' ? 'Guardar modalidad' : 'Guardar cambios'}
    >
      <label htmlFor="modalidad-codigo">Código técnico
        <input
          id="modalidad-codigo"
          data-enfoque-inicial={modo === 'crear' ? 'true' : undefined}
          required maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" autoComplete="off"
          value={formulario.codigo} readOnly={modo === 'editar'}
          aria-describedby={modo === 'editar' ? 'modalidad-codigo-ayuda' : undefined}
          onChange={(evento) => setFormulario({ ...formulario, codigo: evento.target.value })}
        />
      </label>
      {modo === 'editar' && <p className="modal-catalogo-ayuda" id="modalidad-codigo-ayuda">Este código no se puede cambiar una vez registrado.</p>}
      <label htmlFor="modalidad-nombre">Nombre
        <input id="modalidad-nombre" required minLength={1} maxLength={160} value={formulario.nombre}
          data-enfoque-inicial={modo === 'editar' ? 'true' : undefined}
          onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })} />
      </label>
      <label htmlFor="modalidad-descripcion" className="modal-catalogo-campo-ancho">Descripción (opcional)
        <textarea id="modalidad-descripcion" maxLength={4000} rows={4} value={formulario.descripcion}
          onChange={(evento) => setFormulario({ ...formulario, descripcion: evento.target.value })} />
      </label>
    </ModalFormularioCatalogo>
  </div>;
}
