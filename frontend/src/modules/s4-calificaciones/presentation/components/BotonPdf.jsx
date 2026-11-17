import { useState } from 'react';
import { DialogoGenares } from './dialogos';
import { abrirPdfEnPestanaNueva } from '../services/pestanaPdf';

/**
 * Botón que abre un PDF en una pestaña nueva, en el visor del navegador. Mientras se genera queda
 * desactivado; si falla, la pestaña se cierra y el error se explica aquí.
 */
export function BotonPdf({ obtenerPdf, mensajeError = (error) => error.message, className = 'button button-outline', disabled = false, children }) {
  const [abriendo, setAbriendo] = useState(false);
  async function abrir() {
    setAbriendo(true);
    try {
      await abrirPdfEnPestanaNueva(obtenerPdf);
    } catch (error) {
      await DialogoGenares.fire({ icon: 'error', title: 'No se pudo abrir el PDF', text: mensajeError(error) });
    } finally {
      setAbriendo(false);
    }
  }
  return <button type="button" className={className} onClick={abrir} disabled={disabled || abriendo} aria-busy={abriendo || undefined}>
    {children}
  </button>;
}
