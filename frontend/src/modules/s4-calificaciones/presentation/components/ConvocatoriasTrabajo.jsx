import { useEffect, useState } from 'react';
import { getJsonApi, postJsonApi } from '../services/clienteHttp';

function CalificarEtapa({intento,etapa,evaluador,trabajo,recargar}) {
  const previa=intento.notas.find(n=>n.etapa===etapa.id && n.evaluador===evaluador.id);
  const [valores,cambiar]=useState({});
  const [guardando,guardar]=useState(false);
  const [error,avisar]=useState('');
  const indicadores=intento.rubrica.categories.filter(c=>c.stageId===etapa.id).flatMap(c=>c.indicators);
  const editable=!previa && intento.estado==='ABIERTA' && intento.editables.includes(evaluador.id);
  async function terminar(e) {
    e.preventDefault();guardar(true);avisar('');
    try {
      await postJsonApi('/convocatorias/trabajos/'+trabajo+'/intentos/'+intento.id+'/notas',{
        etapa:etapa.id,evaluador:evaluador.id,valores:indicadores.map(i=>({id:i.id,nota:valores[i.id]}))
      });
      recargar();
    }catch(err){avisar(err.message);}finally{guardar(false);}
  }
  return <details><summary>{etapa.nombre} · {evaluador.nombres} {evaluador.apellidos} · {previa?(previa.origen?'Conservada':'Calificada')+' '+previa.total:'Pendiente'}</summary>
    {previa?<dl>{indicadores.map(i=><div key={i.id}><dt>{i.label}</dt><dd>{previa.valores.find(v=>v.id===i.id)?.nota??'—'} / {i.calificacionMaxima}</dd></div>)}</dl>:
      editable?<form onSubmit={terminar}><fieldset disabled={guardando}>
        {indicadores.map(i=><label key={i.id}>{i.label} · máximo {i.calificacionMaxima}
          <input required type="number" inputMode="decimal" min="0" max={i.calificacionMaxima} step="0.0001" value={valores[i.id]??''} onChange={e=>cambiar(v=>({...v,[i.id]:e.target.value}))}/></label>)}
        <button type="submit">Terminar de calificar esta etapa</button></fieldset></form>:<p>Pendiente de calificación del evaluador asignado.</p>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
export function ConvocatoriasTrabajo({trabajo}) {
  const [intentos,mostrar]=useState([]);
  const [revision,setRevision]=useState(0);
  const [error,avisar]=useState('');
  useEffect(()=>{
    const abort=new AbortController();
    avisar('');
    getJsonApi('/convocatorias/trabajos/'+trabajo,{signal:abort.signal}).then(mostrar).catch(e=>{if(!abort.signal.aborted)avisar(e.message);});
    return ()=>abort.abort();
  },[trabajo,revision]);
  if(error)return <p role="status">No se pudieron consultar las convocatorias individuales. {error} <button type="button" onClick={()=>setRevision(v=>v+1)}>Reintentar</button></p>;
  if(!intentos.length)return null;
  return <section className="card configuracion-general"><h2>Convocatorias individuales</h2>
    {intentos.map(i=><article key={i.id}><h3>{i.nombre} · Convocatoria {i.numero}</h3>
      <p>{i.codigoPeriodo} · {i.estado.toLowerCase()}{i.vence?' · Hasta '+i.vence:''}{i.nota!==null?' · '+i.nota+'/'+i.escala:''}</p>
      {i.rubrica.stages.map(etapa=>i.evaluadores.map(ev=><CalificarEtapa key={i.id+etapa.id+ev.id} intento={i} etapa={etapa} evaluador={ev} trabajo={trabajo} recargar={()=>setRevision(v=>v+1)}/>))}
    </article>)}
  </section>;
}
