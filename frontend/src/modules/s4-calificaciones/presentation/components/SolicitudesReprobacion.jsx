import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJsonApi, postJsonApi } from '../services/clienteHttp';

function Caso({caso,periodos}) {
  const [datos, setDatos]=useState(null);
  const [error, setError]=useState('');
  const [ocupado, setOcupado]=useState(false);
  const [periodo, setPeriodo]=useState('');
  const [conservar,setConservar]=useState([]);
  const [motivo,setMotivo]=useState('');
  const [revision,recargar]=useState(0);
  const ruta='/convocatorias/trabajos/'+caso.trabajo+'/'+caso.estudiante;
  useEffect(()=>{
    const abort=new AbortController();
    getJsonApi(ruta+'/opciones',{signal:abort.signal}).then(c=>{
      setDatos(c);
      setPeriodo(c.periodoReservado??(c.politica.mismoPeriodo?c.periodo:''));
      setConservar(c.etapas.filter(e=>e.kind==='ESCRITA' && c.politica.escrita!=='REPETIR').map(e=>e.id));
    }).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    return ()=>abort.abort();
  },[ruta,revision]);
  async function registrar(revisar) {
    setOcupado(true);setError('');
    try{
      const numero=(datos.ultimo?.numero??1)+1;
      await postJsonApi(ruta+(revisar?'/revision':''),revisar?{numero,motivo}:{numero,periodo,conservar});
      recargar(v=>v+1);
    }catch(e){setError(e.message);}finally{setOcupado(false);}
  }
  const origen=periodos.find(p=>p.id===datos?.periodo);
  const opciones=datos?periodos.filter(p=>(!datos.periodoReservado || p.id===datos.periodoReservado)
      && (p.id===origen?.id?datos.politica.mismoPeriodo:datos.politica.otroPeriodo && p.inicio>origen?.inicio)):[];
  return <article className="card"><h3>{caso.nombre}</h3><p>{caso.titulo} · Primera convocatoria {caso.nota}/{caso.escala} · mínimo {caso.minimo}</p>
    {caso.periodoDestino && <p>Continuidad registrada para {caso.periodoDestino}</p>}
    {datos?.ultimo && <p>Convocatoria {datos.ultimo.numero} · {datos.ultimo.estado.toLowerCase()} {datos.ultimo.nota && '· '+datos.ultimo.nota}
      {' · '}<Link to={'/evaluaciones/'+caso.trabajo}>Ver evaluaciones</Link></p>}
    {datos && (!datos.ultimo || datos.ultimo.estado==='REPROBADA') && <fieldset disabled={ocupado}>
      <legend>Decisión para la convocatoria {(datos.ultimo?.numero??1)+1}</legend>
      {datos.revision && <p>En revisión · {datos.revision}</p>}
      {opciones.length>0 && <form onSubmit={e=>{e.preventDefault();registrar(false);}}>
        <label>Período de la nueva convocatoria<select required value={periodo} onChange={e=>setPeriodo(e.target.value)}><option value="">Seleccionar período</option>
          {opciones.map(p=><option key={p.id} value={p.id}>{p.codigo}</option>)}</select></label>
        <p>Etapas cuya nota se conserva</p>
        {datos.etapas.map(e=><label key={e.id}><input type="checkbox" disabled={e.kind==='ESCRITA' && datos.politica.escrita!=='ELEGIR'} checked={conservar.includes(e.id)}
          onChange={evt=>setConservar(actual=>evt.target.checked?[...actual,e.id]:actual.filter(id=>id!==e.id))}/>{e.nombre}</label>)}
        <button type="submit" disabled={!periodo || conservar.length===datos.etapas.length}>Abrir convocatoria individual</button>
      </form>}
      {!opciones.length && <p>Sin períodos disponibles para abrir una convocatoria con la política vigente.</p>}
      {datos.politica.revisar && !datos.revision && <details><summary>Enviar a revisión individual</summary>
        <label>Motivo<textarea maxLength={1500} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label>
        <button type="button" disabled={!motivo.trim()} onClick={()=>registrar(true)}>Registrar revisión</button></details>}
    </fieldset>}
    {error && <p role="alert">{error}</p>}
  </article>;
}
export function SolicitudesReprobacion() {
  const [pagina,setPagina]=useState(1);
  const [datos,setDatos]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    const abort=new AbortController();setDatos(null);setError('');
    getJsonApi('/solicitudes/reprobacion?pagina='+pagina,{signal:abort.signal}).then(setDatos).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    return ()=>abort.abort();
  },[pagina]);
  return <section className="card configuracion-general"><h2>Solicitudes por reprobación</h2>
    {error && <p role="alert">{error}</p>}
    {datos?.elementos.map(c=><Caso key={c.proceso+c.estudiante} caso={c} periodos={datos.periodos}/>)}
    {datos && !datos.elementos.length && <p>Sin casos de reprobación entre los trabajos de esta página.</p>}
    {datos?.paginacion.paginas>1 && <div className="config-acciones"><button disabled={pagina===1} onClick={()=>setPagina(p=>p-1)}>Anterior</button>
      <span>Página {pagina} de {datos.paginacion.paginas}</span><button disabled={pagina>=datos.paginacion.paginas} onClick={()=>setPagina(p=>p+1)}>Siguiente</button></div>}
  </section>;
}
