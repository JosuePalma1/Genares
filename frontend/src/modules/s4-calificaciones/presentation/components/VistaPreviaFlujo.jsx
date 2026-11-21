import { useState } from 'react';
import { postJsonApi } from '../services/clienteHttp';

export default function VistaPreviaFlujo({ config, pasos, ambito }) {
  const [ejemplo, setEjemplo] = useState({ nota: '6.995', escala: 10, rol: 'COORDINACION', hechos: ['REGISTRADO','TRIBUNAL_ASIGNADO'], manuales: [] });
  const [respuesta, setRespuesta] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const solicitud = JSON.stringify({version:config.version,...ambito,pasos,...ejemplo});
  const resultado = respuesta?.solicitud === solicitud ? respuesta.datos : null;
  function actualizar(campo, valor) {
    setEjemplo(e=>({...e,[campo]:valor}));
  }
  function alternar(campo, valor) {
    setEjemplo(e=>({...e,[campo]:e[campo].includes(valor) ? e[campo].filter(x=>x!==valor) : [...e[campo],valor]}));
  }
  async function simular() {
    setOcupado(true);
    setError('');
    try {
      const datos = await postJsonApi('/configuracion-general/vista-previa', JSON.parse(solicitud));
      setRespuesta({solicitud,datos});
    } catch (e) { setError(e.message); setRespuesta(null); }
    finally { setOcupado(false); }
  }
  return <details className="config-simulacion"><summary>Vista previa antes de publicar</summary>
    <div className="config-ambito">
      {Object.entries({carrera: config.carreras, modalidad:config.modalidades, periodo:config.periodos}).map(([campo,opciones])=>
        <label key={campo}>{campo} del ejemplo
          <select value={ejemplo[campo+'Ejemplo'] ?? ''} onChange={e=>actualizar(campo+'Ejemplo',e.target.value || null)}>
            <option value="">Sin especificar</option>
            {opciones.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </label>)}
      <label>Rol del ejemplo<select value={ejemplo.rol} onChange={e=>actualizar('rol',e.target.value)}>{config.roles.map(rol=><option key={rol}>{rol}</option>)}</select></label>
      <label>Nota exacta<input type="number" step="any" value={ejemplo.nota} onChange={e=>actualizar('nota',e.target.value)} /></label>
      <label>Escala de calificación<input type="number" value={ejemplo.escala} onChange={e=>actualizar('escala',Number(e.target.value))} /></label>
    </div>
    <details><summary>Hechos del ejemplo</summary>{config.condiciones.map(h=><label key={h}><input type="checkbox" checked={ejemplo.hechos.includes(h)} onChange={()=>alternar('hechos',h)} />{h.replaceAll('_',' ').toLowerCase()}</label>)}</details>
    {pasos.some(p=>p.tipo==='MANUAL') && <details><summary>Pasos manuales ya cumplidos</summary>{pasos.filter(p=>p.tipo==='MANUAL').map(p=><label key={p.id}><input type="checkbox" checked={ejemplo.manuales.includes(p.id)} onChange={()=>alternar('manuales',p.id)} />{p.nombre}</label>)}</details>}
    <button type="button" disabled={ocupado} onClick={simular}>{ocupado?'Simulando…':'Probar este caso'}</button>
    {error && <p role="alert">{error}</p>}
    {resultado && <section aria-live="polite">
      <h3>{resultado.borrador?'Se aplicaría el borrador':'Se aplicaría la versión publicada'} · {resultado.version}</h3>
      <p>{resultado.aprobado?'Aprobado':'Reprobado'} · Nota {resultado.nota} · Mínimo {resultado.minimo}</p>
      <p>{resultado.programacion.impedimentos.length ? 'Programación bloqueada' : 'Programación permitida'}</p>
      {Object.entries({impedimentos:'Requisitos pendientes',advertencias:'Requieren confirmación',excepciones:'Requieren justificación'}).map(([k,etiqueta])=>resultado.programacion[k].length>0 && <p key={k}>{etiqueta}: {resultado.programacion[k].join(', ')}</p>)}
      {resultado.convocatoria && <p>Opciones ante la reprobación: {[[resultado.convocatoria.mismoPeriodo,'nueva defensa en el mismo período'],[resultado.convocatoria.otroPeriodo,'nuevo período'],[resultado.convocatoria.revisar,'revisión individual']].filter(([activa])=>activa).map(([,texto])=>texto).join(' · ') || 'ninguna habilitada'}.</p>}
      <ul>{resultado.pasos.map(p=><li key={p.id}>{p.nombre} · {p.cumplido?'Cumplido':'Pendiente'}</li>)}</ul>
    </section>}
  </details>;
}
