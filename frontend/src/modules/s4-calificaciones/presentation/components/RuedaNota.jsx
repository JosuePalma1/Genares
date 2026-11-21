import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';

const alto = 44;
const formato = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

// El navegador puede emitir click solo para el primer dedo de un gesto múltiple.
export function eventosToque(activar) {
  return {
    onPointerUp(e) {
      if (e.pointerType === 'mouse' || e.currentTarget.disabled || e.currentTarget.getAttribute('aria-disabled') === 'true') return;
      if (e.currentTarget.contains(document.elementFromPoint(e.clientX, e.clientY))) activar();
    },
    onClick(e) {
      if (!e.detail || !e.nativeEvent.pointerType || e.nativeEvent.pointerType === 'mouse') activar();
    },
  };
}

function Selector({ nombre, indicador, valor, cambiar, aceptar, cancelar, disabled, id }) {
  const lista = useRef(null);
  const arrastre = useRef(null);
  const posicion = useRef(null);
  const maximo = Number(indicador.maximo);
  const ultimo = Math.ceil(maximo * 100 - 1e-9);
  const inicial = Math.min(ultimo, Math.max(0, Math.round(Number(valor || 0) * 100)));
  const [indice, seleccionar] = useState(inicial);
  const emitido = useRef(Number(valor));
  const nota = (i) => Math.min(maximo, i / 100);
  const actual = valor === '' ? nota(indice) : Number(valor);
  useLayoutEffect(() => {
    lista.current.focus({ preventScroll: true });
    lista.current.scrollTop = inicial * alto;
  }, []);
  useLayoutEffect(() => {
    if (emitido.current !== Number(valor)) {
      emitido.current = Number(valor);
      posicion.current = inicial;
      seleccionar(inicial);
      lista.current.scrollTop = inicial * alto;
    }
  }, [valor, inicial]);
  const ir = (i) => {
    if (disabled) return;
    const destino = Math.min(ultimo, Math.max(0, i));
    posicion.current = destino;
    emitido.current = nota(destino);
    cambiar(nota(destino));
    seleccionar(destino);
    lista.current.scrollTop = destino * alto;
  };
  const inicio = Math.max(0, indice - 5);
  return <section onKeyDown={(e) => {
    if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
  }} id={id} className="rueda-panel" aria-label={`Nota de ${nombre}`}>
    <p>Máximo {formato.format(maximo)}</p>
    <div className="rueda-marco">
      <div ref={lista} className="rueda-lista" role="spinbutton" aria-label={`Nota de ${nombre}`} tabIndex={0}
        aria-valuemin={0} aria-valuemax={maximo} aria-valuenow={actual}
        onKeyDown={(e) => {
          const destinos = { ArrowUp: indice - 1, ArrowDown: indice + 1, Home: 0, End: ultimo };
          if (e.key in destinos) { e.preventDefault(); ir(destinos[e.key]); }
        }}
        onPointerDown={(e) => {
          if (disabled || e.pointerType === 'mouse' || arrastre.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          arrastre.current = { id: e.pointerId, y: e.clientY, top: e.currentTarget.scrollTop, movido: false };
        }}
        onPointerMove={(e) => {
          const gesto = arrastre.current;
          if (gesto?.id !== e.pointerId) return;
          const distancia = gesto.y - e.clientY;
          if (Math.abs(distancia) > 4) gesto.movido = true;
          if (gesto.movido && !disabled) e.currentTarget.scrollTop = gesto.top + distancia;
        }}
        onPointerUp={(e) => {
          const gesto = arrastre.current;
          if (gesto?.id !== e.pointerId) return;
          arrastre.current = null;
          if (gesto.movido) {
            const top = Math.round(e.currentTarget.scrollTop / alto) * alto;
            const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            e.currentTarget.scrollTo({ top, behavior: reducir ? 'instant' : 'smooth' });
          } else {
            const fila = Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / alto);
            ir(indice + fila - 1);
          }
        }}
        onPointerCancel={() => { arrastre.current = null; }}
        onScroll={(e) => {
          const i = Math.min(ultimo, Math.max(0, Math.round(e.currentTarget.scrollTop / alto)));
          if (!disabled && i !== (posicion.current ?? indice)) {
            posicion.current = i;
            emitido.current = nota(i);
            seleccionar(i);
            cambiar(nota(i));
          }
        }}>
        <div style={{ height: (ultimo + 3) * alto, position: 'relative' }}>
          {Array.from({ length: Math.min(ultimo, indice + 5) - inicio + 1 }, (_, j) => {
            const i = inicio + j;
            return <div aria-hidden="true" key={i} className="rueda-valor" data-activo={i === indice}
              style={{ top: (i + 1) * alto }} onClick={(e) => { if (e.nativeEvent.pointerType === 'mouse') ir(i); }}>
              {formato.format(i === indice ? actual : nota(i))}
            </div>;
          })}
        </div>
      </div>
    </div>
    <footer>
      <button type="button" className="button button-primary" disabled={disabled} {...eventosToque(() => aceptar(actual))}>Listo</button></footer>
  </section>;
}

export function RuedaNota({ nombre, indicador, valor, disabled, alElegir }) {
  const [abierta, abrir] = useState(false);
  const boton = useRef(null);
  const id = useId();
  const cerrar = () => {
    abrir(false);
    boton.current?.focus({ preventScroll: true });
  };
  return <><button ref={boton} className="button button-outline rueda-abrir" type="button" disabled={disabled}
    aria-expanded={abierta} aria-controls={abierta ? id : undefined}
    aria-label={`Elegir nota con rueda para ${nombre}: ${indicador.etiqueta}`} {...eventosToque(() => abrir((previa) => !previa))}>
    <ChevronsUpDown size={18} /></button>
    {abierta && <Selector nombre={nombre} indicador={indicador} valor={valor} cancelar={cerrar} disabled={disabled} id={id}
      cambiar={alElegir} aceptar={(nota) => { if (valor === '' || Number(valor) !== nota) alElegir(nota); cerrar(); }} />}</>;
}
