import { useEffect, useState } from 'react';

/** Devuelve el valor cuando deja de cambiar durante `espera` ms (p. ej. al escribir una búsqueda). */
export function usarValorDiferido(valor, espera = 350) {
  const [diferido, establecerDiferido] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => establecerDiferido(valor), espera);
    return () => clearTimeout(temporizador);
  }, [valor, espera]);
  return diferido;
}
