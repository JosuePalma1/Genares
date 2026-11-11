// RNF-09 · Respaldo duradero de borradores en la APK del tribunal.
// localStorage del WebView puede vaciarse (falta de espacio, limpieza de caché del WebView). En la
// APK cada borrador se copia también a Preferences, que guarda los datos en el almacenamiento nativo
// de la app, y al abrir se restaura lo que falte. En el navegador no hace nada.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { configurarEspejoBorradores, conciliarRespaldo, esClaveRespaldo } from '../../domain/borradoresLocales';

export function esPlataformaNativa() {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

let inicio = null;

/**
 * Restaura una sola vez por ejecución y deja activo el espejo. Nunca falla: si el respaldo no
 * responde, la app sigue con localStorage como antes.
 */
export function iniciarRespaldoNativo({
  nativo = esPlataformaNativa(), preferencias = Preferences, almacen = globalThis.localStorage, reiniciar = false,
} = {}) {
  if (!nativo) return Promise.resolve({ restauradas: 0, copiadas: 0, activo: false });
  if (inicio && !reiniciar) return inicio;
  inicio = (async () => {
    const { keys } = await preferencias.keys();
    const entradas = await Promise.all(keys.filter(esClaveRespaldo)
      .map(async (clave) => ({ clave, valor: (await preferencias.get({ key: clave })).value })));
    const { restauradas, paraCopiar } = conciliarRespaldo(entradas, almacen);
    await Promise.all(paraCopiar.map(({ clave, valor }) => preferencias.set({ key: clave, value: valor })));
    configurarEspejoBorradores((clave, valor) => {
      const operacion = valor === null ? preferencias.remove({ key: clave }) : preferencias.set({ key: clave, value: valor });
      Promise.resolve(operacion).catch(() => { /* se reintenta en la siguiente conciliación */ });
    });
    return { restauradas, copiadas: paraCopiar.length, activo: true };
  })().catch(() => ({ restauradas: 0, copiadas: 0, activo: false }));
  return inicio;
}
