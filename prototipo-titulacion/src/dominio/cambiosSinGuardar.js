import { useEffect, useRef } from 'react';
import { DialogoGenares as Swal } from '../componentes/dialogos';

const registrosActivos = new Set();
const MENSAJE = 'Hay cambios sin guardar. Si continúa, se perderán.';

export function hayCambiosSinGuardar() {
  return [...registrosActivos].some((registro) => registro.sucio.current);
}

export function confirmarDescarteCambios() {
  if (!hayCambiosSinGuardar()) return true;
  const confirmado = window.confirm(MENSAJE);
  if (confirmado) descartarCambiosRegistrados();
  return confirmado;
}

export async function confirmarDescarteCambiosConDialogo() {
  if (!hayCambiosSinGuardar()) return true;
  const respuesta = await Swal.fire({
    icon: 'warning',
    title: 'Hay cambios sin guardar',
    text: MENSAJE,
    showCancelButton: true,
    confirmButtonText: 'Descartar cambios',
    cancelButtonText: 'Seguir editando',
    reverseButtons: true,
  });
  if (!respuesta.isConfirmed) return false;
  descartarCambiosRegistrados();
  return true;
}

function descartarCambiosRegistrados() {
  registrosActivos.forEach((registro) => {
    registro.sucio.current = false;
    registro.alDescartar.current?.();
  });
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
    let clickAutorizado = false;
    let confirmandoNavegacion = false;
    const interceptarNavegacion = (evento) => {
      if (clickAutorizado) {
        clickAutorizado = false;
        return;
      }
      const enlace = evento.target.closest?.('a[href]');
      if (!enlace || enlace.target === '_blank' || evento.defaultPrevented) return;
      const destino = new URL(enlace.href, window.location.href);
      if (destino.origin !== window.location.origin) return;
      if (confirmandoNavegacion) {
        evento.preventDefault();
        evento.stopPropagation();
        return;
      }
      evento.preventDefault();
      evento.stopPropagation();
      confirmandoNavegacion = true;
      void confirmarDescarteCambiosConDialogo().then((confirmado) => {
        if (!confirmado) return;
        clickAutorizado = true;
        enlace.click();
      }).finally(() => {
        confirmandoNavegacion = false;
      });
    };

    window.addEventListener('beforeunload', advertirAntesDeSalir);
    document.addEventListener('click', interceptarNavegacion, true);
    return () => {
      window.removeEventListener('beforeunload', advertirAntesDeSalir);
      document.removeEventListener('click', interceptarNavegacion, true);
    };
  }, [tieneCambios]);
}
