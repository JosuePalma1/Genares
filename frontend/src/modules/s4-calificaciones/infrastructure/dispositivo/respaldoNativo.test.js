import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  claveBorrador, configurarEspejoBorradores, conciliarRespaldo, eliminarBorrador, guardarBorrador, leerBorrador,
} from '../../domain/borradoresLocales';
import { iniciarRespaldoNativo } from './respaldoNativo';

/** Imita localStorage (incluida la iteración por índice). */
function almacen() {
  const datos = new Map();
  return {
    get length() { return datos.size; },
    key: (i) => [...datos.keys()][i] ?? null,
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => { datos.set(k, String(v)); },
    removeItem: (k) => { datos.delete(k); },
    clear: () => datos.clear(),
  };
}

/** Imita la API asíncrona de @capacitor/preferences. */
function preferencias(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    keys: vi.fn(async () => ({ keys: [...datos.keys()] })),
    get: vi.fn(async ({ key }) => ({ value: datos.has(key) ? datos.get(key) : null })),
    set: vi.fn(async ({ key, value }) => { datos.set(key, value); }),
    remove: vi.fn(async ({ key }) => { datos.delete(key); }),
  };
}

const clave = claveBorrador({ asignacionId: 'a1', tipo: 'ORAL', idEtapa: 'e1', idTitular: 'est-A', idEvaluador: 'ev-1' });
const registro = (actualizadoEn, score) => JSON.stringify({
  revisionBase: 2, notas: { i1: { score, observation: '' } }, estado: 'PENDIENTE', actualizadoEn,
});

afterEach(() => configurarEspejoBorradores(null));

describe('conciliación del respaldo duradero (RNF-09)', () => {
  it('restaura en localStorage los borradores que se perdieron', () => {
    const local = almacen();
    const resultado = conciliarRespaldo([{ clave, valor: registro('2026-11-11T10:00:00Z', '4') }], local);
    expect(resultado.restauradas).toBe(1);
    expect(leerBorrador(clave, local).notas.i1.score).toBe('4');
  });

  it('conserva la versión más reciente y no copia claves ajenas a S4', () => {
    const local = almacen();
    local.setItem(clave, registro('2026-11-11T12:00:00Z', '5'));
    local.setItem('otra-app', 'x');
    const resultado = conciliarRespaldo([
      { clave, valor: registro('2026-11-11T10:00:00Z', '4') },
      { clave: 'otra-app', valor: 'y' },
    ], local);
    expect(resultado.restauradas).toBe(0);
    expect(leerBorrador(clave, local).notas.i1.score).toBe('5');
    expect(resultado.paraCopiar).toEqual([{ clave, valor: registro('2026-11-11T12:00:00Z', '5') }]);
    expect(local.getItem('otra-app')).toBe('x');
  });
});

describe('respaldo nativo de la APK', () => {
  it('en el navegador no toca Preferences ni activa el espejo', async () => {
    const prefs = preferencias();
    await expect(iniciarRespaldoNativo({ nativo: false, preferencias: prefs, almacen: almacen() }))
      .resolves.toMatchObject({ activo: false });
    expect(prefs.keys).not.toHaveBeenCalled();
  });

  it('al abrir restaura lo perdido y copia a Preferences lo que solo estaba en localStorage', async () => {
    const local = almacen();
    const otraClave = clave.replace('est-A', 'est-B');
    local.setItem(otraClave, registro('2026-11-11T09:00:00Z', '3'));
    const prefs = preferencias({ [clave]: registro('2026-11-11T10:00:00Z', '4') });

    const resultado = await iniciarRespaldoNativo({ nativo: true, preferencias: prefs, almacen: local, reiniciar: true });

    expect(resultado).toEqual({ restauradas: 1, copiadas: 1, activo: true });
    expect(leerBorrador(clave, local).notas.i1.score).toBe('4');
    expect(prefs.datos.get(otraClave)).toBe(registro('2026-11-11T09:00:00Z', '3'));
  });

  it('después de iniciar, cada guardado y borrado del dispositivo se refleja en Preferences', async () => {
    const local = almacen();
    vi.stubGlobal('localStorage', local);
    try {
      const prefs = preferencias();
      await iniciarRespaldoNativo({ nativo: true, preferencias: prefs, almacen: local, reiniciar: true });

      guardarBorrador(clave, { revisionBase: 2, notas: { i1: { score: '4.5', observation: '' } }, estado: 'PENDIENTE' });
      await Promise.resolve();
      expect(JSON.parse(prefs.datos.get(clave)).notas.i1.score).toBe('4.5');

      // Se pierde localStorage (p. ej. limpieza del WebView) y la app se reabre: el borrador vuelve.
      local.clear();
      await iniciarRespaldoNativo({ nativo: true, preferencias: prefs, almacen: local, reiniciar: true });
      expect(leerBorrador(clave).notas.i1.score).toBe('4.5');

      eliminarBorrador(clave);
      await Promise.resolve();
      expect(prefs.datos.has(clave)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('si Preferences falla, la app sigue con localStorage', async () => {
    const prefs = preferencias();
    prefs.keys.mockRejectedValueOnce(new Error('sin plugin'));
    await expect(iniciarRespaldoNativo({ nativo: true, preferencias: prefs, almacen: almacen(), reiniciar: true }))
      .resolves.toMatchObject({ activo: false });
  });
});
