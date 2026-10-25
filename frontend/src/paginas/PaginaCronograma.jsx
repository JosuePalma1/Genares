import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CalendarDays, CheckCircle2, Clock3, FilePlus2, MapPin, Pencil, Play, Printer, RefreshCw, Save, Search, UsersRound, X } from 'lucide-react';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { AlertaInstitucional, EncabezadoPagina } from '../componentes/interfaz';
import {
  actualizarProgramacionApi,
  capacidadesProgramacionesApi,
  cambiarEstadoProgramacionApi,
  crearProgramacionApi,
  listarProgramacionesApi,
  listarTrabajosDisponiblesApi,
  obtenerImpresionProgramacionesApi,
} from '../servicios/programacionesApi';
import './cronograma.css';

const FILTROS_VACIOS = { carreras: [], periodos: [] };

function fechaHoyLocal() {
  const fecha = new Date();
  return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, '0'), String(fecha.getDate()).padStart(2, '0')].join('-');
}

function mostrarFecha(fecha) {
  if (!fecha) return '—';
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nombre(persona) {
  return [persona?.nombres, persona?.apellidos].filter(Boolean).join(' ').trim();
}

function personaLista(personas) {
  return personas.length ? personas.map(nombre).join(', ') : 'Sin integrantes registrados';
}

function etiquetaEstado(estado) {
  return ({
    PROGRAMADA: 'Programada',
    EN_SUSTENTACION: 'En sustentación',
    FINALIZADA: 'Finalizada',
    CANCELADA: 'Cancelada',
  })[estado] ?? estado;
}

function rangoEstimado(fecha, hora, duracionMinutos) {
  const [horas, minutos] = hora.split(':').map(Number);
  const inicio = new Date(`${fecha}T00:00:00`);
  inicio.setHours(horas, minutos, 0, 0);
  const fin = new Date(inicio.getTime() + duracionMinutos * 60_000);
  const horaFin = fin.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
  const diaFin = fin.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
  const diaInicio = inicio.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
  return `${hora}–${horaFin}${diaFin !== diaInicio ? ` (${diaFin})` : ''}`;
}

function fechaHoraReal(valor) {
  return valor ? new Date(valor).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : null;
}

function resumenTiempoReal(elemento) {
  if (elemento.finalizacionRealEn) {
    return `Real: ${fechaHoraReal(elemento.inicioRealEn)} – ${fechaHoraReal(elemento.finalizacionRealEn)}`;
  }
  if (elemento.inicioRealEn) return `Inicio real: ${fechaHoraReal(elemento.inicioRealEn)} · en curso`;
  return 'Sin inicio real registrado';
}

function nombreCarrera(filtros, id) {
  return filtros.carreras.find((carrera) => carrera.id === id)?.nombre ?? 'Todas las carreras';
}

function codigoPeriodo(filtros, id) {
  return filtros.periodos.find((periodo) => periodo.id === id)?.codigo ?? 'Todos los períodos';
}

export default function PaginaCronograma() {
  const [estado, establecerEstado] = useState('PROGRAMADA');
  const [carreraId, establecerCarreraId] = useState('');
  const [periodoId, establecerPeriodoId] = useState('');
  const [buscar, establecerBuscar] = useState('');
  const [buscarServidor, establecerBuscarServidor] = useState('');
  const [elementos, establecerElementos] = useState([]);
  const [catalogos, establecerCatalogos] = useState(FILTROS_VACIOS);
  const [capacidad, establecerCapacidad] = useState(null);
  const [cargando, establecerCargando] = useState(true);
  const [errorCarga, establecerErrorCarga] = useState(null);
  const [mostrarFormulario, establecerMostrarFormulario] = useState(false);
  const [trabajosDisponibles, establecerTrabajosDisponibles] = useState([]);
  const [cargandoTrabajos, establecerCargandoTrabajos] = useState(false);
  const [idTrabajo, establecerIdTrabajo] = useState('');
  const [idEdicion, establecerIdEdicion] = useState(null);
  const [formulario, establecerFormulario] = useState({ fechaProgramada: fechaHoyLocal(), horaProgramada: '10:00', sala: '', duracionEstimadaMinutos: 60 });
  const [guardando, establecerGuardando] = useState(false);
  const [actualizandoEstadoId, establecerActualizandoEstadoId] = useState(null);
  const [impresion, establecerImpresion] = useState(null);

  const filtros = useMemo(() => ({ carreraId, periodoId, estado, buscar: buscarServidor }), [carreraId, periodoId, estado, buscarServidor]);
  const filtrosCandidatos = useMemo(() => ({ carreraId, periodoId, buscar: buscarServidor }), [carreraId, periodoId, buscarServidor]);
  const trabajoSeleccionado = trabajosDisponibles.find((trabajo) => trabajo.idTrabajo === idTrabajo);
  const programacionEnEdicion = elementos.find((elemento) => elemento.id === idEdicion);
  const puedeEditar = Boolean(capacidad?.puedeAdministrar);

  useEffect(() => {
    const temporizador = window.setTimeout(() => establecerBuscarServidor(buscar.trim()), 250);
    return () => window.clearTimeout(temporizador);
  }, [buscar]);

  async function cargarListado() {
    establecerCargando(true);
    establecerErrorCarga(null);
    try {
      const [respuesta, capacidades] = await Promise.all([
        listarProgramacionesApi(filtros),
        capacidadesProgramacionesApi(),
      ]);
      establecerElementos(respuesta.elementos);
      establecerCatalogos(respuesta.filtros);
      establecerCapacidad(capacidades);
    } catch (error) {
      establecerErrorCarga(error);
      establecerElementos([]);
    } finally {
      establecerCargando(false);
    }
  }

  useEffect(() => {
    void cargarListado();
    // Se vuelve a consultar al cambiar filtros para que la API sea la fuente de verdad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carreraId, periodoId, estado, buscarServidor]);

  useEffect(() => {
    if (!mostrarFormulario || idEdicion) return undefined;
    let vigente = true;
    establecerCargandoTrabajos(true);
    listarTrabajosDisponiblesApi(filtrosCandidatos)
      .then((respuesta) => {
        if (!vigente) return;
        establecerTrabajosDisponibles(respuesta.elementos);
        establecerCatalogos(respuesta.filtros);
      })
      .catch(async (error) => {
        if (!vigente) return;
        establecerTrabajosDisponibles([]);
        await Swal.fire({ icon: 'error', title: 'No se pudieron cargar los trabajos', text: error.message });
      })
      .finally(() => { if (vigente) establecerCargandoTrabajos(false); });
    return () => { vigente = false; };
  }, [mostrarFormulario, idEdicion, filtrosCandidatos]);

  useEffect(() => {
    const finalizarImpresion = () => establecerImpresion(null);
    window.addEventListener('afterprint', finalizarImpresion);
    return () => window.removeEventListener('afterprint', finalizarImpresion);
  }, []);

  function abrirNuevaProgramacion() {
    establecerIdEdicion(null);
    establecerIdTrabajo('');
    establecerFormulario({ fechaProgramada: fechaHoyLocal(), horaProgramada: '10:00', sala: '', duracionEstimadaMinutos: 60 });
    establecerMostrarFormulario(true);
  }

  function abrirEdicion(programacion) {
    establecerIdEdicion(programacion.id);
    establecerIdTrabajo(programacion.idTrabajo);
    establecerFormulario({
      fechaProgramada: programacion.fechaProgramada,
      horaProgramada: programacion.horaProgramada,
      sala: programacion.sala,
      duracionEstimadaMinutos: programacion.duracionEstimadaMinutos,
    });
    establecerMostrarFormulario(true);
  }

  function cerrarFormulario() {
    establecerMostrarFormulario(false);
    establecerIdEdicion(null);
    establecerIdTrabajo('');
  }

  async function guardar(evento) {
    evento.preventDefault();
    if (!puedeEditar || guardando) return;
    if (!formulario.fechaProgramada || !formulario.horaProgramada || !formulario.sala.trim() || (!idEdicion && !idTrabajo)
      || !Number.isInteger(Number(formulario.duracionEstimadaMinutos))
      || Number(formulario.duracionEstimadaMinutos) < 1 || Number(formulario.duracionEstimadaMinutos) > 240) {
      await Swal.fire({ icon: 'warning', title: 'Complete la programación', text: 'Seleccione el trabajo, ingrese fecha, hora y sala, y defina una duración estimada entera entre 1 y 240 minutos.' });
      return;
    }
    establecerGuardando(true);
    try {
      if (idEdicion) {
        await actualizarProgramacionApi({ id: idEdicion, ...formulario, duracionEstimadaMinutos: Number(formulario.duracionEstimadaMinutos) });
      } else {
        await crearProgramacionApi({ idTrabajo, ...formulario, duracionEstimadaMinutos: Number(formulario.duracionEstimadaMinutos) });
      }
      cerrarFormulario();
      await cargarListado();
      await Swal.fire({
        icon: 'success',
        title: idEdicion ? 'Programación actualizada' : 'Sustentación programada',
        text: 'Los cambios se guardaron correctamente.',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se guardó la programación', text: error.message });
    } finally {
      establecerGuardando(false);
    }
  }

  async function cambiarEstado(elemento, siguiente) {
    if (!puedeEditar || actualizandoEstadoId) return;
    const acciones = {
      EN_SUSTENTACION: { titulo: '¿Iniciar la sustentación?', texto: 'Se registrará la hora real de inicio. La duración estimada no cerrará la sustentación automáticamente.' },
      FINALIZADA: { titulo: '¿Finalizar la sustentación?', texto: 'Se registrará la hora real de finalización. Esta acción no modifica evaluaciones ni resultados académicos.' },
      CANCELADA: { titulo: '¿Cancelar la programación?', texto: 'La sala quedará disponible para otro horario. No se borrará el registro.' },
    };
    const confirmacion = await Swal.fire({
      icon: siguiente === 'CANCELADA' ? 'warning' : 'question',
      title: acciones[siguiente].titulo,
      text: acciones[siguiente].texto,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Volver',
    });
    if (!confirmacion.isConfirmed) return;

    establecerActualizandoEstadoId(elemento.id);
    try {
      await cambiarEstadoProgramacionApi({ id: elemento.id, estado: siguiente });
      await cargarListado();
      await Swal.fire({
        icon: 'success',
        title: siguiente === 'CANCELADA' ? 'Programación cancelada' : `Estado: ${etiquetaEstado(siguiente)}`,
        text: siguiente === 'CANCELADA' ? 'La sala ya puede asignarse a otra sustentación.' : 'Se registró el cambio y la hora real correspondiente.',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se cambió el estado', text: error.message });
    } finally {
      establecerActualizandoEstadoId(null);
    }
  }

  async function imprimir() {
    try {
      const resultado = await obtenerImpresionProgramacionesApi(filtros);
      establecerImpresion(resultado);
      window.setTimeout(() => window.print(), 30);
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudo preparar el cronograma', text: error.message });
    }
  }

  return (
    <div className="cronograma-page">
      <div className="cronograma-screen-only">
        <EncabezadoPagina
          eyebrow="Agenda académica"
          title="Cronograma de sustentaciones"
          description="Organice, consulte e imprima las sustentaciones programadas."
          breadcrumbs={['Inicio', 'Seguimiento', 'Cronograma']}
          actions={(
            <div className="cronograma-header-actions">
              <button className="button button-outline" type="button" onClick={() => void cargarListado()} disabled={cargando}>
                <RefreshCw size={17} aria-hidden="true" /> Actualizar
              </button>
              <button className="button button-outline" type="button" onClick={() => void imprimir()} disabled={cargando || elementos.length === 0}>
                <Printer size={17} aria-hidden="true" /> Imprimir / guardar PDF
              </button>
              {puedeEditar && (
                <button className="button button-primary" type="button" onClick={abrirNuevaProgramacion}>
                  <FilePlus2 size={17} aria-hidden="true" /> Nueva programación
                </button>
              )}
            </div>
          )}
        />

        {capacidad && !capacidad.puedeAdministrar && (
          <AlertaInstitucional tono="warning" titulo="Edición no disponible">
            Su perfil puede consultar el cronograma, pero no crear ni modificar programaciones.
          </AlertaInstitucional>
        )}

        {errorCarga && (
          <AlertaInstitucional tono="danger" titulo="No fue posible cargar las programaciones">
            <p>{errorCarga.message}</p>
            <button className="button button-outline" type="button" onClick={() => void cargarListado()}>Reintentar</button>
          </AlertaInstitucional>
        )}

        {mostrarFormulario && (
          <section className="card cronograma-form-card" aria-labelledby="cronograma-form-title">
            <header className="cronograma-form-header">
              <div>
                <span className="section-kicker">Programación vigente</span>
                <h2 id="cronograma-form-title">{idEdicion ? 'Editar sustentación' : 'Agregar una sustentación'}</h2>
                <p>Una programación corresponde a un trabajo. Los estudiantes y el tribunal se consultan de sus registros existentes.</p>
              </div>
              <button className="icon-button" type="button" aria-label="Cerrar formulario" onClick={cerrarFormulario}><X size={19} /></button>
            </header>

            <form onSubmit={guardar} className="cronograma-form">
              {!idEdicion ? (
                <div className="field">
                  <label htmlFor="cronograma-trabajo">Trabajo habilitado</label>
                  <select id="cronograma-trabajo" className="input" value={idTrabajo} onChange={(evento) => establecerIdTrabajo(evento.target.value)} disabled={cargandoTrabajos} required>
                    <option value="">{cargandoTrabajos ? 'Cargando trabajos…' : 'Seleccione un trabajo'}</option>
                    {trabajosDisponibles.map((trabajo) => (
                      <option key={trabajo.idTrabajo} value={trabajo.idTrabajo}>
                        {trabajo.trabajo.codigo} · {trabajo.trabajo.titulo} — {trabajo.carrera.nombre}
                      </option>
                    ))}
                  </select>
                  {trabajosDisponibles.length === 0 && !cargandoTrabajos && <small>No hay trabajos elegibles sin programación. Se requieren dos evaluaciones escritas cerradas y un tribunal confirmado.</small>}
                </div>
              ) : (
                <div className="cronograma-selected-work">
                  <strong>{programacionEnEdicion?.trabajo.codigo} · {programacionEnEdicion?.trabajo.titulo}</strong>
                  <span>{programacionEnEdicion?.carrera.nombre} · período {programacionEnEdicion?.periodo.codigo}</span>
                </div>
              )}

              {trabajoSeleccionado && (
                <div className="cronograma-context-grid">
                  <div><strong>Estudiante(s)</strong><span>{personaLista(trabajoSeleccionado.estudiantes)}</span></div>
                  <div><strong>Tribunal confirmado</strong><span>{personaLista(trabajoSeleccionado.tribunal)}</span></div>
                  <div><strong>Carrera y período</strong><span>{trabajoSeleccionado.carrera.nombre} · {trabajoSeleccionado.periodo.codigo}</span></div>
                </div>
              )}

              <div className="cronograma-form-fields">
                <div className="field">
                  <label htmlFor="cronograma-fecha"><CalendarDays size={16} /> Fecha</label>
                  <input id="cronograma-fecha" className="input" type="date" value={formulario.fechaProgramada} onChange={(evento) => establecerFormulario((actual) => ({ ...actual, fechaProgramada: evento.target.value }))} required />
                </div>
                <div className="field">
                  <label htmlFor="cronograma-hora"><Clock3 size={16} /> Hora</label>
                  <input id="cronograma-hora" className="input" type="time" value={formulario.horaProgramada} onChange={(evento) => establecerFormulario((actual) => ({ ...actual, horaProgramada: evento.target.value }))} required />
                </div>
                <div className="field">
                  <label htmlFor="cronograma-sala"><MapPin size={16} /> Sala</label>
                  <input id="cronograma-sala" className="input" maxLength={160} value={formulario.sala} onChange={(evento) => establecerFormulario((actual) => ({ ...actual, sala: evento.target.value }))} placeholder="Ej. Sala 2" required />
                </div>
                <div className="field">
                  <label htmlFor="cronograma-duracion"><Clock3 size={16} /> Duración estimada (minutos)</label>
                  <input id="cronograma-duracion" className="input" type="number" min="1" max="240" step="1" value={formulario.duracionEstimadaMinutos} onChange={(evento) => establecerFormulario((actual) => ({ ...actual, duracionEstimadaMinutos: evento.target.value }))} required />
                  <small>Predeterminada: 60 minutos. Puede definir entre 1 y 240.</small>
                </div>
              </div>
              <p className="cronograma-conflict-note">Los horarios de una misma sala no pueden solaparse. Se permiten horarios consecutivos; las salas distintas no se bloquean entre sí.</p>
              <div className="cronograma-form-actions">
                <button className="button button-outline" type="button" onClick={cerrarFormulario} disabled={guardando}>Cancelar</button>
                <button className="button button-primary" type="submit" disabled={guardando || !puedeEditar || (!idEdicion && (cargandoTrabajos || trabajosDisponibles.length === 0))}>
                  <Save size={17} aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar programación'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="card cronograma-list-card" aria-labelledby="cronograma-list-title">
          <header className="cronograma-list-header">
            <div><span className="section-kicker">Agenda institucional</span><h2 id="cronograma-list-title">Sustentaciones programadas</h2></div>
            <span className="cronograma-count">{cargando ? 'Cargando…' : `${elementos.length} registros`}</span>
          </header>

          <div className="cronograma-filters">
            <label className="field cronograma-search" htmlFor="cronograma-buscar">
              <span>Buscar trabajo, estudiante o tribunal</span>
              <span className="cronograma-search-input"><Search size={17} aria-hidden="true" /><input id="cronograma-buscar" className="input" value={buscar} onChange={(evento) => establecerBuscar(evento.target.value)} /></span>
            </label>
            <label className="field" htmlFor="cronograma-carrera"><span>Carrera</span>
              <select id="cronograma-carrera" className="input" value={carreraId} onChange={(evento) => establecerCarreraId(evento.target.value)}>
                <option value="">Todas las carreras</option>
                {catalogos.carreras.map((carrera) => <option key={carrera.id} value={carrera.id}>{carrera.nombre}</option>)}
              </select>
            </label>
            <label className="field" htmlFor="cronograma-periodo"><span>Período</span>
              <select id="cronograma-periodo" className="input" value={periodoId} onChange={(evento) => establecerPeriodoId(evento.target.value)}>
                <option value="">Todos los períodos</option>
                {catalogos.periodos.map((periodo) => <option key={periodo.id} value={periodo.id}>{periodo.codigo}</option>)}
              </select>
            </label>
            <label className="field" htmlFor="cronograma-estado"><span>Estado</span>
              <select id="cronograma-estado" className="input" value={estado} onChange={(evento) => establecerEstado(evento.target.value)}>
                <option value="PROGRAMADA">Programadas</option>
                <option value="EN_SUSTENTACION">En sustentación</option>
                <option value="FINALIZADA">Finalizadas</option>
                <option value="CANCELADA">Canceladas</option>
                <option value="">Todos los estados</option>
              </select>
            </label>
          </div>

          {cargando ? <p className="cronograma-loading" role="status">Cargando cronograma…</p> : null}
          {!cargando && !errorCarga && elementos.length === 0 ? (
            <div className="cronograma-empty"><CalendarDays size={30} aria-hidden="true" /><h3>No hay sustentaciones para estos filtros</h3><p>Pruebe otro período, carrera o estado, o agregue un trabajo elegible.</p></div>
          ) : null}
          {!cargando && elementos.length > 0 ? (
            <div className="cronograma-table-wrap" role="region" aria-label="Tabla de sustentaciones programadas" tabIndex="0">
              <table className="cronograma-table">
                <caption className="sr-only">Sustentaciones programadas y acciones disponibles</caption>
                <thead><tr><th>Fecha</th><th>Horario estimado</th><th>Estudiante(s)</th><th>Trabajo</th><th>Tribunal</th><th>Sala</th><th>Estado y hora real</th><th>Acciones</th></tr></thead>
                <tbody>
                  {elementos.map((elemento) => (
                    <tr key={elemento.id}>
                      <td data-label="Fecha">{mostrarFecha(elemento.fechaProgramada)}</td>
                      <td data-label="Horario estimado"><strong>{rangoEstimado(elemento.fechaProgramada, elemento.horaProgramada, elemento.duracionEstimadaMinutos)}</strong><small>{elemento.duracionEstimadaMinutos} min estimados</small></td>
                      <td data-label="Estudiante(s)">{personaLista(elemento.estudiantes)}</td>
                      <td data-label="Trabajo"><Link className="cronograma-work-link" to={`/trabajos/${elemento.idTrabajo}`}>{elemento.trabajo.codigo}</Link><span>{elemento.trabajo.titulo}</span><small>{elemento.carrera.nombre} · {elemento.periodo.codigo}</small></td>
                      <td data-label="Tribunal">{elemento.tribunal.length ? elemento.tribunal.map((miembro) => <span className="cronograma-persona" key={miembro.id}><UsersRound size={14} /> {miembro.posicion}. {nombre(miembro)}</span>) : 'Sin tribunal confirmado'}</td>
                      <td data-label="Sala">{elemento.sala}</td>
                      <td data-label="Estado y hora real"><span className={`cronograma-status cronograma-status-${elemento.estado.toLowerCase()}`}>{etiquetaEstado(elemento.estado)}</span><small className="cronograma-actual-time">{resumenTiempoReal(elemento)}</small></td>
                      <td data-label="Acciones"><div className="cronograma-row-actions">
                        {elemento.estado === 'PROGRAMADA' && puedeEditar && <>
                          <button className="button button-outline cronograma-edit-button" type="button" onClick={() => abrirEdicion(elemento)}><Pencil size={15} aria-hidden="true" /> Editar</button>
                          <button className="button button-outline cronograma-edit-button" type="button" disabled={actualizandoEstadoId === elemento.id} onClick={() => void cambiarEstado(elemento, 'EN_SUSTENTACION')}><Play size={15} aria-hidden="true" /> Iniciar</button>
                          <button className="button button-outline cronograma-edit-button" type="button" disabled={actualizandoEstadoId === elemento.id} onClick={() => void cambiarEstado(elemento, 'CANCELADA')}><Ban size={15} aria-hidden="true" /> Cancelar</button>
                        </>}
                        {elemento.estado === 'EN_SUSTENTACION' && puedeEditar && <button className="button button-outline cronograma-edit-button" type="button" disabled={actualizandoEstadoId === elemento.id} onClick={() => void cambiarEstado(elemento, 'FINALIZADA')}><CheckCircle2 size={15} aria-hidden="true" /> Finalizar</button>}
                        {(!puedeEditar || !['PROGRAMADA', 'EN_SUSTENTACION'].includes(elemento.estado)) && <span className="cronograma-readonly">Solo consulta</span>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>

      {impresion && (
        <section className="cronograma-print" aria-label="Documento para impresión">
          <header className="cronograma-print-header">
            <p>GESTIÓN DE TITULACIÓN</p>
            <h1>CRONOGRAMA DE SUSTENTACIONES</h1>
            <p>Facultad de Ciencias de la Vida y Tecnologías</p>
            <p>Carrera: {nombreCarrera(impresion.filtros, filtros.carreraId)} · Período: {codigoPeriodo(impresion.filtros, filtros.periodoId)}</p>
            <p>Generado: {new Date(impresion.generadoEn).toLocaleString('es-EC')}</p>
          </header>
          <table className="cronograma-print-table">
            <thead><tr><th>Fecha</th><th>Horario estimado</th><th>Horario real registrado</th><th>Estudiantes</th><th>Tema del trabajo</th><th>Tribunal</th><th>Sala</th></tr></thead>
            <tbody>{impresion.elementos.map((elemento) => (
              <tr key={elemento.id}>
                <td>{mostrarFecha(elemento.fechaProgramada)}</td><td>{rangoEstimado(elemento.fechaProgramada, elemento.horaProgramada, elemento.duracionEstimadaMinutos)}<br /><small>{elemento.duracionEstimadaMinutos} min estimados</small></td>
                <td>{resumenTiempoReal(elemento)}</td>
                <td>{personaLista(elemento.estudiantes)}</td>
                <td>{elemento.trabajo.titulo}<br /><small>{elemento.trabajo.codigo} · {elemento.carrera.nombre} · período {elemento.periodo.codigo}</small></td>
                <td>{elemento.tribunal.map((miembro) => `${miembro.posicion}. ${nombre(miembro)}`).join('; ')}</td>
                <td>{elemento.sala}</td>
              </tr>
            ))}</tbody>
          </table>
          {impresion.elementos.length === 0 && <p>No hay sustentaciones para imprimir con los filtros seleccionados.</p>}
        </section>
      )}
    </div>
  );
}
