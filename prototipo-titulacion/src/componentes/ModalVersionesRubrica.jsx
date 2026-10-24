import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { GitBranch, Eye, X } from 'lucide-react';

const SELECTOR_ENFOCABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function fechaLegible(fecha) {
  if (!fecha || Number.isNaN(Date.parse(fecha))) return 'No disponible';
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(fecha));
}

function carreraLegible(version, fuente) {
  if (version.carreras?.length) {
    return version.carreras.map((carrera) => `${carrera.nombre} · ${carrera.vigente ? 'vigente' : 'no vigente'}`).join(', ');
  }
  return fuente === 'api' ? 'Sin carrera asociada' : 'No disponible en prototipo';
}

export function ModalVersionesRubrica({ referencia, versiones, fuente, puedeCrearEnApi, onCerrar }) {
  const id = useId();
  const modalRef = useRef(null);
  const cierreRef = useRef(onCerrar);
  cierreRef.current = onCerrar;

  useEffect(() => {
    if (!referencia) return undefined;
    const modal = modalRef.current;
    const focoAnterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    const inertes = [...document.body.children]
      .filter((elemento) => elemento !== modal?.parentElement)
      .map((elemento) => ({ elemento, inert: elemento.inert }));
    inertes.forEach(({ elemento }) => { elemento.inert = true; });
    document.body.style.overflow = 'hidden';
    modal?.querySelector('button:not([disabled]), a[href]')?.focus({ preventScroll: true });

    function controlarTeclado(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cierreRef.current?.();
        return;
      }
      if (evento.key !== 'Tab' || !modal) return;
      const controles = [...modal.querySelectorAll(SELECTOR_ENFOCABLE)]
        .filter((control) => control.getClientRects().length > 0);
      if (!controles.length) {
        evento.preventDefault();
        modal.focus();
        return;
      }
      const primero = controles[0];
      const ultimo = controles.at(-1);
      if (evento.shiftKey && (document.activeElement === primero || !modal.contains(document.activeElement))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (document.activeElement === ultimo || !modal.contains(document.activeElement))) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', controlarTeclado, true);
    return () => {
      document.removeEventListener('keydown', controlarTeclado, true);
      inertes.forEach(({ elemento, inert }) => { elemento.inert = inert; });
      document.body.style.overflow = overflowAnterior;
      if (focoAnterior instanceof HTMLElement && focoAnterior.isConnected) focoAnterior.focus({ preventScroll: true });
    };
  }, [referencia]);

  if (!referencia) return null;

  const contenido = (
    <div className="rubricas-modal-fondo" onMouseDown={(evento) => {
      if (evento.target === evento.currentTarget) onCerrar?.();
    }}>
      <section
        ref={modalRef}
        className="rubricas-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-descripcion`}
        tabIndex={-1}
      >
        <header className="rubricas-modal-cabecera">
          <div>
            <span className="section-kicker">Historial de versiones</span>
            <h2 id={`${id}-titulo`}>Versiones disponibles</h2>
            <p id={`${id}-descripcion`}>
              {referencia.modalidad} · {referencia.periodo} · {referencia.nombreRubrica}
            </p>
          </div>
          <button className="rubricas-modal-cerrar" type="button" aria-label="Cerrar versiones" onClick={onCerrar}>
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="rubricas-modal-lista">
          {versiones.map((version) => (
            <article className="rubricas-modal-version" key={version.id}>
              <div className="rubricas-modal-version-info">
                <h3>Versión {version.version}</h3>
                <p>Creada: {fechaLegible(version.creadaEn)}</p>
                <p>Carrera y vigencia: {carreraLegible(version, fuente)}</p>
              </div>
              <Link className="button button-outline" to={`/rubricas/${encodeURIComponent(version.id)}`}>
                <Eye size={16} aria-hidden="true" /> Ver rúbrica
              </Link>
            </article>
          ))}
        </div>

        {puedeCrearEnApi && fuente === 'api' && referencia.rubricaId && referencia.versionId && <div className="rubricas-modal-pendiente">
          <Link className="button button-primary" to={`/rubricas/${encodeURIComponent(referencia.rubricaId)}/nueva-version/${encodeURIComponent(referencia.versionId)}`}>
            <GitBranch size={16} aria-hidden="true" /> Nueva versión basada en {referencia.version}
          </Link>
          <p>Se precargará esta versión como origen; sus datos históricos permanecerán intactos.</p>
        </div>}
      </section>
    </div>
  );
  return typeof document === 'undefined' ? contenido : createPortal(contenido, document.body);
}
