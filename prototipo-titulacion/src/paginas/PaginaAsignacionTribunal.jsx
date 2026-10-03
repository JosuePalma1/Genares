import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { puedeEditarTribunal, nombreCompleto } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina, InsigniaEstado, EstadoVacio } from '../componentes/interfaz';

export default function PaginaAsignacionTribunal() {
  const { idTrabajo } = useParams();
  const { estado, despachar } = usarPrototipo();
  const navegar = useNavigate();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const [idsMiembros, establecerIdsMiembros] = useState(trabajo?.idsTribunal?.length === 2 ? trabajo.idsTribunal : ['', '']);
  const docentes = estado.personas.filter((persona) => persona.tipoPersona === 'DOCENTE' && persona.id !== trabajo?.idTutor);
  const esEditable = trabajo ? puedeEditarTribunal(estado, trabajo) : false;
  const cargaTrabajo = useMemo(() => Object.fromEntries(docentes.map((docente) => [docente.id, estado.trabajos.filter((elemento) => elemento.idsTribunal.includes(docente.id)).length])), [docentes, estado.trabajos]);
  if (!trabajo) return <EstadoVacio title="Trabajo no encontrado" />;

  const seleccionado = idsMiembros.map((id) => docentes.find((docente) => docente.id === id));
  const confirmar = async () => {
    if (idsMiembros.some((id) => !id) || new Set(idsMiembros).size !== 2) {
      await Swal.fire({ icon: 'warning', title: 'Seleccione dos docentes distintos', text: 'El tribunal debe estar compuesto exactamente por dos miembros.' });
      return;
    }
    const respuesta = await Swal.fire({
      icon: 'question', title: '¿Confirmar asignación?',
      html: `Se notificará internamente a <strong>${seleccionado.map(nombreCompleto).join('</strong> y <strong>')}</strong>.`,
      showCancelButton: true, confirmButtonText: 'Confirmar asignación', cancelButtonText: 'Volver y revisar', reverseButtons: true,
      confirmButtonColor: '#123f68',
    });
    if (!respuesta.isConfirmed) return;
    despachar({ tipo: 'ASIGNAR_TRIBUNAL', idTrabajo: trabajo.id, idsMiembros });
    await Swal.fire({ icon: 'success', title: 'Tribunal asignado', text: 'Se generó una notificación interna para cada miembro.', timer: 1800, showConfirmButton: false });
    navegar(`/trabajos/${trabajo.id}`);
  };

  return (
    <>
      <EncabezadoPagina title="Asignación de tribunal" description="Seleccione manualmente dos docentes; el sistema solo muestra información de apoyo." breadcrumbs={['Trabajos', trabajo.codigo, 'Tribunal']} />
      {!esEditable && <div className="alert alert-warning"><span>!</span><div><strong>Asignación bloqueada</strong>Al menos un miembro ya cerró la revisión escrita. Se conserva la asignación para proteger la evaluación histórica.</div></div>}
      <section className="card"><div className="card-header"><h2>Trabajo seleccionado</h2><InsigniaEstado tono="info">{trabajo.idsEstudiantes.length} estudiante(s)</InsigniaEstado></div><div className="card-body"><dl className="info-list"><div className="wide"><dt>Título</dt><dd>{trabajo.titulo}</dd></div><div><dt>Carrera</dt><dd>{trabajo.carrera}</dd></div><div><dt>Tutor</dt><dd>{nombreCompleto(estado.personas.find((persona) => persona.id === trabajo.idTutor))}</dd></div></dl></div></section>
      <div className="grid-2">
        <section className="card"><div className="card-header"><h2>Miembros del tribunal</h2><span className="badge badge-neutral">2 requeridos</span></div><div className="card-body stack">
          {[0, 1].map((posicion) => <div className="field" key={posicion}><label htmlFor={`tribunal-${posicion}`}>Miembro {posicion + 1}</label><select id={`tribunal-${posicion}`} className="select" disabled={!esEditable} value={idsMiembros[posicion]} onChange={(evento) => establecerIdsMiembros(idsMiembros.map((elemento, indice) => indice === posicion ? evento.target.value : elemento))}><option value="">Seleccione un docente</option>{docentes.map((docente) => <option key={docente.id} value={docente.id} disabled={idsMiembros[1 - posicion] === docente.id}>{nombreCompleto(docente)} · {docente.carrera} · {cargaTrabajo[docente.id]} tribunal(es)</option>)}</select></div>)}
          <div className="alert alert-info mb-0"><span>ⓘ</span><div><strong>Selección no automatizada</strong>La carrera y la carga actual se muestran como apoyo. La decisión corresponde a Comisión Académica.</div></div>
        </div></section>
        <section className="card"><div className="card-header"><h2>Resumen</h2></div><div className="card-body activity-list">{seleccionado.map((docente, indice) => docente ? <div className="activity-item" key={docente.id}><span className="avatar">{indice + 1}</span><div className="activity-content"><strong>{nombreCompleto(docente)}</strong><small>{docente.carrera} · {cargaTrabajo[docente.id]} asignación(es) actuales</small></div><InsigniaEstado tono="info">Seleccionado</InsigniaEstado></div> : <div className="activity-item" key={indice}><span className="avatar">{indice + 1}</span><div className="activity-content"><strong>Sin seleccionar</strong><small>Miembro {indice + 1}</small></div></div>)}</div>
          <div className="card-footer form-actions compact-actions"><button className="button button-outline" type="button" onClick={() => navegar(`/trabajos/${trabajo.id}`)}>Volver</button><button className="button button-primary" type="button" disabled={!esEditable} onClick={confirmar}>Confirmar asignación</button></div>
        </section>
      </div>
    </>
  );
}
