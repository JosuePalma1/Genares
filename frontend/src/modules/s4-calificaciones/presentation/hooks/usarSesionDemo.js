import { useEffect, useState } from 'react';
import { comprobarSesionDemo, consultarDemo, leerSesionDemo } from '../services/sesionDemo';

/**
 * Estado de la demostración por roles (rama demo/accesos-por-rol):
 * - comprobando: aún no se sabe;
 * - sin-demo: el backend no tiene usuarios de demostración, la app funciona como siempre;
 * - sin-sesion: hay demostración y nadie ha entrado → ir a /entrar;
 * - con-sesion: usuario de demostración activo.
 */
export function usarSesionDemo() {
  const [estado, establecerEstado] = useState(() => ({
    fase: 'comprobando', usuario: leerSesionDemo()?.usuario ?? null,
  }));

  useEffect(() => {
    const controlador = new AbortController();
    (async () => {
      const usuario = await comprobarSesionDemo({ signal: controlador.signal });
      if (controlador.signal.aborted) return;
      if (usuario) return establecerEstado({ fase: 'con-sesion', usuario });
      const demo = await consultarDemo({ signal: controlador.signal });
      if (controlador.signal.aborted) return;
      establecerEstado({ fase: demo ? 'sin-sesion' : 'sin-demo', usuario: null });
    })();
    return () => controlador.abort();
  }, []);

  return estado;
}
