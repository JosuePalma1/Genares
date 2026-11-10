import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PaginaDetalleTrabajoApi, PaginaTrabajosApi, PaginaTribunalTrabajoApi } from './PaginaTrabajosApi';
import { usarTrabajoApi, usarTrabajosApi } from '../hooks/usarTrabajosApi';
import { usarEvaluacionesTrabajoApi } from '../hooks/usarEvaluacionesApi';
import { ErrorConexionApi } from '../services/clienteHttp';
import { filtrarTrabajosApi } from '../../domain/filtrarTrabajosApi';

vi.mock('../hooks/usarTrabajosApi', () => ({
  usarTrabajosApi: vi.fn(),
  usarTrabajoApi: vi.fn(),
}));
vi.mock('../hooks/usarEvaluacionesApi', () => ({
  usarEvaluacionesTrabajoApi: vi.fn(),
}));

const trabajoId = '11000000-0000-4000-8000-000000000001';
const estudianteId = '22000000-0000-4000-8000-000000000001';
const trabajo = {
  id: trabajoId, codigo: 'DEV-TI-001', titulo: 'Sistema de prueba', estado: 'TRIBUNAL_ASIGNADO',
  idCarrera: '33000000-0000-4000-8000-000000000001', codigoCarrera: 'TI', carrera: 'Tecnologías de la Información',
  idPeriodo: '44000000-0000-4000-8000-000000000001', periodo: '2026-2',
  idModalidad: '55000000-0000-4000-8000-000000000001', codigoModalidad: 'PI', modalidad: 'Proyecto Integrador',
  idVersionRubrica: '66000000-0000-4000-8000-000000000001', versionRubrica: '10.9B-1', estadoVersionRubrica: 'ACTIVA', rubrica: 'Rúbrica TI',
  estudiantes: [{ id: estudianteId, nombres: 'Andrea', apellidos: 'Vera', ordenAutoria: 1 }],
  tutores: [], estadoTribunal: 'CONFIRMADO', tribunalConfirmadoEn: '2026-01-02T00:00:00.000Z',
  miembrosTribunal: [{ idMiembroTribunal: '77000000-0000-4000-8000-000000000001', posicion: 1, nombres: 'Jurado', apellidos: 'Uno' }],
  escritasCerradas: 2,
  sesiones: [
    { id: '88000000-0000-4000-8000-000000000001', fecha: '2026-12-15', inicio: '09:00', fin: '10:00', sala: 'DEV-AULA-101', duracionEstimadaMinutos: 60, creadoEn: '2026-11-01T09:00:00.000Z', actualizadoEn: '2026-11-01T09:00:00.000Z', inicioRealEn: null, finalizacionRealEn: null, participantes: [estudianteId], tipo: 'CONJUNTA', estado: 'PROGRAMADA', cantidadParticipantes: 1 },
  ],
  programacion: null,
};

function renderEnRuta(path, element) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/trabajos/:idTrabajo" element={element} /></Routes>
    </MemoryRouter>,
  );
}

describe('recorrido API de trabajos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usarTrabajosApi.mockReturnValue({ estado: 'listo', trabajos: [trabajo], recargar: vi.fn() });
    usarTrabajoApi.mockReturnValue({ estado: 'listo', trabajo, recargar: vi.fn() });
    usarEvaluacionesTrabajoApi.mockReturnValue({
      estado: 'listo', recargar: vi.fn(),
      consolidacion: { estudiantes: [{ estudiante: { id: estudianteId }, etapas: [] }] },
    });
  });

  it('muestra solo el expediente recibido por el listado API', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PaginaTrabajosApi /></MemoryRouter>);
    expect(html).toContain('DEV-TI-001');
    expect(html).toContain('Andrea Vera');
    expect(html).not.toContain('trabajo-184');
    expect(html).toContain(`/trabajos/${trabajoId}`);
  });

  it('conserva los filtros por evaluador y asignación de tribunal en la página definitiva', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PaginaTrabajosApi /></MemoryRouter>);
    expect(html).toContain('Buscar trabajo, estudiante, tutor o evaluador');
    expect(html).toContain('id="trabajos-api-tribunal"');
    expect(html).toContain('Actualizar');
    expect(html).toContain('Evaluaciones escritas cerradas');
    expect(html).toContain('Sesiones');
  });

  it('busca evaluadores y filtra por existencia de tribunal', () => {
    const sinTribunal = { ...trabajo, id: '11000000-0000-4000-8000-000000000002', miembrosTribunal: [] };
    expect(filtrarTrabajosApi([trabajo, sinTribunal], { busqueda: 'Jurado Uno', tribunal: 'con-tribunal' }))
      .toEqual([trabajo]);
    expect(filtrarTrabajosApi([trabajo, sinTribunal], { tribunal: 'sin-tribunal' }))
      .toEqual([sinTribunal]);
  });

  it('presenta el fallo API como error recuperable sin un estado vacío de trabajos', () => {
    usarTrabajosApi.mockReturnValue({
      estado: 'error', trabajos: [], error: new ErrorConexionApi(), recargar: vi.fn(),
    });
    const html = renderToStaticMarkup(<MemoryRouter><PaginaTrabajosApi /></MemoryRouter>);
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain('No se pudieron consultar los trabajos');
    expect(html).toContain('No fue posible completar la consulta');
    expect(html).toContain('Reintentar');
    expect(html).not.toContain('No hay trabajos registrados');
    expect(html).not.toContain('empty-estado');
  });

  it('enlaza el expediente persistido con evaluaciones, resultados y tribunal', () => {
    const html = renderEnRuta(`/trabajos/${trabajoId}`, <PaginaDetalleTrabajoApi />);
    expect(html).toContain(`/evaluaciones/${trabajoId}/escrita`);
    expect(html).toContain(`/resultados/${trabajoId}/${estudianteId}`);
    expect(html).toContain(`/documentos?trabajoId=${trabajoId}`);
    expect(html).toContain('Jurado Uno');
    expect(html).toContain('No hay tutor registrado.');
  });

  it('presenta el tribunal como consulta y no como formulario de asignación', () => {
    const html = renderEnRuta(`/trabajos/${trabajoId}`, <PaginaTribunalTrabajoApi />);
    expect(html).toContain('Consulta de asignación');
    expect(html).toContain('GENARES muestra la relación recibida del sistema responsable');
    expect(html).not.toContain('Confirmar asignación');
  });
});
