import { createContext, useContext, useEffect, useReducer } from 'react';
import { ESTADO_EVALUACION, crearEstadoInicial } from '../datos/datosPrototipo';
import { migrarDatosDemostracion } from '../datos/migracionesDemostracion';
import { estanCerradasRevisionesEscritas, puedeEditarTribunal } from '../dominio/flujoTrabajo';

const CLAVE_ALMACENAMIENTO = 'genares-prototipo-v3';
const ContextoPrototipo = createContext(null);

const ahora = () => new Date().toISOString();
const clonar = (value) => JSON.parse(JSON.stringify(value));

function notificacionParaPersona(estado, idPersona, notificacion) {
  void estado;
  return {
    id: `aviso-${Date.now()}-${idPersona}-${Math.random().toString(36).slice(2, 7)}`,
    idDestinatario: null,
    creadoEn: ahora(),
    leidoEn: null,
    ...notificacion,
  };
}

function crearEvaluacion(trabajo, idMiembro, rubrica) {
  return {
    id: `${trabajo.id}-${idMiembro}`,
    idTrabajo: trabajo.id,
    idMiembro,
    idVersionRubrica: rubrica.id,
    instantaneaRubrica: clonar(rubrica),
    escrita: { estado: ESTADO_EVALUACION.PENDIENTE, calificaciones: {}, observaciones: {} },
    oralPorEstudiante: {},
  };
}

function reductor(estado, accion) {
  switch (accion.tipo) {
    case 'REGISTRAR_TRABAJO': {
      return {
        ...estado,
        personas: [...estado.personas, ...accion.estudiantes],
        trabajos: [accion.trabajo, ...estado.trabajos],
      };
    }

    case 'CREAR_VERSION_RUBRICA': {
      if (!accion.rubrica || estado.versionesRubrica.some((elemento) => elemento.id === accion.rubrica.id)) return estado;
      return { ...estado, versionesRubrica: [clonar(accion.rubrica), ...estado.versionesRubrica] };
    }

    case 'GUARDAR_VERSION_RUBRICA': {
      return {
        ...estado,
        versionesRubrica: estado.versionesRubrica.map((rubrica) => (
          rubrica.id === accion.idRubrica && rubrica.estado === 'BORRADOR'
            ? { ...rubrica, etapas: clonar(accion.etapas), categorias: clonar(accion.categorias) }
            : rubrica
        )),
      };
    }

    case 'ACTIVAR_VERSION_RUBRICA': {
      const seleccionado = estado.versionesRubrica.find((rubrica) => rubrica.id === accion.idRubrica);
      if (!seleccionado || seleccionado.estado !== 'BORRADOR') return estado;
      const activadoEn = ahora();
      return {
        ...estado,
        versionesRubrica: estado.versionesRubrica.map((rubrica) => {
          if (rubrica.id === seleccionado.id) return { ...rubrica, estado: 'ACTIVA', activadoEn, vigenteDesde: activadoEn.slice(0, 10) };
          if (rubrica.estado === 'ACTIVA' && rubrica.modalidad === seleccionado.modalidad && rubrica.periodo === seleccionado.periodo) {
            return { ...rubrica, estado: 'ARCHIVADA', vigenteHasta: activadoEn.slice(0, 10) };
          }
          return rubrica;
        }),
      };
    }

    case 'ASIGNAR_TRIBUNAL': {
      const trabajo = estado.trabajos.find((elemento) => elemento.id === accion.idTrabajo);
      if (!trabajo || accion.idsMiembros.length !== 2 || new Set(accion.idsMiembros).size !== 2 || !puedeEditarTribunal(estado, trabajo)) return estado;
      const rubrica = estado.versionesRubrica.find((elemento) => elemento.id === trabajo.idVersionRubrica);
      if (!rubrica) return estado;
      const trabajoActualizado = { ...trabajo, idsTribunal: [...accion.idsMiembros], tribunalAsignadoEn: ahora() };
      const noRelacionadas = estado.evaluaciones.filter((evaluacion) => evaluacion.idTrabajo !== trabajo.id);
      const nuevasEvaluaciones = accion.idsMiembros.map((idMiembro) => crearEvaluacion(trabajoActualizado, idMiembro, rubrica));
      const notificaciones = accion.idsMiembros
        .map((idMiembro) => notificacionParaPersona(estado, idMiembro, {
          tipo: 'TRIBUNAL_ASIGNADO', idTrabajo: trabajo.id,
          titulo: 'Nueva asignación de tribunal',
          mensaje: `Ha sido asignado como miembro del tribunal del trabajo “${trabajo.titulo}”.`,
          ruta: '/mis-evaluaciones',
        }))
        .filter(Boolean);
      return {
        ...estado,
        trabajos: estado.trabajos.map((elemento) => elemento.id === trabajo.id ? trabajoActualizado : elemento),
        evaluaciones: [...noRelacionadas, ...nuevasEvaluaciones],
        notificaciones: [...notificaciones, ...estado.notificaciones],
      };
    }

    case 'GUARDAR_ESCRITA':
    case 'FINALIZAR_ESCRITA': {
      const evaluacion = estado.evaluaciones.find((elemento) => elemento.id === accion.idEvaluacion);
      if (!evaluacion || evaluacion.escrita.estado === ESTADO_EVALUACION.CERRADA) return estado;
      const cerrando = accion.tipo === 'FINALIZAR_ESCRITA';
      const evaluaciones = estado.evaluaciones.map((elemento) => elemento.id === accion.idEvaluacion ? {
        ...elemento,
        escrita: {
          ...elemento.escrita,
          calificaciones: clonar(accion.calificaciones),
          observaciones: clonar(accion.observaciones ?? {}),
          estado: cerrando ? ESTADO_EVALUACION.CERRADA : ESTADO_EVALUACION.BORRADOR,
          updatedAt: ahora(),
          ...(cerrando ? { finalizedAt: ahora() } : {}),
        },
      } : elemento);
      let notificaciones = estado.notificaciones;
      if (cerrando) {
        const estadoIntermedio = { ...estado, evaluaciones };
        const trabajo = estado.trabajos.find((elemento) => elemento.id === evaluacion.idTrabajo);
        if (trabajo && estanCerradasRevisionesEscritas(estadoIntermedio, trabajo)) {
          const generadas = [{
            id: `aviso-${Date.now()}-${trabajo.id}`, idDestinatario: null, tipo: 'REVISION_ESCRITA_COMPLETADA', idTrabajo: trabajo.id,
            titulo: 'Revisión escrita completada', mensaje: `Los dos miembros completaron la revisión escrita de ${trabajo.codigo}. Ya puede programar la sustentación.`,
            ruta: `/trabajos/${trabajo.id}/sustentacion`, creadoEn: ahora(), leidoEn: null,
          }];
          notificaciones = [...generadas, ...notificaciones];
        }
      }
      return { ...estado, evaluaciones, notificaciones };
    }

    case 'PROGRAMAR_SUSTENTACION': {
      const trabajo = estado.trabajos.find((elemento) => elemento.id === accion.idTrabajo);
      if (!trabajo || !estanCerradasRevisionesEscritas(estado, trabajo)) return estado;
      const programacion = { ...accion.programacion, programadoEn: ahora() };
      const notificaciones = trabajo.idsTribunal
        .map((idMiembro) => notificacionParaPersona(estado, idMiembro, {
          tipo: 'SUSTENTACION_PROGRAMADA', idTrabajo: trabajo.id, titulo: 'Sustentación programada',
          mensaje: `Se ha programado la sustentación del trabajo ${trabajo.codigo} para el ${programacion.fecha.split('-').reverse().join('/')} a las ${programacion.hora}, ${programacion.sala}.`,
          ruta: `/trabajos/${trabajo.id}`,
        }))
        .filter(Boolean);
      return {
        ...estado,
        trabajos: estado.trabajos.map((elemento) => elemento.id === trabajo.id ? { ...elemento, programacion } : elemento),
        notificaciones: [...notificaciones, ...estado.notificaciones],
      };
    }

    case 'GUARDAR_ORAL':
    case 'FINALIZAR_ORAL': {
      const evaluacion = estado.evaluaciones.find((elemento) => elemento.id === accion.idEvaluacion);
      const existente = evaluacion?.oralPorEstudiante?.[accion.idEstudiante];
      if (!evaluacion || existente?.estado === ESTADO_EVALUACION.CERRADA) return estado;
      const cerrando = accion.tipo === 'FINALIZAR_ORAL';
      return {
        ...estado,
        evaluaciones: estado.evaluaciones.map((elemento) => elemento.id === accion.idEvaluacion ? {
          ...elemento,
          oralPorEstudiante: {
            ...elemento.oralPorEstudiante,
            [accion.idEstudiante]: {
              ...existente,
              calificaciones: clonar(accion.calificaciones),
              observaciones: clonar(accion.observaciones ?? {}),
              estado: cerrando ? ESTADO_EVALUACION.CERRADA : ESTADO_EVALUACION.BORRADOR,
              updatedAt: ahora(),
              ...(cerrando ? { finalizedAt: ahora() } : {}),
            },
          },
        } : elemento),
      };
    }

    case 'MARK_NOTIFICATION_READ':
      return { ...estado, notificaciones: estado.notificaciones.map((elemento) => elemento.id === accion.idNotificacion ? { ...elemento, leidoEn: elemento.leidoEn ?? ahora() } : elemento) };

    case 'MARK_ALL_NOTIFICATIONS_READ':
      return { ...estado, notificaciones: estado.notificaciones.map((elemento) => ({ ...elemento, leidoEn: elemento.leidoEn ?? ahora() })) };

    case 'REINICIAR_PROTOTIPO':
      return crearEstadoInicial();

    default:
      return estado;
  }
}

function cargarEstado() {
  try {
    const inicial = crearEstadoInicial();
    const almacenado = window.localStorage.getItem(CLAVE_ALMACENAMIENTO);
    if (!almacenado) return inicial;
    const analizado = JSON.parse(almacenado);
    if (!Array.isArray(analizado.trabajos) || !Array.isArray(analizado.evaluaciones)) return inicial;
    const { actores: perfilesAntiguos, idActorActual: perfilAntiguo, ...datosAcademicos } = analizado;
    void perfilesAntiguos;
    void perfilAntiguo;

    if (Number(analizado.schemaVersion || 0) < inicial.schemaVersion) {
      const idsIncorporados = new Set(inicial.versionesRubrica.map((rubrica) => rubrica.id));
      const versionesPersonalizadas = (analizado.versionesRubrica ?? []).filter((rubrica) => !idsIncorporados.has(rubrica.id));
      return migrarDatosDemostracion({
        ...inicial,
        ...datosAcademicos,
        schemaVersion: inicial.schemaVersion,
        modalidades: inicial.modalidades,
        periodosAcademicos: inicial.periodosAcademicos,
        versionesRubrica: [...inicial.versionesRubrica, ...versionesPersonalizadas],
      }, inicial);
    }

    return {
      ...inicial,
      ...datosAcademicos,
      modalidades: Array.isArray(analizado.modalidades) ? analizado.modalidades : inicial.modalidades,
      periodosAcademicos: Array.isArray(analizado.periodosAcademicos) ? analizado.periodosAcademicos : inicial.periodosAcademicos,
      notificaciones: (Array.isArray(analizado.notificaciones) ? analizado.notificaciones : inicial.notificaciones)
        .map((notificacion) => ({ ...notificacion, idDestinatario: null })),
    };
  } catch {
    return crearEstadoInicial();
  }
}

export function ProveedorPrototipo({ children }) {
  const [estado, rawDispatch] = useReducer(reductor, undefined, cargarEstado);

  const despachar = (accion) => {
    rawDispatch(accion);
  };

  // Persist after React commits a new estado while keeping the reductor pure.
  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(estado));
    } catch { /* Prototype remains usable without storage. */ }
  }, [estado]);

  const value = {
    estado,
    despachar,
    reiniciarPrototipo: () => despachar({ tipo: 'REINICIAR_PROTOTIPO' }),
  };

  return <ContextoPrototipo.Provider value={value}>{children}</ContextoPrototipo.Provider>;
}

export function usarPrototipo() {
  const contexto = useContext(ContextoPrototipo);
  if (!contexto) throw new Error('usarPrototipo debe usarse dentro de ProveedorPrototipo');
  return contexto;
}
