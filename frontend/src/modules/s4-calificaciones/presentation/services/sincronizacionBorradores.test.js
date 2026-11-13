import { describe, expect, it, vi } from 'vitest';
import { claveBorrador, ESTADO_LOCAL, guardarBorrador, leerBorrador } from '../../domain/borradoresLocales';
import { contarCola, sincronizarColaBorradores } from './sincronizacionBorradores';
import { avisoColaBorradores } from '../hooks/usarSincronizacionBorradores';

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

const oral = (idTitular, idEvaluador = 'ev-1') => ({ asignacionId: 'a1', tipo: 'ORAL', idEtapa: 'e-oral', idTitular, idEvaluador });
const escrita = { asignacionId: 'a1', tipo: 'ESCRITA', idEtapa: 'e-escrita', idTitular: null, idEvaluador: 'ev-1' };
const notas = { i1: { score: '4.5', observation: ' Bien ' } };
const conexion = () => Object.assign(new Error('sin red'), { name: 'ErrorConexionApi' });
const esErrorConexion = (error) => error?.name === 'ErrorConexionApi';

function expediente(evaluaciones = []) {
  const etapa = (id) => ({ id, categorias: [{ indicadores: [{ id: 'i1', calificacionMaxima: '5' }] }] });
  return { puedeGuardarBorradores: true, etapas: [etapa('e-oral'), etapa('e-escrita')], evaluaciones };
}

function sembrar(disco, contexto, datos) {
  const clave = claveBorrador(contexto);
  guardarBorrador(clave, { revisionBase: 2, notas, idOperacion: `op-${contexto.idTitular ?? 'compartida'}`, ...datos }, disco);
  return clave;
}

describe('sincronización de la cola local (RF-31)', () => {
  it('envía los borradores locales y pendientes con su revisión y su operación, y los quita al confirmarse', async () => {
    const disco = almacen();
    const pendiente = sembrar(disco, oral('est-A'), { estado: ESTADO_LOCAL.PENDIENTE });
    const local = sembrar(disco, escrita, { estado: ESTADO_LOCAL.LOCAL });
    const enviarBorrador = vi.fn().mockResolvedValue({ guardado: true });
    const resumen = await sincronizarColaBorradores({
      almacen: disco, esErrorConexion, enEdicion: () => false,
      consultarExpediente: vi.fn().mockResolvedValue(expediente()), enviarBorrador,
    });
    expect(resumen).toEqual({ sincronizados: 2, conflictos: 0, rechazados: 0, sinConexion: false });
    expect(enviarBorrador).toHaveBeenCalledWith('a1', {
      idEtapaRubrica: 'e-oral', idAsignacionTribunal: 'ev-1', idEstudiante: 'est-A', revisionEsperada: 2,
      puntajes: [{ idIndicador: 'i1', score: 4.5, observation: 'Bien' }], idOperacion: 'op-est-A',
    }, 'ORAL');
    expect(enviarBorrador).toHaveBeenCalledWith('a1', expect.objectContaining({ idEtapaRubrica: 'e-escrita', idEstudiante: null }), 'ESCRITA');
    expect(leerBorrador(pendiente, disco)).toBeNull();
    expect(leerBorrador(local, disco)).toBeNull();
  });

  it('omite el borrador abierto en esta pestaña y los que ya están en conflicto', async () => {
    const disco = almacen();
    const abierto = sembrar(disco, oral('est-A'), { estado: ESTADO_LOCAL.PENDIENTE });
    sembrar(disco, oral('est-B'), { estado: ESTADO_LOCAL.CONFLICTO });
    const enviarBorrador = vi.fn();
    await sincronizarColaBorradores({
      almacen: disco, esErrorConexion, enEdicion: (clave) => clave === abierto,
      consultarExpediente: vi.fn().mockResolvedValue(expediente()), enviarBorrador,
    });
    expect(enviarBorrador).not.toHaveBeenCalled();
    expect(contarCola(disco)).toEqual({ pendientes: 1, conflictos: 1 });
  });

  it('sin conexión se detiene y conserva toda la cola', async () => {
    const disco = almacen();
    const a = sembrar(disco, oral('est-A'), { estado: ESTADO_LOCAL.PENDIENTE });
    const b = sembrar(disco, oral('est-B'), { estado: ESTADO_LOCAL.PENDIENTE });
    const enviarBorrador = vi.fn().mockRejectedValue(conexion());
    const resumen = await sincronizarColaBorradores({
      almacen: disco, esErrorConexion, enEdicion: () => false,
      consultarExpediente: vi.fn().mockResolvedValue(expediente()), enviarBorrador,
    });
    expect(resumen.sinConexion).toBe(true);
    expect(enviarBorrador).toHaveBeenCalledTimes(1);
    expect(leerBorrador(a, disco).estado).toBe(ESTADO_LOCAL.PENDIENTE);
    expect(leerBorrador(b, disco).estado).toBe(ESTADO_LOCAL.PENDIENTE);
  });

  it('un rechazo del servidor deja el borrador intacto en la cola', async () => {
    const disco = almacen();
    const clave = sembrar(disco, oral('est-A'), { estado: ESTADO_LOCAL.LOCAL });
    const antes = leerBorrador(clave, disco);
    const resumen = await sincronizarColaBorradores({
      almacen: disco, esErrorConexion, enEdicion: () => false,
      consultarExpediente: vi.fn().mockResolvedValue(expediente()),
      enviarBorrador: vi.fn().mockRejectedValue(Object.assign(new Error('Regla académica'), { status: 400 })),
    });
    expect(resumen.rechazados).toBe(1);
    expect(leerBorrador(clave, disco)).toEqual(antes);
  });

  it('otra revisión en el servidor marca conflicto sin perder las notas locales', async () => {
    const disco = almacen();
    const clave = sembrar(disco, oral('est-A'), { estado: ESTADO_LOCAL.PENDIENTE });
    const remota = { idEtapaRubrica: 'e-oral', idAsignacionTribunal: 'ev-1', idEstudiante: 'est-A', estado: 'BORRADOR', revision: 5, puntajes: [] };
    const resumen = await sincronizarColaBorradores({
      almacen: disco, esErrorConexion, enEdicion: () => false,
      consultarExpediente: vi.fn().mockResolvedValueOnce(expediente()).mockResolvedValue(expediente([remota])),
      enviarBorrador: vi.fn().mockRejectedValue({ status: 409 }),
    });
    expect(resumen.conflictos).toBe(1);
    expect(leerBorrador(clave, disco)).toMatchObject({ estado: ESTADO_LOCAL.CONFLICTO, notas, revisionBase: 2 });
  });

  it('no envía un borrador cuya evaluación ya se cerró en el servidor', async () => {
    const disco = almacen();
    const clave = sembrar(disco, oral('est-A'), { estado: ESTADO_LOCAL.PENDIENTE });
    const cerrada = { idEtapaRubrica: 'e-oral', idAsignacionTribunal: 'ev-1', idEstudiante: 'est-A', estado: 'CERRADA', revision: 3 };
    const enviarBorrador = vi.fn();
    await sincronizarColaBorradores({
      almacen: disco, esErrorConexion, enEdicion: () => false,
      consultarExpediente: vi.fn().mockResolvedValue(expediente([cerrada])), enviarBorrador,
    });
    expect(enviarBorrador).not.toHaveBeenCalled();
    expect(leerBorrador(clave, disco)).toMatchObject({ estado: ESTADO_LOCAL.CONFLICTO, notas });
  });

  it('sin permiso para guardar borradores no envía nada ni borra la copia', async () => {
    const disco = almacen();
    const clave = sembrar(disco, oral('est-A'), { estado: ESTADO_LOCAL.PENDIENTE });
    const enviarBorrador = vi.fn();
    const resumen = await sincronizarColaBorradores({
      almacen: disco, esErrorConexion, enEdicion: () => false,
      consultarExpediente: vi.fn().mockResolvedValue({ ...expediente(), puedeGuardarBorradores: false }), enviarBorrador,
    });
    expect(resumen.rechazados).toBe(1);
    expect(enviarBorrador).not.toHaveBeenCalled();
    expect(leerBorrador(clave, disco).estado).toBe(ESTADO_LOCAL.PENDIENTE);
  });
});

describe('indicador de la cola en la barra superior (RF-32)', () => {
  it('avisa pendientes y conflictos, y nada cuando la cola está vacía', () => {
    expect(avisoColaBorradores({ pendientes: 0, conflictos: 0, sincronizando: false })).toBeNull();
    expect(avisoColaBorradores({ pendientes: 2, conflictos: 0, sincronizando: false }).corto).toBe('2 sin sincronizar');
    expect(avisoColaBorradores({ pendientes: 2, conflictos: 0, sincronizando: true }).corto).toBe('Sincronizando…');
    expect(avisoColaBorradores({ pendientes: 2, conflictos: 1, sincronizando: false })).toMatchObject({ tono: 'conflicto', corto: '1 en conflicto' });
  });
});
