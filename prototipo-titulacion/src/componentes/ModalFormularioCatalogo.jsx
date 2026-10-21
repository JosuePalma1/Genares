import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './maestros.css';

const SELECTOR_ENFOCABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function ModalFormularioCatalogo({
  abierto,
  titulo,
  descripcion,
  error,
  mostrarRecarga = false,
  alRecargar,
  alCerrar,
  alEnviar,
  guardando = false,
  deshabilitarGuardar = false,
  textoGuardar = 'Guardar',
  textoGuardando = 'Guardando…',
  children,
}) {
  const fondoRef = useRef(null);
  const contenidoRef = useRef(null);
  const cierreRef = useRef(alCerrar);
  const guardandoRef = useRef(guardando);
  const id = useId();
  cierreRef.current = alCerrar;
  guardandoRef.current = guardando;

  useEffect(() => {
    if (!abierto) return undefined;
    const contenedor = contenidoRef.current;
    const fondo = fondoRef.current;
    const focoAnterior = document.activeElement;
    const desbordamientoAnterior = document.body.style.overflow;
    const inertesAnteriores = [...document.body.children]
      .filter((elemento) => elemento !== fondo)
      .map((elemento) => ({ elemento, inert: elemento.inert }));
    inertesAnteriores.forEach(({ elemento }) => { elemento.inert = true; });
    document.body.style.overflow = 'hidden';

    const primerControl = contenedor?.querySelector('[data-enfoque-inicial]')
      ?? contenedor?.querySelector('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
    (primerControl ?? contenedor)?.focus({ preventScroll: true });

    function alPresionarTecla(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        if (!guardandoRef.current) cierreRef.current?.();
        return;
      }
      if (evento.key !== 'Tab' || !contenedor) return;
      const controles = [...contenedor.querySelectorAll(SELECTOR_ENFOCABLE)]
        .filter((control) => control.getClientRects().length > 0);
      if (controles.length === 0) {
        evento.preventDefault();
        contenedor.focus();
        return;
      }
      const primero = controles[0];
      const ultimo = controles.at(-1);
      if (evento.shiftKey && (document.activeElement === primero || !contenedor.contains(document.activeElement))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (document.activeElement === ultimo || !contenedor.contains(document.activeElement))) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', alPresionarTecla, true);
    return () => {
      document.removeEventListener('keydown', alPresionarTecla, true);
      inertesAnteriores.forEach(({ elemento, inert }) => { elemento.inert = inert; });
      document.body.style.overflow = desbordamientoAnterior;
      if (focoAnterior instanceof HTMLElement && focoAnterior.isConnected) focoAnterior.focus({ preventScroll: true });
    };
  }, [abierto]);

  if (!abierto || typeof document === 'undefined') return null;

  return createPortal(
    <div ref={fondoRef} className="modal-catalogo-fondo" onMouseDown={(evento) => {
      if (evento.target === evento.currentTarget && !guardando) alCerrar?.();
    }}>
      <section
        ref={contenidoRef}
        className="modal-catalogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={descripcion ? `${id}-descripcion` : undefined}
        tabIndex={-1}
      >
        <header className="modal-catalogo-cabecera">
          <div>
            <span className="section-kicker">Maestros / Catálogos</span>
            <h2 id={`${id}-titulo`}>{titulo}</h2>
            {descripcion && <p id={`${id}-descripcion`}>{descripcion}</p>}
          </div>
          <button className="modal-catalogo-cerrar" type="button" aria-label="Cerrar formulario" onClick={alCerrar} disabled={guardando}>
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        {error && <div className="modal-catalogo-error" role="alert">
          <p>{error}</p>
          {mostrarRecarga && <button className="button button-outline" type="button" onClick={alRecargar} disabled={guardando}>
            Recargar datos del servidor
          </button>}
        </div>}

        <form onSubmit={alEnviar}>
          <div className="modal-catalogo-campos">{children}</div>
          <footer className="modal-catalogo-acciones">
            <button className="button button-outline" type="button" onClick={alCerrar} disabled={guardando}>Cancelar</button>
            <button className="button button-primary" type="submit" disabled={guardando || deshabilitarGuardar}>
              {guardando ? textoGuardando : textoGuardar}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
