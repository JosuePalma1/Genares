import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, RefreshCw } from 'lucide-react';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { AlertaInstitucional, EncabezadoPagina, InsigniaEstado } from '../componentes/interfaz';
import { ModalFormularioCatalogo } from '../componentes/ModalFormularioCatalogo';
import { TablaCatalogo } from '../componentes/TablaCatalogo';
import { FUENTE_RUBRICAS } from '../configuracion/rubricas';
import { confirmarDescarteCambiosConDialogo, usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';
import { ErrorApiHttp } from '../servicios/clienteHttp';
import {
  actualizarCarreraApi, cambiarEstadoCarreraApi, cargarCapacidadesCarrerasApi,
  cargarCarreraApi, cargarCarrerasApi, crearCarreraApi,
} from '../servicios/carrerasApi';
import './modalidades.css';
import './carreras.css';

const FORMULARIO_VACIO = { codigo: '', nombre: '', estaActivo: true };

function mensajeError(error, modo) {
  if (error instanceof ErrorApiHttp && error.status === 401) return 'Su perfil no tiene permiso para realizar esta operación.';
  if (error instanceof ErrorApiHttp && error.status === 403) return 'Su perfil no tiene permiso para realizar esta operación.';
  if (error instanceof ErrorApiHttp && error.status === 404) return 'La carrera ya no existe. Recargue el catálogo.';
  if (error instanceof ErrorApiHttp && error.status === 409) {
    if (modo === 'editar') return 'Otra sesión modificó esta carrera. Sus campos siguen aquí; vuelva a cargar la versión vigente si desea sustituirlos.';
    if (modo === 'estado') return 'Otra sesión modificó el estado de esta carrera. Se recargaron los datos actuales.';
    return 'Ya existe una carrera con ese código. Revise el código institucional e inténtelo de nuevo.';
  }
  return error?.message || 'No fue posible completar la operación.';
}

export default function PaginaCarreras() {
  const esApi = FUENTE_RUBRICAS === 'api';
  const puedeEscribir = esApi;
  const [carreras, setCarreras] = useState([]);
  const [puedeAdministrar, setPuedeAdministrar] = useState(false);
  const [cargando, setCargando] = useState(esApi);
  const [errorLectura, setErrorLectura] = useState('');
  const [modo, setModo] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [original, setOriginal] = useState(FORMULARIO_VACIO);
  const [registroEditado, setRegistroEditado] = useState(null);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [conflictoFormulario, setConflictoFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cambiandoId, setCambiandoId] = useState(null);
  const guardandoRef = useRef(false);
  const sucio = modo !== null && JSON.stringify(formulario) !== JSON.stringify(original);
  usarAdvertenciaCambiosSinGuardar(sucio);

  const recargar = useCallback(async (signal) => {
    if (!esApi) return false;
    setCargando(true);
    setErrorLectura('');
    try {
      const [registros, capacidades] = await Promise.all([
        cargarCarrerasApi({ signal }), cargarCapacidadesCarrerasApi({ signal }),
      ]);
      if (signal?.aborted) return false;
      setCarreras(registros);
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

  const columnas = useMemo(() => [
    { key: 'codigo', label: 'Código', sortable: true, render: (carrera) => <span className="tabla-catalogo-codigo">{carrera.codigo}</span> },
    { key: 'nombre', label: 'Nombre', sortable: true },
    {
      key: 'estaActivo', label: 'Estado', sortable: true,
      sortValue: (carrera) => carrera.estaActivo,
      render: (carrera) => <InsigniaEstado estado={carrera.estaActivo ? 'ACTIVA' : 'INACTIVA'} tono={carrera.estaActivo ? 'success' : 'neutral'}>
        {carrera.estaActivo ? 'Activa' : 'Inactiva'}
      </InsigniaEstado>,
    },
    {
      key: 'acciones', label: 'Acciones', alineacion: 'derecha',
      render: (carrera) => puedeAdministrar ? <div className="tabla-catalogo-acciones">
        <button className="button button-outline" type="button" aria-label={`Editar carrera ${carrera.codigo}`} onClick={() => abrirEdicion(carrera)}>
          <Pencil size={15} aria-hidden="true" /> Editar
        </button>
        <button className="button button-outline" type="button" disabled={cambiandoId !== null} onClick={() => cambiarEstado(carrera)}>
          {cambiandoId === carrera.id ? 'Actualizando…' : carrera.estaActivo ? 'Desactivar' : 'Activar'}
        </button>
      </div> : null,
    },
  ], [puedeAdministrar, cambiandoId]);

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

  async function abrirEdicion(carrera) {
    if (!puedeAdministrar || !(await confirmarDescarteCambiosConDialogo())) return;
    const datos = { codigo: carrera.codigo, nombre: carrera.nombre, estaActivo: carrera.estaActivo };
    setModo('editar');
    setRegistroEditado(carrera);
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
      if (operacion === 'crear') await crearCarreraApi(formulario);
      else await actualizarCarreraApi({ id: registroEditado.id, revision: registroEditado.revision, nombre: formulario.nombre });
      setModo(null);
      setRegistroEditado(null);
      setFormulario(FORMULARIO_VACIO);
      setOriginal(FORMULARIO_VACIO);
      const listaActualizada = await recargar();
      const titulo = operacion === 'crear' ? 'Carrera creada' : 'Carrera actualizada';
      await Swal.fire({
        icon: listaActualizada ? 'success' : 'warning',
        title: listaActualizada ? titulo : `${titulo}; listado pendiente`,
        text: listaActualizada
          ? `${codigo} se guardó correctamente.`
          : 'El cambio se guardó, pero no se pudo actualizar el catálogo. Use Actualizar para consultar el estado actual.',
        confirmButtonText: 'Continuar',
      });
    } catch (causa) {
      const texto = mensajeError(causa, operacion);
      const conflicto = causa instanceof ErrorApiHttp && causa.status === 409 && operacion === 'editar';
      setErrorFormulario(texto);
      setConflictoFormulario(conflicto);
      await Swal.fire({
        icon: causa instanceof ErrorApiHttp && causa.status === 409 ? 'warning' : 'error',
        title: conflicto ? 'La carrera cambió en otra sesión' : operacion === 'crear' ? 'No se creó la carrera' : 'No se guardaron los cambios',
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
      const actual = await cargarCarreraApi(registroEditado.id);
      const datos = { codigo: actual.codigo, nombre: actual.nombre, estaActivo: actual.estaActivo };
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

  async function cambiarEstado(carrera) {
    if (!puedeAdministrar || cambiandoId !== null) return;
    const activar = !carrera.estaActivo;
    const respuesta = await Swal.fire({
      icon: 'warning', title: activar ? 'Activar carrera' : 'Desactivar carrera',
      text: `${carrera.codigo} · ${carrera.nombre}. Las rúbricas, vigencias y evaluaciones existentes permanecerán intactas.`,
      showCancelButton: true, confirmButtonText: activar ? 'Activar' : 'Desactivar', cancelButtonText: 'Cancelar',
    });
    if (!respuesta.isConfirmed) return;
    setCambiandoId(carrera.id);
    try {
      await cambiarEstadoCarreraApi({ id: carrera.id, revision: carrera.revision, estaActivo: activar });
      const listaActualizada = await recargar();
      await Swal.fire({
        icon: listaActualizada ? 'success' : 'warning',
        title: listaActualizada
          ? activar ? 'Carrera activada' : 'Carrera desactivada'
          : activar ? 'Activación confirmada; listado pendiente' : 'Desactivación confirmada; listado pendiente',
        text: listaActualizada
          ? `${carrera.codigo} quedó ${activar ? 'activa' : 'inactiva'}.`
          : 'El cambio se guardó, pero no se pudo actualizar el catálogo. Use Actualizar para consultar el estado actual.',
        confirmButtonText: 'Continuar',
      });
    } catch (causa) {
      const conflicto = causa instanceof ErrorApiHttp && causa.status === 409;
      if (conflicto) await recargar();
      await Swal.fire({
        icon: conflicto ? 'warning' : 'error',
        title: conflicto ? 'La carrera cambió en otra sesión' : 'No se cambió el estado',
        text: mensajeError(causa, 'estado'),
        confirmButtonText: 'Entendido',
      });
    } finally {
      setCambiandoId(null);
    }
  }

  return <div className="modalidades-page carreras-page">
    <EncabezadoPagina eyebrow="Maestros / Catálogos" title="Carreras"
      description="Consulte y administre las carreras académicas registradas."
      breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Maestros / Catálogos' }, { etiqueta: 'Carreras' }]}
      actions={esApi ? <>
        <button className="button button-outline" type="button" onClick={() => recargar()} disabled={cargando}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button>
        {puedeAdministrar && <button className="button button-primary" type="button" onClick={abrirNuevo}><Plus size={18} aria-hidden="true" /> Nueva carrera</button>}
      </> : null} />

    {esApi && <section className="card modalidades-catalog" aria-labelledby="carreras-titulo">
      <header className="modalidades-catalog-header"><div><span className="section-kicker">Catálogo institucional</span><h2 id="carreras-titulo">Carreras registradas</h2></div></header>
      <TablaCatalogo
        caption="Carreras registradas"
        registros={carreras}
        columnas={columnas}
        cargando={cargando}
        error={errorLectura}
        onReintentar={() => recargar()}
        etiquetaRegistro="carreras"
      />
    </section>}

    {!esApi && <section className="card modalidades-catalog" aria-labelledby="carreras-titulo">
      <header className="modalidades-catalog-header"><div><span className="section-kicker">Catálogo institucional</span><h2 id="carreras-titulo">Carreras registradas</h2></div></header>
      <p className="modalidades-status">La consulta de este catálogo no está disponible para este perfil.</p>
    </section>}

    <ModalFormularioCatalogo
      abierto={Boolean(modo && puedeAdministrar)}
      titulo={modo === 'crear' ? 'Nueva carrera' : `Editar carrera${registroEditado ? ` · ${registroEditado.codigo}` : ''}`}
      descripcion={modo === 'crear' ? 'Registre el código institucional confirmado y el nombre de la carrera.' : 'El código técnico identifica la carrera y permanece estable.'}
      error={errorFormulario}
      mostrarRecarga={conflictoFormulario}
      alRecargar={recargarEdicion}
      alCerrar={cerrarFormulario}
      alEnviar={guardar}
      guardando={guardando}
      deshabilitarGuardar={modo === 'editar' && !sucio}
      textoGuardar={modo === 'crear' ? 'Guardar carrera' : 'Guardar cambios'}
      textoGuardando="Guardando…"
    >
      <label htmlFor="carrera-codigo">Código institucional
        <input
          id="carrera-codigo"
          data-enfoque-inicial={modo === 'crear' ? 'true' : undefined}
          required maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" autoComplete="off"
          value={formulario.codigo}
          readOnly={modo === 'editar'}
          aria-describedby={modo === 'editar' ? 'carrera-codigo-ayuda' : undefined}
          onChange={(evento) => setFormulario({ ...formulario, codigo: evento.target.value })}
        />
      </label>
      {modo === 'editar' && <p className="modal-catalogo-ayuda" id="carrera-codigo-ayuda">Este código no se puede cambiar una vez registrado.</p>}
      <label htmlFor="carrera-nombre">Nombre
        <input id="carrera-nombre" required minLength={1} maxLength={160} value={formulario.nombre}
          data-enfoque-inicial={modo === 'editar' ? 'true' : undefined}
          onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })} />
      </label>
    </ModalFormularioCatalogo>
  </div>;
}
