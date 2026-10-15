import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { Plus, Trash2 } from 'lucide-react';
import { ROL } from '../datos/datosPrototipo';
import { confirmarDescarteCambios, usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';
import { validarFormularioTrabajo } from '../dominio/validacionFormulariosHeredados';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { AlertaInstitucional, EncabezadoPagina } from '../componentes/interfaz';

const estudianteVacio = () => ({ cedula: '', nombres: '', apellidos: '', carrera: 'Tecnologías de la Información' });

function EtiquetaObligatoria({ children }) {
  return <>{children} <span className="required-indicator" aria-hidden="true">*</span><span className="sr-only"> (obligatorio)</span></>;
}

export default function PaginaFormularioTrabajo() {
  const { estado, actorActual, despachar } = usarPrototipo();
  const navegar = useNavigate();
  const puedeGestionar = actorActual.roles.some((role) => [ROL.COMISION, ROL.ADMIN].includes(role));
  const docentes = estado.personas.filter((persona) => persona.tipoPersona === 'DOCENTE');
  const modalidadesDisponibles = (estado.modalidades ?? []).filter((modalidad) => modalidad.estaActivo);
  const periodosDisponibles = (estado.periodosAcademicos ?? []).filter((periodo) => periodo.estaActivo);
  const rubricaPredeterminada = estado.versionesRubrica.find((rubrica) => rubrica.estado === 'ACTIVA');
  const formularioInicial = useRef({
    titulo: '',
    modalidad: rubricaPredeterminada?.modalidad ?? modalidadesDisponibles[0]?.nombre ?? '',
    periodo: rubricaPredeterminada?.periodo ?? periodosDisponibles[0]?.codigo ?? '',
    carrera: 'Tecnologías de la Información',
    idTutor: '',
  });
  const estudiantesIniciales = useRef([estudianteVacio()]);
  const [formulario, establecerFormulario] = useState(formularioInicial.current);
  const [estudiantes, establecerEstudiantes] = useState(estudiantesIniciales.current);
  const [errores, establecerErrores] = useState({});
  const [guardado, establecerGuardado] = useState(false);
  const tieneCambios = !guardado && (
    JSON.stringify(formulario) !== JSON.stringify(formularioInicial.current)
    || JSON.stringify(estudiantes) !== JSON.stringify(estudiantesIniciales.current)
  );
  const rubricaAsignada = estado.versionesRubrica.find((elemento) => elemento.estado === 'ACTIVA' && elemento.modalidad === formulario.modalidad && elemento.periodo === formulario.periodo);

  usarAdvertenciaCambiosSinGuardar(tieneCambios, () => {
    establecerFormulario({ ...formularioInicial.current });
    establecerEstudiantes(estudiantesIniciales.current.map((estudiante) => ({ ...estudiante })));
    establecerErrores({});
  });

  if (!puedeGestionar) return <AlertaInstitucional tono="warning" titulo="Acción no disponible">Solo Comisión Académica o Administración puede registrar trabajos.</AlertaInstitucional>;

  const limpiarError = (...claves) => establecerErrores((actuales) => {
    const siguientes = { ...actuales };
    claves.forEach((clave) => delete siguientes[clave]);
    return siguientes;
  });

  const actualizarFormulario = (campo, valor) => {
    establecerGuardado(false);
    establecerFormulario((actual) => ({ ...actual, [campo]: valor }));
    limpiarError(campo);
  };

  const cambiarEstudiante = (indice, campo, valor) => {
    establecerGuardado(false);
    establecerEstudiantes((elementos) => elementos.map((elemento, indiceElemento) => indiceElemento === indice ? { ...elemento, [campo]: valor } : elemento));
    if (campo === 'cedula') limpiarError(...estudiantes.map((_, posicion) => `estudiantes.${posicion}.cedula`));
    else limpiarError(`estudiantes.${indice}.${campo}`);
  };

  const agregarEstudiante = () => {
    establecerGuardado(false);
    establecerEstudiantes((actuales) => [...actuales, estudianteVacio()]);
  };

  const eliminarEstudiante = (indice) => {
    establecerGuardado(false);
    establecerEstudiantes((actuales) => actuales.filter((_, posicion) => posicion !== indice));
    establecerErrores({});
  };

  const cancelar = () => {
    if (!confirmarDescarteCambios()) return;
    navegar('/trabajos');
  };

  const idCampoError = (clave) => {
    if (clave === 'titulo') return 'trabajo-title';
    if (clave === 'idTutor') return 'trabajo-tutor';
    const [, indice, campo] = clave.split('.');
    if (campo === 'cedula') return `estudiante-id-${indice}`;
    if (campo === 'nombres') return `estudiante-names-${indice}`;
    return `estudiante-lastnames-${indice}`;
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    const erroresValidacion = validarFormularioTrabajo(formulario, estudiantes);
    establecerErrores(erroresValidacion);
    if (Object.keys(erroresValidacion).length > 0) {
      const tieneDuplicados = Object.values(erroresValidacion).some((mensaje) => mensaje === 'La cédula debe ser diferente para cada estudiante.');
      await Swal.fire({
        icon: 'warning',
        title: tieneDuplicados ? 'Estudiantes duplicados' : 'Información incompleta',
        text: tieneDuplicados ? 'Cada estudiante debe tener una cédula diferente.' : 'Complete el título, tutor y los datos de cada estudiante.',
      });
      const primerCampoInvalido = idCampoError(Object.keys(erroresValidacion)[0]);
      window.setTimeout(() => document.getElementById(primerCampoInvalido)?.focus(), 300);
      return;
    }
    const sufijo = Date.now().toString(36);
    const estudiantesCreados = estudiantes.map((estudiante, indice) => ({ ...estudiante, id: `estudiante-${sufijo}-${indice + 1}`, tipoPersona: 'ESTUDIANTE', cedula: estudiante.cedula.trim(), nombres: estudiante.nombres.trim(), apellidos: estudiante.apellidos.trim() }));
    const rubrica = estado.versionesRubrica.find((elemento) => elemento.estado === 'ACTIVA' && elemento.modalidad === formulario.modalidad && elemento.periodo === formulario.periodo);
    if (!rubrica) {
      await Swal.fire({ icon: 'error', title: 'No existe una rúbrica vigente', text: 'Active una versión para esta modalidad y período antes de registrar el trabajo.' });
      return;
    }
    const id = `trabajo-${sufijo}`;
    const trabajo = {
      id,
      codigo: `TT-${formulario.periodo.slice(0, 4)}-${String(estado.trabajos.length + 1).padStart(4, '0')}`,
      titulo: formulario.titulo.trim(), modalidad: formulario.modalidad, periodo: formulario.periodo, carrera: formulario.carrera,
      idsEstudiantes: estudiantesCreados.map((estudiante) => estudiante.id), idTutor: formulario.idTutor, idsTribunal: [],
      idVersionRubrica: rubrica.id, registradoEn: new Date().toISOString(), programacion: null,
    };
    establecerGuardado(true);
    despachar({ tipo: 'REGISTRAR_TRABAJO', trabajo, estudiantes: estudiantesCreados });
    await Swal.fire({ icon: 'success', title: 'Trabajo registrado', text: 'Ahora puede asignar los dos miembros del tribunal.', confirmButtonText: 'Continuar' });
    navegar(`/trabajos/${id}`);
  };

  const entradasErrores = Object.entries(errores);

  return (
    <>
      <EncabezadoPagina title="Registrar trabajo de titulación" description="La información del trabajo se registra en este sistema; no proviene de una API institucional." breadcrumbs={['Trabajos', 'Nuevo trabajo']} />
      <form onSubmit={enviar} noValidate>
        {entradasErrores.length > 0 && (
          <div className="form-validation-summary" role="alert" aria-labelledby="trabajo-errors-title">
            <strong id="trabajo-errors-title">Revise los campos indicados</strong>
            <ul>{entradasErrores.map(([clave, mensaje]) => <li key={clave}><a href={`#${idCampoError(clave)}`}>{mensaje}</a></li>)}</ul>
          </div>
        )}
        <section className="card">
          <div className="card-header"><h2>Datos del trabajo</h2><span className="badge badge-neutral">Estado inicial: Registrado</span></div>
          <div className="card-body form-grid">
            <div className={`field span-2 ${errores.titulo ? 'has-error' : ''}`}>
              <label htmlFor="trabajo-title"><EtiquetaObligatoria>Título del trabajo</EtiquetaObligatoria></label>
              <textarea id="trabajo-title" className="textarea" aria-required="true" value={formulario.titulo} aria-invalid={errores.titulo ? 'true' : undefined} aria-describedby={errores.titulo ? 'trabajo-title-error' : undefined} onChange={(evento) => actualizarFormulario('titulo', evento.target.value)} />
              {errores.titulo && <small className="field-error" id="trabajo-title-error">{errores.titulo}</small>}
            </div>
            <div className="field"><label htmlFor="trabajo-mode"><EtiquetaObligatoria>Modalidad</EtiquetaObligatoria></label><select id="trabajo-mode" className="select" aria-required="true" value={formulario.modalidad} onChange={(evento) => actualizarFormulario('modalidad', evento.target.value)}>{modalidadesDisponibles.map((modalidad) => <option key={modalidad.id} value={modalidad.nombre}>{modalidad.nombre}</option>)}</select></div>
            <div className="field"><label htmlFor="trabajo-periodo-formulario"><EtiquetaObligatoria>Período académico</EtiquetaObligatoria></label><select id="trabajo-periodo-formulario" className="select" aria-required="true" value={formulario.periodo} onChange={(evento) => actualizarFormulario('periodo', evento.target.value)}>{periodosDisponibles.map((periodo) => <option key={periodo.id} value={periodo.codigo}>{periodo.codigo}</option>)}</select></div>
            <div className="field span-2"><span className="field-label">Rúbrica que se asociará</span><AlertaInstitucional tono={rubricaAsignada ? 'info' : 'warning'} titulo={rubricaAsignada ? `${rubricaAsignada.titulo} · ${rubricaAsignada.version}` : 'No existe una versión vigente'}>{rubricaAsignada ? `Se conservará esta versión para el trabajo del período ${formulario.periodo}.` : 'Seleccione otra combinación o active primero una versión para esta modalidad y período.'}</AlertaInstitucional></div>
            <div className="field"><label htmlFor="trabajo-carrera-formulario"><EtiquetaObligatoria>Carrera</EtiquetaObligatoria></label><select id="trabajo-carrera-formulario" className="select" aria-required="true" value={formulario.carrera} onChange={(evento) => actualizarFormulario('carrera', evento.target.value)}><option>Tecnologías de la Información</option><option>Software</option><option>Agropecuaria</option><option>Ingeniería Ambiental</option></select></div>
            <div className={`field ${errores.idTutor ? 'has-error' : ''}`}>
              <label htmlFor="trabajo-tutor"><EtiquetaObligatoria>Tutor</EtiquetaObligatoria></label>
              <select id="trabajo-tutor" className="select" aria-required="true" value={formulario.idTutor} aria-invalid={errores.idTutor ? 'true' : undefined} aria-describedby={errores.idTutor ? 'trabajo-tutor-error trabajo-tutor-help' : 'trabajo-tutor-help'} onChange={(evento) => actualizarFormulario('idTutor', evento.target.value)}><option value="">Seleccione un docente</option>{docentes.map((docente) => <option key={docente.id} value={docente.id}>{docente.nombres} {docente.apellidos} · {docente.carrera}</option>)}</select>
              {errores.idTutor && <small className="field-error" id="trabajo-tutor-error">{errores.idTutor}</small>}
              <small id="trabajo-tutor-help">El tutor es un docente; no se crea un tipo de persona separado.</small>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-header"><div><h2>Estudiantes / autores</h2><p className="text-muted mb-0">El trabajo debe tener uno o más estudiantes. Los campos marcados con * son obligatorios.</p></div><button className="button button-sm button-outline" type="button" onClick={agregarEstudiante}><Plus size={17} /> Agregar estudiante</button></div>
          <div className="card-body stack">
            {estudiantes.map((estudiante, indice) => {
              const claveCedula = `estudiantes.${indice}.cedula`;
              const claveNombres = `estudiantes.${indice}.nombres`;
              const claveApellidos = `estudiantes.${indice}.apellidos`;
              return (
                <fieldset className="estudiante-fieldset" key={indice}>
                  <legend>Estudiante {indice + 1}</legend>
                  <div className="estudiante-fields">
                    <div className={`field ${errores[claveCedula] ? 'has-error' : ''}`}><label htmlFor={`estudiante-id-${indice}`}><EtiquetaObligatoria>Cédula</EtiquetaObligatoria></label><input id={`estudiante-id-${indice}`} className="input" aria-required="true" value={estudiante.cedula} aria-invalid={errores[claveCedula] ? 'true' : undefined} aria-describedby={errores[claveCedula] ? `estudiante-id-${indice}-error` : undefined} onChange={(evento) => cambiarEstudiante(indice, 'cedula', evento.target.value)} />{errores[claveCedula] && <small className="field-error" id={`estudiante-id-${indice}-error`}>{errores[claveCedula]}</small>}</div>
                    <div className={`field ${errores[claveNombres] ? 'has-error' : ''}`}><label htmlFor={`estudiante-names-${indice}`}><EtiquetaObligatoria>Nombres</EtiquetaObligatoria></label><input id={`estudiante-names-${indice}`} className="input" aria-required="true" value={estudiante.nombres} aria-invalid={errores[claveNombres] ? 'true' : undefined} aria-describedby={errores[claveNombres] ? `estudiante-names-${indice}-error` : undefined} onChange={(evento) => cambiarEstudiante(indice, 'nombres', evento.target.value)} />{errores[claveNombres] && <small className="field-error" id={`estudiante-names-${indice}-error`}>{errores[claveNombres]}</small>}</div>
                    <div className={`field ${errores[claveApellidos] ? 'has-error' : ''}`}><label htmlFor={`estudiante-lastnames-${indice}`}><EtiquetaObligatoria>Apellidos</EtiquetaObligatoria></label><input id={`estudiante-lastnames-${indice}`} className="input" aria-required="true" value={estudiante.apellidos} aria-invalid={errores[claveApellidos] ? 'true' : undefined} aria-describedby={errores[claveApellidos] ? `estudiante-lastnames-${indice}-error` : undefined} onChange={(evento) => cambiarEstudiante(indice, 'apellidos', evento.target.value)} />{errores[claveApellidos] && <small className="field-error" id={`estudiante-lastnames-${indice}-error`}>{errores[claveApellidos]}</small>}</div>
                    {estudiantes.length > 1 && <button className="button button-danger icon-button" type="button" aria-label={`Eliminar estudiante ${indice + 1}`} onClick={() => eliminarEstudiante(indice)}><Trash2 size={18} /></button>}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </section>
        <p className={`form-change-status ${tieneCambios ? 'has-changes' : ''}`} role="status">{tieneCambios ? 'Cambios sin guardar. Registre el trabajo para conservarlos.' : 'Sin cambios pendientes.'}</p>
        <div className="form-actions"><button className="button button-outline" type="button" onClick={cancelar}>Cancelar</button><button className="button button-primary" type="submit">Registrar trabajo</button></div>
      </form>
    </>
  );
}
