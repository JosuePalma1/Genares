import { useEffect, useState } from 'react';
import { esPlataformaNativa, iniciarRespaldoNativo } from '../../infrastructure/dispositivo/respaldoNativo';

/** RNF-09: en la APK espera a restaurar los borradores duraderos antes de leerlos. En el navegador, listo de inmediato. */
export function usarRespaldoBorradores() {
  const [listo, establecerListo] = useState(() => !esPlataformaNativa());
  useEffect(() => {
    if (listo) return undefined;
    let vigente = true;
    iniciarRespaldoNativo().finally(() => { if (vigente) establecerListo(true); });
    return () => { vigente = false; };
  }, [listo]);
  return listo;
}
