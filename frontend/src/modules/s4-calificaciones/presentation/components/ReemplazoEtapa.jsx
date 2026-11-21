import { useState } from 'react';
import { getJsonApi, postJsonApi } from '../services/clienteHttp';

export default function ReemplazoEtapa({ asignacion, etapa, puesto, actualizar, confirmarCambio }) {
  const [candidatos, setCandidatos] = useState(null);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ruta = `/evaluaciones/mer/${encodeURIComponent(asignacion)}/reemplazos`;
  async function abrir(e) {
    if (!e.currentTarget.open || candidatos) return;
    try { setCandidatos(await getJsonApi(ruta + '/candidatos')); }
    catch (error) { setAviso(error.message); }
  }
  async function enviar(e) {
    e.preventDefault();
    if (ocupado || !confirmarCambio()) return;
    const valores = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      await postJsonApi(ruta, { etapa: etapa.id, puesto: puesto.id, anterior: puesto.docente,
        docente: valores.get('docente'), motivo: valores.get('motivo'), continuarBorrador: valores.has('continuar') });
      setAviso('Reemplazo registrado.');
      actualizar();
    } catch (error) { setAviso(error.message); }
    finally { setOcupado(false); }
  }
  return <details className="em-etapa" onToggle={abrir}>
    <summary>Reemplazar a {puesto.nombre} en {etapa.nombre}</summary>
    {aviso && <p role="status">{aviso}</p>}
    {candidatos && <form className="em-selectores" onSubmit={enviar}>
      <label>Docente de reemplazo<select name="docente" className="select" required defaultValue="">
        <option value="">Seleccionar docente de S3</option>
        {candidatos.filter(d => d.id !== puesto.docente).map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
      </select></label>
      <label>Motivo<input name="motivo" className="input" maxLength={1000} required /></label>
      <label><input type="checkbox" name="continuar"/> Continuar el borrador existente, si lo hay</label>
      <button className="button button-outline" disabled={ocupado}>Registrar reemplazo</button>
    </form>}
  </details>;
}
