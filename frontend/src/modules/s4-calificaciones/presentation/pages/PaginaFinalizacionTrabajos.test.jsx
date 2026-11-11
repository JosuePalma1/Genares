import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { FINALIZACION_POR_PAGINA, TarjetaFinalizacion, filtrosFinalizacion } from './PaginaFinalizacionTrabajos';
import { crearServicioFinalizacionApi, rutaPaginaFinalizacion } from '../services/finalizacionApi';

const trabajo = { id: 't1', titulo: 'Tema de prueba', carrera: 'Software', codigoCarrera: 'SOFT', periodo: '2026-2', estado: 'REGISTRADO' };
const listo = { trabajo, finalizado: false, puedeFinalizar: true, pendientesTrabajo: [],
  estudiantes: [{ idEstudiante: 'e1', nombre: 'Ana Pérez', cumplida: true, pendientes: [] }] };
const bloqueado = { ...listo, puedeFinalizar: false,
  estudiantes: [{ idEstudiante: 'e1', nombre: 'Ana Pérez', cumplida: false, pendientes: ['Falta el acta de calificación archivada.'] }] };

const renderizar = (elemento, puedeFinalizarIdentidad = true) => renderToStaticMarkup(
  <MemoryRouter><TarjetaFinalizacion elemento={elemento} puedeFinalizarIdentidad={puedeFinalizarIdentidad} ocupado={false} alFinalizar={() => {}} /></MemoryRouter>,
);

describe('Finalización del trabajo (SE-03)', () => {
  it('habilita Finalizar solo cuando el servidor confirma todas las condiciones', () => {
    expect(renderizar(listo)).toMatch(/<button class="button button-primary" type="button">.*Finalizar trabajo/);
    const html = renderizar(bloqueado);
    expect(html).toMatch(/<button class="button button-primary" type="button" disabled=""/);
    expect(html).toContain('Falta el acta de calificación archivada.');
  });

  it('no ofrece la acción sin el permiso de cierre ni en un trabajo finalizado', () => {
    expect(renderizar(listo, false)).not.toContain('Finalizar trabajo');
    const finalizado = { ...listo, finalizado: true, puedeFinalizar: false, trabajo: { ...trabajo, estado: 'FINALIZADO' } };
    const html = renderizar(finalizado);
    expect(html).not.toContain('Finalizar trabajo');
    expect(html).toContain('Finalizado');
  });
});

describe('servicio de finalización', () => {
  it('valida la respuesta y envía la finalización al trabajo indicado', async () => {
    const cliente = { getJson: vi.fn().mockResolvedValue({ elementos: [listo], puedeFinalizar: true }), postJson: vi.fn().mockResolvedValue(listo) };
    const servicio = crearServicioFinalizacionApi(cliente);
    await expect(servicio.listar()).resolves.toEqual({ elementos: [listo], puedeFinalizar: true });
    await servicio.finalizar('t1');
    expect(cliente.postJson).toHaveBeenCalledWith('/finalizacion-trabajos/t1', {}, undefined);
  });

  it('rechaza respuestas con forma inesperada', async () => {
    const cliente = { getJson: vi.fn().mockResolvedValue({ elementos: [{ trabajo }], puedeFinalizar: true }) };
    await expect(crearServicioFinalizacionApi(cliente).listar()).rejects.toThrow();
  });

  const filtrosServidor = { periodo: '2026-2', periodos: [{ codigo: '2026-2', nombre: null, activo: true }] };

  it('pide una página filtrada y valida la paginación del servidor', async () => {
    const pagina = { elementos: [listo], puedeFinalizar: true, paginacion: { pagina: 2, limite: 10, total: 11, paginas: 2 }, filtros: filtrosServidor };
    const cliente = { getJson: vi.fn().mockResolvedValue(pagina) };
    const servicio = crearServicioFinalizacionApi(cliente);
    await expect(servicio.listarPagina({ pagina: 2, limite: 10, periodo: 'TODOS', buscar: ' Ana Pérez ', situacion: 'pendientes' }))
      .resolves.toEqual(pagina);
    expect(cliente.getJson.mock.calls[0][0]).toBe('/finalizacion-trabajos?limite=10&pagina=2&periodo=TODOS&buscar=Ana+P%C3%A9rez&situacion=pendientes');
    expect(rutaPaginaFinalizacion()).toBe('/finalizacion-trabajos?limite=10&pagina=1');
  });

  it('vuelve a la última página si la pedida ya no existe y rechaza paginación inválida', async () => {
    const cliente = { getJson: vi.fn()
      .mockResolvedValueOnce({ elementos: [], puedeFinalizar: true, paginacion: { pagina: 5, limite: 10, total: 12, paginas: 2 }, filtros: filtrosServidor })
      .mockResolvedValueOnce({ elementos: [listo], puedeFinalizar: true, paginacion: { pagina: 2, limite: 10, total: 12, paginas: 2 }, filtros: filtrosServidor }) };
    await expect(crearServicioFinalizacionApi(cliente).listarPagina({ pagina: 5 })).resolves.toMatchObject({ elementos: [listo], paginacion: { pagina: 2 } });
    expect(cliente.getJson.mock.calls[1][0]).toBe('/finalizacion-trabajos?limite=10&pagina=2');

    const invalido = { getJson: vi.fn().mockResolvedValue({ elementos: [listo], puedeFinalizar: true, paginacion: { pagina: 0, limite: 10, total: 1, paginas: 1 }, filtros: filtrosServidor }) };
    await expect(crearServicioFinalizacionApi(invalido).listarPagina()).rejects.toThrow();
  });
});

describe('filtros de la página de finalización', () => {
  it('envía solo los filtros elegidos y páginas cortas', () => {
    expect(filtrosFinalizacion({ pagina: 1, periodo: null, busqueda: '  ', situacion: '' }))
      .toEqual({ pagina: 1, limite: FINALIZACION_POR_PAGINA });
    expect(filtrosFinalizacion({ pagina: 3, periodo: 'TODOS', busqueda: ' Ana ', situacion: 'finalizados' }))
      .toEqual({ pagina: 3, limite: 10, periodo: 'TODOS', buscar: 'Ana', situacion: 'finalizados' });
  });
});
