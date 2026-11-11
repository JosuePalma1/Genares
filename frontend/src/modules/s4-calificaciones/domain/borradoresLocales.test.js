import { describe, expect, it, vi } from 'vitest';
import {
  ESTADO_LOCAL, claveBorrador, eliminarBorrador, etiquetaSincronizacion, guardarBorrador, guardarExpediente,
  leerBorrador, leerExpediente, listarPendientes, mismasNotas, resolverRecuperacion,
  RESULTADO_SINCRONIZACION, sincronizarBorrador, estadoAlConsultarExpediente,
} from './borradoresLocales';

/** Imita localStorage: persiste entre "recargas" mientras se reutilice la misma instancia. */
function almacen() {
  const datos = new Map();
  return {
    get length() { return datos.size; },
    key: (i) => [...datos.keys()][i] ?? null,
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => { datos.set(k, String(v)); },
    removeItem: (k) => { datos.delete(k); },
  };
}

const base = { asignacionId: 'a1', tipo: 'ORAL', idEtapa: 'e1', idTitular: 'est-A', idEvaluador: 'ev-1' };
const notas = { i1: { score: '4.5', observation: 'Bien' } };

describe('clave del borrador local', () => {
  it('separa cada estudiante y cada evaluador', () => {
    const a = claveBorrador(base);
    expect(claveBorrador({ ...base, idTitular: 'est-B' })).not.toBe(a);
    expect(claveBorrador({ ...base, idEvaluador: 'ev-2' })).not.toBe(a);
    expect(claveBorrador({ ...base, tipo: 'ESCRITA', idTitular: null })).toMatch(/escrita:a1:e1:compartida:ev-1$/);
  });

  it('no crea clave oral sin estudiante', () => {
    expect(claveBorrador({ ...base, idTitular: null })).toBeNull();
  });
});

describe('persistencia en el dispositivo', () => {
  it('sobrevive a una recarga o al cierre de la aplicación', () => {
    const disco = almacen();
    const clave = claveBorrador(base);
    expect(guardarBorrador(clave, { revisionBase: 3, notas }, disco)).toBe(true);
    // "Recargar": se vuelve a leer del mismo almacenamiento persistente.
    expect(leerBorrador(clave, disco)).toMatchObject({ revisionBase: 3, notas, estado: ESTADO_LOCAL.LOCAL });
  });

  it('informa si el dispositivo no puede guardar (almacenamiento lleno o bloqueado)', () => {
    const lleno = { ...almacen(), getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(guardarBorrador(claveBorrador(base), { revisionBase: 1, notas }, lleno)).toBe(false);
    expect(guardarBorrador(claveBorrador(base), { revisionBase: 1, notas }, null)).toBe(false);
  });

  it('lista solo los borradores pendientes de sincronización', () => {
    const disco = almacen();
    guardarBorrador(claveBorrador(base), { revisionBase: 1, notas, estado: ESTADO_LOCAL.PENDIENTE }, disco);
    guardarBorrador(claveBorrador({ ...base, idTitular: 'est-B' }), { revisionBase: 1, notas }, disco);
    disco.setItem('otra-clave', '{}');
    expect(listarPendientes(disco).map((p) => p.clave)).toEqual([claveBorrador(base)]);
  });

  it('conserva el estado pendiente al seguir editando y se elimina tras confirmar el servidor', () => {
    const disco = almacen();
    const clave = claveBorrador(base);
    guardarBorrador(clave, { revisionBase: 1, notas, estado: ESTADO_LOCAL.PENDIENTE }, disco);
    guardarBorrador(clave, { notas: { i1: { score: '5', observation: '' } } }, disco);
    expect(leerBorrador(clave, disco).estado).toBe(ESTADO_LOCAL.PENDIENTE);
    eliminarBorrador(clave, disco);
    expect(leerBorrador(clave, disco)).toBeNull();
  });

  it('ignora registros corruptos en lugar de romper el formulario', () => {
    const disco = almacen();
    disco.setItem(claveBorrador(base), '{no es json');
    expect(leerBorrador(claveBorrador(base), disco)).toBeNull();
  });
});

describe('recuperación al abrir la evaluación', () => {
  const local = { revisionBase: 3, notas, estado: ESTADO_LOCAL.PENDIENTE };

  it('recupera el borrador local si el servidor sigue en la misma revisión', () => {
    expect(resolverRecuperacion({ local, revisionServidor: 3, estadoServidor: 'BORRADOR' })).toEqual({ origen: 'local', conflicto: null });
  });

  it('marca conflicto, sin descartar lo local, si el servidor avanzó de revisión', () => {
    expect(resolverRecuperacion({ local, revisionServidor: 4, estadoServidor: 'BORRADOR' })).toEqual({ origen: 'servidor', conflicto: 'REVISION' });
  });

  it('no aplica un borrador local sobre una evaluación ya cerrada en el servidor', () => {
    expect(resolverRecuperacion({ local, revisionServidor: 3, estadoServidor: 'CERRADA' })).toEqual({ origen: 'servidor', conflicto: 'CERRADA' });
  });

  it('sin borrador local muestra el servidor', () => {
    expect(resolverRecuperacion({ local: null, revisionServidor: 0 })).toEqual({ origen: 'servidor', conflicto: null });
  });
});

describe('reconciliación tras un corte durante el envío', () => {
  it('reconoce que el servidor ya tiene las mismas notas', () => {
    expect(mismasNotas(notas, [{ idIndicador: 'i1', score: 4.5, observation: 'Bien' }])).toBe(true);
    expect(mismasNotas({ i1: { score: '', observation: '' } }, [{ idIndicador: 'i1', score: null, observation: null }])).toBe(true);
  });

  it('detecta diferencias reales', () => {
    expect(mismasNotas(notas, [{ idIndicador: 'i1', score: 4, observation: 'Bien' }])).toBe(false);
    expect(mismasNotas(notas, [])).toBe(false);
    expect(mismasNotas(notas, [
      { idIndicador: 'i1', score: 4.5, observation: 'Bien' },
      { idIndicador: 'i2', score: 0 },
    ])).toBe(false);
  });
});

describe('copia del expediente para trabajar sin conexión', () => {
  it('guarda y recupera la última consulta del servidor', () => {
    const disco = almacen();
    guardarExpediente('a1', { etapas: [] }, disco, new Date('2026-11-10T10:00:00Z'));
    expect(leerExpediente('a1', disco)).toEqual({ guardadoEn: '2026-11-10T10:00:00.000Z', datos: { etapas: [] } });
    expect(leerExpediente('otro', disco)).toBeNull();
  });
});

describe('estados visibles de sincronización', () => {
  it('distingue local, pendiente, servidor y conflicto', () => {
    expect(etiquetaSincronizacion({ estadoLocal: ESTADO_LOCAL.LOCAL, revision: 2 }).texto).toMatch(/^Guardado localmente/);
    expect(etiquetaSincronizacion({ estadoLocal: ESTADO_LOCAL.PENDIENTE, sinConexion: true }).texto).toMatch(/^Pendiente de sincronización.*recuperar la conexión/);
    expect(etiquetaSincronizacion({ estadoLocal: null, guardadoServidor: true, revision: 4 }).texto).toBe('Guardado en servidor · revisión 4.');
    expect(etiquetaSincronizacion({ estadoLocal: ESTADO_LOCAL.CONFLICTO }).tono).toBe('conflicto');
  });
});

describe('sincronización con el servidor', () => {
  const R = RESULTADO_SINCRONIZACION;
  const registro = { revisionBase: 2, notas };
  const conexion = new Error('sin red');
  const esErrorConexion = (e) => e === conexion;
  const conflicto = Object.assign(new Error('El borrador fue modificado.'), { status: 409 });

  it('confirma cuando el servidor acepta', async () => {
    const enviar = vi.fn().mockResolvedValue({});
    await expect(sincronizarBorrador({ registro, enviar, consultarEvaluacion: vi.fn(), esErrorConexion })).resolves.toEqual({ resultado: R.SINCRONIZADO });
    expect(enviar).toHaveBeenCalledWith(registro);
  });

  it('sin conexión deja el borrador pendiente, sin perderlo', async () => {
    const enviar = vi.fn().mockRejectedValue(conexion);
    await expect(sincronizarBorrador({ registro, enviar, consultarEvaluacion: vi.fn(), esErrorConexion })).resolves.toEqual({ resultado: R.PENDIENTE });
  });

  it('si el envío llegó pero se perdió la respuesta, el reintento no crea un conflicto falso', async () => {
    const enviar = vi.fn().mockRejectedValue(conflicto);
    const consultarEvaluacion = vi.fn().mockResolvedValue({ estado: 'BORRADOR', revision: 3, puntajes: [{ idIndicador: 'i1', score: 4.5, observation: 'Bien' }] });
    await expect(sincronizarBorrador({ registro, enviar, consultarEvaluacion, esErrorConexion }))
      .resolves.toEqual({ resultado: R.SINCRONIZADO, reconciliado: true });
    await expect(sincronizarBorrador({
      registro: { ...registro, idOperacion: 'operacion-local' }, enviar, consultarEvaluacion, esErrorConexion,
    })).resolves.toMatchObject({ resultado: R.CONFLICTO, conflicto: 'REVISION' });
  });

  it('si otro dispositivo cambió la evaluación, informa el conflicto sin sobrescribir', async () => {
    const remota = { estado: 'BORRADOR', revision: 3, puntajes: [{ idIndicador: 'i1', score: 2, observation: '' }] };
    const resultado = await sincronizarBorrador({ registro, enviar: vi.fn().mockRejectedValue(conflicto), consultarEvaluacion: vi.fn().mockResolvedValue(remota), esErrorConexion });
    expect(resultado).toEqual({ resultado: R.CONFLICTO, conflicto: 'REVISION', remota });
  });

  it('no envía sobre una evaluación ya cerrada en el servidor', async () => {
    const remota = { estado: 'CERRADA', revision: 3, puntajes: [] };
    const resultado = await sincronizarBorrador({ registro, enviar: vi.fn().mockRejectedValue(conflicto), consultarEvaluacion: vi.fn().mockResolvedValue(remota), esErrorConexion });
    expect(resultado.conflicto).toBe('CERRADA');
  });

  it('un 409 por regla académica (misma revisión) no se disfraza de conflicto', async () => {
    const regla = Object.assign(new Error('El estudiante no tiene sustentación programada en S4.'), { status: 409 });
    await expect(sincronizarBorrador({ registro, enviar: vi.fn().mockRejectedValue(regla),
      consultarEvaluacion: vi.fn().mockResolvedValue({ estado: 'BORRADOR', revision: 2, puntajes: [] }), esErrorConexion })).rejects.toBe(regla);
  });

  it('si se cae la conexión al consultar tras el 409, sigue pendiente', async () => {
    await expect(sincronizarBorrador({ registro, enviar: vi.fn().mockRejectedValue(conflicto), consultarEvaluacion: vi.fn().mockRejectedValue(conexion), esErrorConexion }))
      .resolves.toEqual({ resultado: R.PENDIENTE });
  });

  it('propaga los errores de validación del servidor', async () => {
    const invalido = Object.assign(new Error('Puntaje fuera de rango'), { status: 400 });
    await expect(sincronizarBorrador({ registro, enviar: vi.fn().mockRejectedValue(invalido), consultarEvaluacion: vi.fn(), esErrorConexion })).rejects.toBe(invalido);
  });
});

describe('nueva consulta del expediente abierto', () => {
  it('conserva el formulario visible al volver a consultar el mismo expediente', () => {
    const visible = { status: 'listo', datos: { tema: 'T' }, error: null, asignacionId: 'a1' };
    expect(estadoAlConsultarExpediente(visible, 'a1')).toBe(visible);
  });

  it('muestra la carga en la primera consulta o al cambiar de expediente', () => {
    const cargando = { status: 'cargando', datos: null, error: null, asignacionId: 'a2' };
    expect(estadoAlConsultarExpediente({ status: 'cargando', datos: null, error: null }, 'a2')).toEqual(cargando);
    expect(estadoAlConsultarExpediente({ status: 'listo', datos: { tema: 'T' }, asignacionId: 'a1' }, 'a2')).toEqual(cargando);
    expect(estadoAlConsultarExpediente({ status: 'error', datos: null, error: new Error('x'), asignacionId: 'a2' }, 'a2')).toEqual(cargando);
  });
});
