import { useState } from 'react';
import { DialogoGenares as Swal } from './dialogos';
import {
  claveElemento, codigoIndicador, decimalIndicador, moverElemento, nuevaCategoria, nuevoIndicador,
  subtotalCategoria, subtotalEtapa,
} from '../dominio/estructuraRubrica';

const mostrarSubtotal = (calcular) => { try { return calcular(); } catch { return '—'; } };
const enfocar = (id) => requestAnimationFrame(() => document.getElementById(id)?.focus());

function Orden({ nombre, primero, ultimo, bloqueado, mover, eliminar }) {
  const cambiar = (direccion, evento) => {
    const controles = evento.currentTarget.parentElement;
    mover(direccion);
    requestAnimationFrame(() => controles.querySelector('button:not(:disabled)')?.focus());
  };
  return <div className="rubrica-structure-controls" role="group" aria-label={`Acciones de ${nombre}`}>
    <button type="button" className="button button-outline" disabled={bloqueado || primero} aria-label={`Subir ${nombre}`} onClick={(evento) => cambiar(-1, evento)}>Subir</button>
    <button type="button" className="button button-outline" disabled={bloqueado || ultimo} aria-label={`Bajar ${nombre}`} onClick={(evento) => cambiar(1, evento)}>Bajar</button>
    <button type="button" className="button button-outline" disabled={bloqueado} aria-label={`Eliminar ${nombre}`} onClick={eliminar}>Eliminar</button>
  </div>;
}

export default function EditorEstructuraRubrica({ etapas, categorias, esApi, bloqueado, cambiarEtapa, cambiarCategorias }) {
  const [anuncio, setAnuncio] = useState('');
  const actualizarCategoria = (clave, cambios) => cambiarCategorias(categorias.map((categoria) => claveElemento(categoria) === clave ? { ...categoria, ...cambios } : categoria));
  const actualizarIndicador = (categoria, clave, cambios) => actualizarCategoria(claveElemento(categoria), {
    indicadores: categoria.indicadores.map((indicador) => claveElemento(indicador) === clave ? { ...indicador, ...cambios } : indicador),
  });
  const confirmarEliminar = async (nombre, detalle, accion, foco) => {
    const respuesta = await Swal.fire({
      icon: 'warning', title: `Eliminar ${nombre}`, text: `${detalle} La eliminación se aplicará al guardar el borrador.`,
      showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Conservar', reverseButtons: true,
    });
    if (!respuesta.isConfirmed) return;
    accion(); setAnuncio(`${nombre} eliminado del borrador.`); enfocar(foco);
  };

  return <div className="rubrica-structural-editor">
    <p>Puede guardar grupos vacíos en borrador. Cada indicador presente necesita código, descripción y un máximo positivo válido.</p>
    <p role="status" aria-live="polite" className="rubrica-structure-announcement">{anuncio}</p>
    {etapas.map((etapa, indiceEtapa) => {
      const claveEtapa = claveElemento(etapa);
      const grupo = categorias.filter((categoria) => categoria.etapa === claveEtapa);
      const botonCategoria = `agregar-categoria-${claveEtapa}`;
      return <section key={claveEtapa} className="rubrica-editor-stage" aria-label={`Etapa ${etapa.tipo}`}>
        <header className="rubrica-editor-stage-heading">
          <span className="rubrica-stage-number" aria-hidden="true">{indiceEtapa + 1}</span>
          <div className="rubrica-stage-copy">
            <p>{etapa.tipo} · {etapa.alcance === 'TRABAJO_COMPARTIDO' ? 'Trabajo compartido' : 'Estudiante individual'}</p>
            <div className="rubrica-stage-fields">
              <div className="field"><label htmlFor={`codigo-${claveEtapa}`}>Código de etapa {etapa.tipo}</label><input id={`codigo-${claveEtapa}`} className="input" maxLength={40} value={etapa.codigo} disabled={bloqueado} onChange={(e) => cambiarEtapa(claveEtapa, 'codigo', e.target.value)} /></div>
              <div className="field"><label htmlFor={`nombre-${claveEtapa}`}>Nombre de etapa {etapa.tipo}</label><input id={`nombre-${claveEtapa}`} className="input" maxLength={220} value={etapa.nombre} disabled={bloqueado} onChange={(e) => cambiarEtapa(claveEtapa, 'nombre', e.target.value)} /></div>
              <div className="field"><label htmlFor={`descripcion-${claveEtapa}`}>Descripción de etapa {etapa.tipo}</label><input id={`descripcion-${claveEtapa}`} className="input" value={etapa.descripcion ?? ''} disabled={bloqueado} onChange={(e) => cambiarEtapa(claveEtapa, 'descripcion', e.target.value)} /></div>
            </div>
          </div>
          <div className="rubrica-stage-score"><span>Subtotal de etapa</span><strong>{mostrarSubtotal(() => subtotalEtapa(etapa, categorias))}</strong><small>puntos</small></div>
        </header>
        <div className="rubrica-editor-categories">
          {!grupo.length && <p>Esta etapa aún no tiene categorías.</p>}
          {grupo.map((categoria, indiceCategoria) => {
            const claveCategoria = claveElemento(categoria);
            const nombreCategoria = `categoría ${categoria.codigo}`;
            const botonIndicador = `agregar-indicador-${claveCategoria}`;
            return <article key={claveCategoria} className="rubrica-editor-category" aria-label={nombreCategoria} data-categoria={categoria.codigo}>
              <header className="rubrica-editor-category-heading">
                <div className="rubrica-category-fields">
                  <div className="field"><label htmlFor={`codigo-${claveCategoria}`}>Código de categoría {categoria.codigo}</label><input id={`codigo-${claveCategoria}`} className="input" maxLength={10} value={categoria.codigo} disabled={bloqueado} onChange={(e) => actualizarCategoria(claveCategoria, { codigo: e.target.value })} /></div>
                  <div className="field"><label htmlFor={`nombre-${claveCategoria}`}>Nombre de categoría {categoria.codigo}</label><input id={`nombre-${claveCategoria}`} className="input" maxLength={240} value={categoria.nombre} disabled={bloqueado} onChange={(e) => actualizarCategoria(claveCategoria, { nombre: e.target.value })} /></div>
                  <Orden nombre={nombreCategoria} primero={indiceCategoria === 0} ultimo={indiceCategoria === grupo.length - 1} bloqueado={bloqueado}
                    mover={(direccion) => { cambiarCategorias(moverElemento(categorias, claveCategoria, direccion, (c) => c.etapa === claveEtapa)); setAnuncio(`Categoría ${categoria.codigo} reordenada.`); }}
                    eliminar={() => confirmarEliminar(nombreCategoria, `Se retirarán la categoría y sus ${categoria.indicadores.length} indicadores.`, () => cambiarCategorias(categorias.filter((c) => claveElemento(c) !== claveCategoria)), botonCategoria)} />
                </div>
                <div className="rubrica-category-score"><span>Subtotal de categoría</span><strong>{mostrarSubtotal(() => subtotalCategoria(categoria))} pts</strong></div>
              </header>
              <div className="rubrica-editor-indicators">
                {!categoria.indicadores.length && <p className="rubrica-empty-group">Categoría vacía: puede guardarse como borrador.</p>}
                {categoria.indicadores.map((indicador, indiceIndicador) => {
                  const clave = claveElemento(indicador);
                  const nombre = `indicador ${categoria.codigo}.${indiceIndicador + 1}`;
                  return <div className="rubrica-editor-indicator" key={clave} data-indicador={codigoIndicador(indicador)}>
                    <span className="rubrica-indicator-index" aria-hidden="true">{categoria.codigo}.{indiceIndicador + 1}</span>
                    <div className="rubrica-indicator-copy">
                      <div className="field"><label htmlFor={`codigo-${clave}`}>Código de {nombre}</label><input id={`codigo-${clave}`} className="input" maxLength={40} value={codigoIndicador(indicador)} disabled={bloqueado} onChange={(e) => actualizarIndicador(categoria, clave, { label: e.target.value, codigo: e.target.value })} /></div>
                      <div className="field"><label htmlFor={`descripcion-${clave}`}>Descripción de {nombre}</label><textarea id={`descripcion-${clave}`} className="textarea" value={indicador.etiqueta} disabled={bloqueado} onChange={(e) => actualizarIndicador(categoria, clave, { etiqueta: e.target.value, descripcion: e.target.value })} /></div>
                      <Orden nombre={nombre} primero={indiceIndicador === 0} ultimo={indiceIndicador === categoria.indicadores.length - 1} bloqueado={bloqueado}
                        mover={(direccion) => { actualizarCategoria(claveCategoria, { indicadores: moverElemento(categoria.indicadores, clave, direccion) }); setAnuncio(`${nombre} reordenado.`); }}
                        eliminar={() => confirmarEliminar(nombre, 'Se retirarán su código, descripción y máximo.', () => actualizarCategoria(claveCategoria, { indicadores: categoria.indicadores.filter((i) => claveElemento(i) !== clave) }), botonIndicador)} />
                    </div>
                    <div className="rubrica-indicator-score"><label htmlFor={`maximo-${clave}`}>Máximo de {nombre}</label><input id={`maximo-${clave}`} className="calificacion-input" type="number" min="0" max="99.99" step="0.01" value={decimalIndicador(indicador)} disabled={bloqueado} onChange={(e) => actualizarIndicador(categoria, clave, { maximoDecimal: e.target.value, maximo: Number(e.target.value) })} /><small>Puntos</small></div>
                  </div>;
                })}
              </div>
              <footer className="rubrica-category-total">
                <button id={botonIndicador} className="button button-outline" type="button" disabled={bloqueado} onClick={() => {
                  const indicador = nuevoIndicador(categoria.indicadores, esApi);
                  actualizarCategoria(claveCategoria, { indicadores: [...categoria.indicadores, indicador] });
                  setAnuncio(`Indicador añadido a ${categoria.codigo}.`); enfocar(`codigo-${claveElemento(indicador)}`);
                }}>Añadir indicador a {categoria.codigo}</button>
                <strong>{categoria.indicadores.length} indicadores · {mostrarSubtotal(() => subtotalCategoria(categoria))} puntos</strong>
              </footer>
            </article>;
          })}
          <button id={botonCategoria} className="button button-outline" type="button" disabled={bloqueado} onClick={() => {
            const categoria = nuevaCategoria(etapa, categorias, esApi);
            cambiarCategorias([...categorias, categoria]); setAnuncio(`Categoría ${categoria.codigo} añadida.`); enfocar(`codigo-${claveElemento(categoria)}`);
          }}>Añadir categoría a {etapa.tipo}</button>
        </div>
      </section>;
    })}
  </div>;
}
