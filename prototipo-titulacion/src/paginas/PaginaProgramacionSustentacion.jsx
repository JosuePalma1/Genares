import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { estanCerradasRevisionesEscritas, formatearFecha, nombreCompleto } from '../dominio/flujoTrabajo';
import { usarPrototipo } from '../estado/ContextoPrototipo';
import { EncabezadoPagina, EstadoVacio, InsigniaEstado } from '../componentes/interfaz';

export default function PaginaProgramacionSustentacion() {
  const { idTrabajo } = useParams();
  const { estado, despachar } = usarPrototipo();
  const navegar = useNavigate();
  const trabajo = estado.trabajos.find((elemento) => elemento.id === idTrabajo);
  const [programacion, establecerProgramacion] = useState(trabajo?.programacion ?? { fecha: new Date().toISOString().slice(0, 10), hora: '10:00', sala: '' });
  if (!trabajo) return <EstadoVacio title="Trabajo no encontrado" />;
  const estaLista = estanCerradasRevisionesEscritas(estado, trabajo);
  const miembros = trabajo.idsTribunal.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);
  const estudiantes = trabajo.idsEstudiantes.map((id) => estado.personas.find((persona) => persona.id === id)).filter(Boolean);

  const enviar = async (evento) => {
    evento.preventDefault();
    if (!programacion.fecha || !programacion.hora || !programacion.sala.trim()) {
      await Swal.fire({ icon: 'warning', title: 'Información incompleta', text: 'Ingrese fecha, hora y sala.' });
      return;
    }
    const respuesta = await Swal.fire({ icon: 'question', title: trabajo.programacion ? '¿Actualizar programación?' : '¿Programar sustentación?', html: `<strong>${formatearFecha(programacion.fecha)} · ${programacion.hora}</strong><br>${programacion.sala}`, showCancelButton: true, confirmButtonText: 'Confirmar programación', cancelButtonText: 'Volver y revisar', reverseButtons: true, confirmButtonColor: '#123f68' });
    if (!respuesta.isConfirmed) return;
    despachar({ tipo: 'PROGRAMAR_SUSTENTACION', idTrabajo: trabajo.id, programacion: { ...programacion, sala: programacion.sala.trim() } });
    await Swal.fire({ icon: 'success', title: 'Sustentación programada', text: 'Los miembros del tribunal recibieron una notificación interna.', timer: 2000, showConfirmButton: false });
    navegar(`/trabajos/${trabajo.id}`);
  };

  return (
    <>
      <EncabezadoPagina title={trabajo.programacion ? 'Programación de sustentación' : 'Programar sustentación'} description="Defina la fecha, hora y sala para el trabajo seleccionado." breadcrumbs={['Trabajos', trabajo.codigo, 'Sustentación']} />
      {!estaLista ? <section className="card"><div className="empty-estado"><div className="empty-icon">!</div><h2>Sustentación bloqueada</h2><p>Los dos miembros del tribunal deben cerrar su revisión escrita antes de continuar.</p><button className="button button-outline" type="button" onClick={() => navegar(`/trabajos/${trabajo.id}`)}>Volver al trabajo</button></div></section> : (
        <form onSubmit={enviar}>
          <section className="card"><div className="card-header"><h2>Participantes</h2><InsigniaEstado tono="success">Revisión escrita 2 de 2</InsigniaEstado></div><div className="card-body"><dl className="info-list"><div className="wide"><dt>Trabajo</dt><dd>{trabajo.titulo}</dd></div><div><dt>Estudiante(s)</dt><dd>{estudiantes.map(nombreCompleto).join(' / ')}</dd></div><div><dt>Tribunal</dt><dd>{miembros.map(nombreCompleto).join(' / ')}</dd></div></dl></div></section>
          <section className="card"><div className="card-header"><h2>Fecha y lugar</h2><span className="badge badge-info">Notificación interna</span></div><div className="card-body form-grid"><div className="field"><label htmlFor="sustentacion-date">Fecha</label><input id="sustentacion-date" className="input" type="date" value={programacion.fecha} onChange={(evento) => establecerProgramacion({ ...programacion, fecha: evento.target.value })} /></div><div className="field"><label htmlFor="sustentacion-time">Hora</label><input id="sustentacion-time" className="input" type="time" value={programacion.hora} onChange={(evento) => establecerProgramacion({ ...programacion, hora: evento.target.value })} /></div><div className="field span-2"><label htmlFor="sustentacion-room">Sala</label><input id="sustentacion-room" className="input" placeholder="Ej. Sala 2" value={programacion.sala} onChange={(evento) => establecerProgramacion({ ...programacion, sala: evento.target.value })} /></div></div></section>
          <div className="form-actions"><button className="button button-outline" type="button" onClick={() => navegar(`/trabajos/${trabajo.id}`)}>Cancelar</button><button className="button button-primary" type="submit">{trabajo.programacion ? 'Guardar programación' : 'Programar y notificar'}</button></div>
        </form>
      )}
    </>
  );
}
