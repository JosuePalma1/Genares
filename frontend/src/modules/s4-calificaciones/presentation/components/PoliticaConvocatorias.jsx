import { useEffect, useState } from 'react';
import { getJsonApi, postJsonApi } from '../services/clienteHttp';

export function PoliticaConvocatorias() {
  const [reglas, editar] = useState(null);
  const [mensaje, avisar] = useState('');
  const [ocupado, guardar] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    getJsonApi('/convocatorias/politica', {signal:abort.signal}).then(editar).catch(e=>{if(!abort.signal.aborted) avisar(e.message);});
    return ()=>abort.abort();
  }, []);
  const cambiar = (campo,valor) => editar(r=>({...r,[campo]:valor}));
  async function publicar(e) {
    e.preventDefault();
    guardar(true);
    try {
      editar(await postJsonApi('/convocatorias/politica',reglas));
      avisar('Política guardada para las nuevas convocatorias.');
    } catch(err) {avisar(err.message);} finally {guardar(false);}
  }
  return <form className="card" onSubmit={publicar}><h2>Convocatorias tras una reprobación</h2>
    {reglas && <fieldset disabled={ocupado}>
      {Object.entries({mismoPeriodo:'Permitir una nueva defensa en el mismo período',otroPeriodo:'Permitir continuar en un período posterior',revisar:'Permitir revisión individual del caso'}).map(([k,etiqueta])=>
        <label key={k}><input type="checkbox" checked={reglas[k]} onChange={e=>cambiar(k,e.target.checked)}/>{etiqueta}</label>)}
      <div className="config-ambito">
        <label>Calificación escrita<select value={reglas.escrita} onChange={e=>cambiar('escrita',e.target.value)}>
          <option value="ELEGIR">Decidir en cada convocatoria</option><option value="CONSERVAR">Conservar la escrita</option><option value="REPETIR">Repetir la escrita</option>
        </select></label>
        <label>Plazo para calificar (días)<input type="number" min="1" max="36500" placeholder="Sin límite" value={reglas.dias??''} onChange={e=>cambiar('dias',e.target.value?Number(e.target.value):null)}/></label>
        <label>Contar el plazo desde<select value={reglas.inicio} onChange={e=>cambiar('inicio',e.target.value)}>
          <option value="APERTURA">Apertura de la convocatoria</option><option value="RESULTADO">Resultado reprobado anterior</option>
        </select></label>
      </div>
      <button type="submit">Guardar política de convocatorias</button>
    </fieldset>}
    {mensaje && <p role="status">{mensaje}</p>}
  </form>;
}
export default PoliticaConvocatorias;
