import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVALUACIONES_POR_PAGINA, PaginaMisEvaluacionesApi } from './PaginaEvaluacionesApi';
import { usarPaginaTrabajosApi } from '../hooks/usarTrabajosApi';
import { adaptarListaTrabajosEvaluacionApi } from '../../infrastructure/repositories/evaluacionesApi';

vi.mock('../hooks/usarTrabajosApi', () => ({ usarPaginaTrabajosApi: vi.fn() }));

const idEscrita = '44000000-0000-4000-8000-000000000001';
const idOral = '44000000-0000-4000-8000-000000000002';
const idEstudiante = '22000000-0000-4000-8000-000000000001';
const trabajo = {
  id: '11000000-0000-4000-8000-000000000001', codigo: 'DEV-TI-001', titulo: 'Sistema de prueba',
  codigoCarrera: 'TI', carrera: 'TI', periodo: '2026-2', modalidad: 'Proyecto', rubrica: 'Rúbrica TI', versionRubrica: '1',
  estadoRegistro: 1,
  estudiantes: [{ id: idEstudiante, nombres: 'Andrea', apellidos: 'Vera' }],
  miembrosTribunal: [{ idMiembroTribunal: '33000000-0000-4000-8000-000000000001', nombres: 'Jurado', apellidos: 'Uno' }],
  sesiones: [],
  oralSinSesion: true,
  resumenEvaluaciones: {
    puedeCalificar: true,
    etapas: [
      { idEtapa: idEscrita, tipo: 'ESCRITA', nombre: 'Revisión escrita', idEstudiante: null, estado: 'BORRADOR' },
      { idEtapa: idOral, tipo: 'ORAL', nombre: 'Sustentación', idEstudiante, estado: 'PENDIENTE' },
    ],
    conResultado: [],
  },
};
const filtros = { periodo: '2026-2', periodos: [{ codigo: '2026-2', nombre: null, activo: true }], estados: [] };

const render = () => renderToStaticMarkup(<MemoryRouter><PaginaMisEvaluacionesApi /></MemoryRouter>);

describe('Mis evaluaciones paginadas en el servidor', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([false, true])('habilita la oral sin sesión únicamente con la excepción (%s)', (oralSinSesion) => {
    usarPaginaTrabajosApi.mockReturnValue({
      estado: 'listo', trabajos: [{ ...trabajo, oralSinSesion, programacion: null }],
      filtros, paginacion: { pagina: 1, limite: EVALUACIONES_POR_PAGINA, total: 1, paginas: 1 },
    });
    const html = render();
    expect(html.includes('Calificar oral')).toBe(oralSinSesion);
    expect(html.includes('Falta programar la sustentación')).toBe(!oralSinSesion);
  });

  it('pide la primera página del período actual con el adaptador de evaluaciones', () => {
    usarPaginaTrabajosApi.mockReturnValue({
      estado: 'listo', actualizando: false, trabajos: [trabajo], error: null, recargar: vi.fn(), filtros,
      paginacion: { pagina: 1, limite: EVALUACIONES_POR_PAGINA, total: 1, paginas: 1 },
    });
    const html = render();
    expect(usarPaginaTrabajosApi).toHaveBeenCalledWith({ vista: 'mis-evaluaciones', pagina: 1, limite: EVALUACIONES_POR_PAGINA }, adaptarListaTrabajosEvaluacionApi);
    expect(html).toContain('Sistema de prueba');
    expect(html).toContain('Calificar oral');
    expect(html.match(/Continuar borrador/g)).toHaveLength(1);
    expect(html).toContain('Tribunal y rúbrica');
    expect(html).toContain('1 trabajo');
    expect(html).toContain('Estado de evaluación');
    expect(html).not.toContain('Ver resultado');
    expect(html).toContain('2026-2 (actual)');
    expect(html).not.toContain('Páginas de evaluaciones');
  });

  it('asocia la oral y el resultado únicamente al estudiante correspondiente', () => {
    const idBina = '22000000-0000-4000-8000-000000000002';
    usarPaginaTrabajosApi.mockReturnValue({
      estado: 'listo', filtros,
      trabajos: [{ ...trabajo, oralSinSesion: false,
        estudiantes: [...trabajo.estudiantes, { id: idBina, nombres: 'María', apellidos: 'Vera' }],
        sesiones: [{ participantes: [idEstudiante], estado: 'PROGRAMADA', estadoRegistro: 1, fecha: '2026-12-01', inicio: '11:00' }],
        resumenEvaluaciones: { ...trabajo.resumenEvaluaciones, conResultado: [idEstudiante],
          etapas: [...trabajo.resumenEvaluaciones.etapas, { idEtapa: idOral, tipo: 'ORAL', nombre: 'Sustentación', idEstudiante: idBina, estado: 'PENDIENTE' }] },
      }],
    });
    const html = render();
    expect(html).toContain(`/oral/${idEstudiante}?etapa=${idOral}`);
    expect(html).not.toContain(`/oral/${idBina}`);
    expect(html).toContain(`/resultados/${trabajo.id}/${idEstudiante}`);
    expect(html).not.toContain(`/resultados/${trabajo.id}/${idBina}`);
  });

  it('muestra el paginador con varias páginas y el error recuperable sin estado vacío', () => {
    usarPaginaTrabajosApi.mockReturnValue({
      estado: 'listo', actualizando: false, trabajos: [trabajo], error: null, recargar: vi.fn(), filtros,
      paginacion: { pagina: 1, limite: 20, total: 45, paginas: 3 },
    });
    expect(render()).toContain('1–20 de 45');

    usarPaginaTrabajosApi.mockReturnValue({
      estado: 'error', actualizando: false, trabajos: [], error: { status: 500, message: 'Falla' }, recargar: vi.fn(), filtros: null, paginacion: null,
    });
    const html = render();
    expect(html).toContain('No se pudieron consultar las evaluaciones');
    expect(html).not.toContain('No hay trabajos registrados');
  });
});
