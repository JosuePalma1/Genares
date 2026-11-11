import { ChevronLeft, ChevronRight } from 'lucide-react';
import './paginador.css';

/** Navegación entre páginas de un listado paginado en el servidor. */
export function Paginador({ paginacion, alCambiar, deshabilitado = false, etiqueta = 'Paginación' }) {
  if (!paginacion || paginacion.paginas <= 1) return null;
  const { pagina, paginas, total, limite } = paginacion;
  const desde = (pagina - 1) * limite + 1;
  const hasta = Math.min(total, pagina * limite);
  return (
    <nav className="paginador" aria-label={etiqueta}>
      <button className="button button-outline" type="button" disabled={deshabilitado || pagina <= 1} onClick={() => alCambiar(pagina - 1)}>
        <ChevronLeft size={16} aria-hidden="true" /> Anterior
      </button>
      <span aria-live="polite">Página <strong>{pagina}</strong> de {paginas} · {desde}–{hasta} de {total}</span>
      <button className="button button-outline" type="button" disabled={deshabilitado || pagina >= paginas} onClick={() => alCambiar(pagina + 1)}>
        Siguiente <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
