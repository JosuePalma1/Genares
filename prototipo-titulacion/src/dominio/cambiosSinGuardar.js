import { useEffect, useRef } from 'react';

const registrosActivos = new Set();
const MENSAJE = 'Hay cambios sin guardar. Si continúa, se perderán.';

export function hayCambiosSinGuardar() {
  return [...registrosActivos].some((registro) => registro.sucio.current);
}

export function confirmarDescarteCambios() {
  if (!hayCambiosSinGuardar()) return true;
  const confirmado = window.confirm(MENSAJE);
  if (confirmado) registrosActivos.forEach((registro) => {
    registro.sucio.current = false;
    registro.alDescartar.current?.();
  });
  return confirmado;
}

export function usarAdvertenciaCambiosSinGuardar(tieneCambios, alDescartar) {
  const registro = useRef({ sucio: { current: Boolean(tieneCambios) }, alDescartar: { current: alDescartar } });
  registro.current.sucio.current = Boolean(tieneCambios);
  registro.current.alDescartar.current = alDescartar;

  useEffect(() => {
    const entrada = registro.current;
    registrosActivos.add(entrada);
    return () => registrosActivos.delete(entrada);
  }, []);

  useEffect(() => {
    if (!tieneCambios) return undefined;

    const advertirAntesDeSalir = (evento) => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    const interceptarNavegacion = (evento) => {
      const enlace = evento.target.closest?.('a[href]');
      if (!enlace || enlace.target === '_blank' || evento.defaultPrevented) return;
      const destino = new URL(enlace.href, window.location.href);
      if (destino.origin !== window.location.origin) return;
      if (!confirmarDescarteCambios()) {
        evento.preventDefault();
        evento.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', advertirAntesDeSalir);
    document.addEventListener('click', interceptarNavegacion, true);
    return () => {
      window.removeEventListener('beforeunload', advertirAntesDeSalir);
      document.removeEventListener('click', interceptarNavegacion, true);
    };
  }, [tieneCambios]);
}
