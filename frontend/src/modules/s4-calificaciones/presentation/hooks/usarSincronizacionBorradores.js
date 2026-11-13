import { useEffect, useRef, useState } from 'react';
import { suscribirCambiosBorradores } from '../../domain/borradoresLocales';
import { contarCola, sincronizarColaBorradores } from '../services/sincronizacionBorradores';
import { esErrorDeConexion } from './usarConexion';
import { usarRespaldoBorradores } from './usarRespaldoBorradores';

/** Cada cuánto se reintenta la cola mientras la app está abierta. */
export const INTERVALO_SINCRONIZACION_MS = 20000;

/**
 * RF-31 · Sincroniza la cola local al abrir la app, al volver la conexión y periódicamente.
 * En la APK espera a restaurar los borradores duraderos (RNF-09) antes del primer envío.
 */
export function usarSincronizacionBorradores() {
  const respaldoListo = usarRespaldoBorradores();
  const [cola, establecerCola] = useState(() => contarCola());
  const [sincronizando, establecerSincronizando] = useState(false);
  const enCurso = useRef(false);

  useEffect(() => suscribirCambiosBorradores(() => establecerCola(contarCola())), []);

  useEffect(() => {
    if (!respaldoListo) return undefined;
    let vigente = true;
    const actualizar = () => { if (vigente) establecerCola(contarCola()); };
    const ejecutar = async () => {
      actualizar();
      const sinRed = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (enCurso.current || sinRed || contarCola().pendientes === 0) return;
      enCurso.current = true;
      if (vigente) establecerSincronizando(true);
      try {
        await sincronizarColaBorradores({ esErrorConexion: esErrorDeConexion });
      } catch { /* la cola queda como estaba; se reintenta en el siguiente ciclo */ }
      enCurso.current = false;
      if (vigente) establecerSincronizando(false);
      actualizar();
    };
    void ejecutar();
    const intervalo = setInterval(() => void ejecutar(), INTERVALO_SINCRONIZACION_MS);
    const alVolverConexion = () => void ejecutar();
    window.addEventListener('online', alVolverConexion);
    // Otra pestaña guardó o sincronizó: solo se actualiza el conteo.
    window.addEventListener('storage', actualizar);
    return () => {
      vigente = false;
      clearInterval(intervalo);
      window.removeEventListener('online', alVolverConexion);
      window.removeEventListener('storage', actualizar);
    };
  }, [respaldoListo]);

  return { ...cola, sincronizando };
}

/** Texto del indicador de la barra superior; null cuando no hay nada que avisar. */
export function avisoColaBorradores({ pendientes, conflictos, sincronizando }) {
  if (conflictos > 0) {
    return { tono: 'conflicto', corto: `${conflictos} en conflicto`,
      texto: `${conflictos} borrador(es) de este dispositivo tienen conflicto con el servidor. Ábrelos para decidir qué versión conservar.` };
  }
  if (pendientes > 0) {
    return sincronizando
      ? { tono: 'pendiente', corto: 'Sincronizando…', texto: `Enviando ${pendientes} borrador(es) de este dispositivo al servidor.` }
      : { tono: 'pendiente', corto: `${pendientes} sin sincronizar`,
        texto: `${pendientes} borrador(es) guardados solo en este dispositivo. Se enviarán al servidor cuando haya conexión.` };
  }
  return null;
}
