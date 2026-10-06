import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Plus, Trash2 } from 'lucide-react';
import { ROL } from '../datos/datosPrototipo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina } from '../componentes/interfaz';

const estudianteVacio = () => ({ cedula: '', nombres: '', apellidos: '', carrera: 'Tecnologías de la Información' });

export default function PaginaFormularioTrabajo() {
  const { estado, actorActual, despachar } = usarPrototipo();
  const navegar = useNavigate();
  const puedeGestionar = actorActual.roles.some((role) => [ROL.COMISION, ROL.ADMIN].includes(role));
  const docentes = estado.personas.filter((persona) => persona.tipoPersona === 'DOCENTE');
  const modalidadesDisponibles = (estado.modalidades ?? []).filter((modalidad) => modalidad.estaActivo);
  const periodosDisponibles = (estado.periodosAcademicos ?? []).filter((periodo) => periodo.estaActivo);
  const rubricaPredeterminada = estado.versionesRubrica.find((rubrica) => rubrica.estado === 'ACTIVA');
  const [formulario, establecerFormulario] = useState({
    titulo: '',
    modalidad: rubricaPredeterminada?.modalidad ?? modalidadesDisponibles[0]?.nombre ?? '',
    periodo: rubricaPredeterminada?.periodo ?? periodosDisponibles[0]?.codigo ?? '',
    carrera: 'Tecnologías de la Información',
    idTutor: '',
  });
  const [estudiantes, establecerEstudiantes] = useState([estudianteVacio()]);
  const rubricaAsignada = estado.versionesRubrica.find((elemento) => elemento.estado === 'ACTIVA' && elemento.modalidad === formulario.modalidad && elemento.periodo === formulario.periodo);

  if (!puedeGestionar) return <div className="alert alert-warning"><span>!</span><div><strong>Acción no disponible</strong>Solo Comisión Académica o Administración puede registrar trabajos.</div></div>;

  const cambiarEstudiante = (indice, field, value) => establecerEstudiantes((elementos) => elementos.map((elemento, indiceElemento) => indiceElemento === indice ? { ...elemento, [field]: value } : elemento));
  const enviar = async (evento) => {
    evento.preventDefault();
    const estudiantesCompletos = estudiantes.every((estudiante) => estudiante.cedula.trim() && estudiante.nombres.trim() && estudiante.apellidos.trim());
    if (!formulario.titulo.trim() || !formulario.idTutor || !estudiantesCompletos) {
      await Swal.fire({ icon: 'warning', title: 'Información incompleta', text: 'Complete el título, tutor y los datos de cada estudiante.' });
      return;
    }
    const identificacionesDuplicadas = new Set(estudiantes.map((estudiante) => estudiante.cedula.trim()));
    if (identificacionesDuplicadas.size !== estudiantes.length) {
      await Swal.fire({ icon: 'warning', title: 'Estudiantes duplicados', text: 'Cada estudiante debe tener una cédula diferente.' });
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
    despachar({ tipo: 'REGISTRAR_TRABAJO', trabajo, estudiantes: estudiantesCreados });
    await Swal.fire({ icon: 'success', title: 'Trabajo registrado', text: 'Ahora puede asignar los dos miembros del tribunal.', confirmButtonText: 'Continuar' });
    navegar(`/trabajos/${id}`);
  };

  return (
    <>
      <EncabezadoPagina title="Registrar trabajo de titulación" description="La información del trabajo se registra en este sistema; no proviene de una API institucional." breadcrumbs={['Trabajos', 'Nuevo trabajo']} />
      <form onSubmit={enviar}>
        <section className="card">
          <div className="card-header"><h2>Datos del trabajo</h2><span className="badge badge-neutral">Estado inicial: Registrado</span></div>
          <div className="card-body form-grid">
            <div className="field span-2"><label htmlFor="trabajo-title">Título del trabajo</label><textarea id="trabajo-title" className="textarea" value={formulario.titulo} onChange={(evento) => establecerFormulario({ ...formulario, titulo: evento.target.value })} /></div>
            <div className="field"><label htmlFor="trabajo-mode">Modalidad</label><select id="trabajo-mode" className="select" value={formulario.modalidad} onChange={(evento) => establecerFormulario({ ...formulario, modalidad: evento.target.value })}>{modalidadesDisponibles.map((modalidad) => <option key={modalidad.id} value={modalidad.nombre}>{modalidad.nombre}</option>)}</select></div>
            <div className="field"><label htmlFor="trabajo-periodo-formulario">Período académico</label><select id="trabajo-periodo-formulario" className="select" value={formulario.periodo} onChange={(evento) => establecerFormulario({ ...formulario, periodo: evento.target.value })}>{periodosDisponibles.map((periodo) => <option key={periodo.id} value={periodo.codigo}>{periodo.codigo}</option>)}</select></div>
            <div className="field span-2"><label>Rúbrica que se asociará</label><div className={`alert ${rubricaAsignada ? 'alert-info' : 'alert-warning'}`}><span>{rubricaAsignada ? 'ⓘ' : '!'}</span><div><strong>{rubricaAsignada ? `${rubricaAsignada.titulo} · ${rubricaAsignada.version}` : 'No existe una versión vigente'}</strong>{rubricaAsignada ? `Se conservará esta versión para el trabajo del período ${formulario.periodo}.` : 'Seleccione otra combinación o active primero una versión para esta modalidad y período.'}</div></div></div>
            <div className="field"><label htmlFor="trabajo-carrera-formulario">Carrera</label><select id="trabajo-carrera-formulario" className="select" value={formulario.carrera} onChange={(evento) => establecerFormulario({ ...formulario, carrera: evento.target.value })}><option>Tecnologías de la Información</option><option>Software</option><option>Agropecuaria</option><option>Ingeniería Ambiental</option></select></div>
            <div className="field"><label htmlFor="trabajo-tutor">Tutor</label><select id="trabajo-tutor" className="select" value={formulario.idTutor} onChange={(evento) => establecerFormulario({ ...formulario, idTutor: evento.target.value })}><option value="">Seleccione un docente</option>{docentes.map((docente) => <option key={docente.id} value={docente.id}>{docente.nombres} {docente.apellidos} · {docente.carrera}</option>)}</select><small>El tutor es un docente; no se crea un tipo de persona separado.</small></div>
          </div>
        </section>
        <section className="card">
          <div className="card-header"><div><h2>Estudiantes / autores</h2><p className="text-muted mb-0">El trabajo debe tener uno o más estudiantes.</p></div><button className="button button-sm button-outline" type="button" onClick={() => establecerEstudiantes([...estudiantes, estudianteVacio()])}><Plus size={17} /> Agregar estudiante</button></div>
          <div className="card-body stack">
            {estudiantes.map((estudiante, indice) => (
              <fieldset className="estudiante-fieldset" key={indice}>
                <legend>Estudiante {indice + 1}</legend>
                <div className="estudiante-fields">
                  <div className="field"><label htmlFor={`estudiante-id-${indice}`}>Cédula</label><input id={`estudiante-id-${indice}`} className="input" value={estudiante.cedula} onChange={(evento) => cambiarEstudiante(indice, 'cedula', evento.target.value)} /></div>
                  <div className="field"><label htmlFor={`estudiante-names-${indice}`}>Nombres</label><input id={`estudiante-names-${indice}`} className="input" value={estudiante.nombres} onChange={(evento) => cambiarEstudiante(indice, 'nombres', evento.target.value)} /></div>
                  <div className="field"><label htmlFor={`estudiante-lastnames-${indice}`}>Apellidos</label><input id={`estudiante-lastnames-${indice}`} className="input" value={estudiante.apellidos} onChange={(evento) => cambiarEstudiante(indice, 'apellidos', evento.target.value)} /></div>
                  {estudiantes.length > 1 && <button className="button button-danger icon-button" type="button" aria-label={`Eliminar estudiante ${indice + 1}`} onClick={() => establecerEstudiantes(estudiantes.filter((_, indiceElemento) => indiceElemento !== indice))}><Trash2 size={18} /></button>}
                </div>
              </fieldset>
            ))}
          </div>
        </section>
        <div className="form-actions"><button className="button button-outline" type="button" onClick={() => navegar('/trabajos')}>Cancelar</button><button className="button button-primary" type="submit">Registrar trabajo</button></div>
      </form>
    </>
  );
}
