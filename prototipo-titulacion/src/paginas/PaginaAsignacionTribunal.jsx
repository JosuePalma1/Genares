import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DialogoGenares as Swal } from '../componentes/dialogos';
import { usarAdvertenciaCambiosSinGuardar } from '../dominio/cambiosSinGuardar';
import { puedeEditarTribunal, nombreCompleto } from '../dominio/flujoTrabajo';
import { validarAsignacionTribunal } from '../dominio/validacionFormulariosHeredados';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { AlertaInstitucional, BotonVolver, EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';

export default function PaginaAsignacionTribunal() {
  const { idTrabajo } = useParams();
  const { estado, despachar } = usarPrototipo();
  const navegar = useNavigate();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const idsIniciales = useRef(trabajo?.idsTribunal?.length === 2 ? [...trabajo.idsTribunal] : ['', '']);
  const [idsMiembros, establecerIdsMiembros] = useState(idsIniciales.current);
  const [errores, establecerErrores] = useState({});
  const [guardado, establecerGuardado] = useState(false);
  const docentes = estado.personas.filter((persona) => persona.tipoPersona === 'DOCENTE' && persona.id !== trabajo?.idTutor);
  const esEditable = trabajo ? puedeEditarTribunal(estado, trabajo) : false;
  const tieneCambios = esEditable && !guardado && idsMiembros.some((id, indice) => id !== idsIniciales.current[indice]);
  const cargaTrabajo = useMemo(() => Object.fromEntries(docentes.map((docente) => [docente.id, estado.trabajos.filter((elemento) => elemento.idsTribunal.includes(docente.id)).length])), [docentes, estado.trabajos]);

  usarAdvertenciaCambiosSinGuardar(tieneCambios, () => {
    establecerIdsMiembros([...idsIniciales.current]);
    establecerErrores({});
  });

  if (!trabajo) return <EstadoVacio title="Trabajo no encontrado" />;

  const seleccionado = idsMiembros.map((id) => docentes.find((docente) => docente.id === id));

  const actualizarMiembro = (posicion, idMiembro) => {
    establecerGuardado(false);
    establecerIdsMiembros((actuales) => actuales.map((elemento, indice) => indice === posicion ? idMiembro : elemento));
    establecerErrores((actuales) => {
      const siguientes = { ...actuales };
      delete siguientes[`miembro.${posicion}`];
      delete siguientes[`miembro.${1 - posicion}`];
      return siguientes;
    });
  };

  const confirmar = async (evento) => {
    evento.preventDefault();
    const erroresValidacion = validarAsignacionTribunal(idsMiembros);
    establecerErrores(erroresValidacion);
    if (Object.keys(erroresValidacion).length > 0) {
      await Swal.fire({ icon: 'warning', title: 'Seleccione dos docentes distintos', text: 'El tribunal debe estar compuesto exactamente por dos miembros.' });
      const primerCampoInvalido = `tribunal-${Object.keys(erroresValidacion)[0].split('.')[1]}`;
      window.setTimeout(() => document.getElementById(primerCampoInvalido)?.focus(), 300);
      return;
    }
    const respuesta = await Swal.fire({
      icon: 'question', title: '¿Confirmar asignación?',
      text: `Se notificará internamente a ${seleccionado.map(nombreCompleto).join(' y ')}.`,
      showCancelButton: true, confirmButtonText: 'Confirmar asignación', cancelButtonText: 'Volver y revisar', reverseButtons: true,
    });
    if (!respuesta.isConfirmed) return;
    establecerGuardado(true);
    despachar({ tipo: 'ASIGNAR_TRIBUNAL', idTrabajo: trabajo.id, idsMiembros });
    await Swal.fire({ icon: 'success', title: 'Tribunal asignado', text: 'Se generó una notificación interna para cada miembro.', timer: 1800, showConfirmButton: false });
    navegar(`/trabajos/${trabajo.id}`);
  };

  const entradasErrores = Object.entries(errores);

  return (
    <>
      <EncabezadoPagina title="Asignación de tribunal" description="Seleccione manualmente dos docentes; el sistema solo muestra información de apoyo." breadcrumbs={['Trabajos', trabajo.codigo, 'Tribunal']} />
      {!esEditable && <AlertaInstitucional tono="warning" titulo="Asignación bloqueada">Al menos un miembro ya cerró la revisión escrita. Se conserva la asignación para proteger la evaluación histórica.</AlertaInstitucional>}
      <section className="card"><div className="card-header"><h2>Trabajo seleccionado</h2><InsigniaEstado tono="info">{trabajo.idsEstudiantes.length} estudiante(s)</InsigniaEstado></div><div className="card-body"><dl className="info-list"><div className="wide"><dt>Título</dt><dd>{trabajo.titulo}</dd></div><div><dt>Carrera</dt><dd>{trabajo.carrera}</dd></div><div><dt>Tutor</dt><dd>{nombreCompleto(estado.personas.find((persona) => persona.id === trabajo.idTutor))}</dd></div></dl></div></section>
      <form onSubmit={confirmar} noValidate>
        {entradasErrores.length > 0 && (
          <div className="form-validation-summary" role="alert" aria-labelledby="tribunal-errors-title">
            <strong id="tribunal-errors-title">Revise la selección del tribunal</strong>
            <ul>{entradasErrores.map(([clave, mensaje]) => <li key={clave}><a href={`#tribunal-${clave.split('.')[1]}`}>{mensaje}</a></li>)}</ul>
          </div>
        )}
        <div className="grid-2">
          <section className="card"><div className="card-header"><h2>Miembros del tribunal</h2><span className="badge badge-neutral">2 requeridos</span></div><div className="card-body stack">
            {[0, 1].map((posicion) => {
              const claveError = `miembro.${posicion}`;
              const idError = `tribunal-${posicion}-error`;
              return (
                <div className={`field ${errores[claveError] ? 'has-error' : ''}`} key={posicion}>
                  <label htmlFor={`tribunal-${posicion}`}>Miembro {posicion + 1} <span className="required-indicator" aria-hidden="true">*</span><span className="sr-only"> (obligatorio)</span></label>
                  <select id={`tribunal-${posicion}`} className="select" disabled={!esEditable} aria-required={esEditable ? 'true' : undefined} value={idsMiembros[posicion]} aria-invalid={errores[claveError] ? 'true' : undefined} aria-describedby={errores[claveError] ? idError : undefined} onChange={(evento) => actualizarMiembro(posicion, evento.target.value)}><option value="">Seleccione un docente</option>{docentes.map((docente) => <option key={docente.id} value={docente.id} disabled={idsMiembros[1 - posicion] === docente.id}>{nombreCompleto(docente)} · {docente.carrera} · {cargaTrabajo[docente.id]} tribunal(es)</option>)}</select>
                  {errores[claveError] && <small className="field-error" id={idError}>{errores[claveError]}</small>}
                </div>
              );
            })}
            <AlertaInstitucional className="mb-0" titulo="Selección no automatizada">La carrera y la carga actual se muestran como apoyo. La decisión corresponde a Comisión Académica.</AlertaInstitucional>
          </div></section>
          <section className="card"><div className="card-header"><h2>Resumen</h2></div><div className="card-body activity-list">{seleccionado.map((docente, indice) => docente ? <div className="activity-item" key={docente.id}><span className="avatar">{indice + 1}</span><div className="activity-content"><strong>{nombreCompleto(docente)}</strong><small>{docente.carrera} · {cargaTrabajo[docente.id]} asignación(es) actuales</small></div><InsigniaEstado tono="info">Seleccionado</InsigniaEstado></div> : <div className="activity-item" key={indice}><span className="avatar">{indice + 1}</span><div className="activity-content"><strong>Sin seleccionar</strong><small>Miembro {indice + 1}</small></div></div>)}</div>
            <div className="card-footer form-actions compact-actions"><span className={`form-change-status ${tieneCambios ? 'has-changes' : ''}`} role="status">{tieneCambios ? 'Cambios sin guardar' : 'Sin cambios pendientes'}</span><BotonVolver respaldo={`/trabajos/${trabajo.id}`} /><button className="button button-primary" type="submit" disabled={!esEditable}>Confirmar asignación</button></div>
          </section>
        </div>
      </form>
    </>
  );
}
