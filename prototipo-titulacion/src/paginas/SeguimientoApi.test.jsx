import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { usarSeguimientoApi } from '../hooks/usarSeguimientoApi';
import { CoordinacionSeguimientoApi, ConsultaSeguimientoApi, DashboardSeguimientoApi, SecretariaSeguimientoApi } from './SeguimientoApi';

vi.mock('../hooks/usarSeguimientoApi', () => ({ usarSeguimientoApi: vi.fn() }));

const ids = {
  ti: '11111111-1111-4111-8111-111111111111',
  soft: '22222222-2222-4222-8222-222222222222',
  andrea: '33333333-3333-4333-8333-333333333333',
  mateo: '44444444-4444-4444-8444-444444444444',
  sofia: '55555555-5555-4555-8555-555555555555',
};

const trabajoTi = {
  id: ids.ti, codigo: 'DEV-TI-001', titulo: 'Sistema de laboratorio', estado: 'EVALUACION_COMPLETADA',
  idCarrera: '61111111-1111-4111-8111-111111111111', codigoCarrera: 'TI', carrera: 'Tecnologías de la Información',
  idPeriodo: '71111111-1111-4111-8111-111111111111', periodo: '2026-2',
  idModalidad: '81111111-1111-4111-8111-111111111111', codigoModalidad: 'PI', modalidad: 'Proyecto Integrador',
  idVersionRubrica: '91111111-1111-4111-8111-111111111111', versionRubrica: '1', rubrica: 'Integral', estadoVersionRubrica: 'ACTIVA',
  estudiantes: [
    { id: ids.andrea, nombres: 'Andrea', apellidos: 'Mendoza', ordenAutoria: 1 },
    { id: ids.mateo, nombres: 'Mateo', apellidos: 'Alcívar', ordenAutoria: 2 },
  ],
  tutores: [{ idAsignacion: 'a1111111-1111-4111-8111-111111111111', idDocente: 'a2111111-1111-4111-8111-111111111111', nombres: 'Ana', apellidos: 'Pérez', carrera: 'TI', asignadoEn: '2026-01-01', finalizadoEn: null }],
  estadoTribunal: 'CONFIRMADO', tribunalConfirmadoEn: '2026-01-02',
  miembrosTribunal: [
    { idMiembroTribunal: 'a3111111-1111-4111-8111-111111111111', posicion: 1, nombres: 'María', apellidos: 'López' },
    { idMiembroTribunal: 'a4111111-1111-4111-8111-111111111111', posicion: 2, nombres: 'José', apellidos: 'Mora' },
  ],
  programacion: { id: 'a5111111-1111-4111-8111-111111111111', fechaProgramada: '2026-10-28', horaProgramada: '09:00', sala: 'A-1', duracionEstimadaMinutos: 90, estado: 'PROGRAMADA' },
};

const trabajoSoft = {
  ...trabajoTi,
  id: ids.soft,
  codigo: 'DEV-SOFT-001',
  titulo: 'Aplicación móvil',
  estado: 'REGISTRADO',
  codigoCarrera: 'SOFT',
  carrera: 'Ingeniería en Software',
  periodo: '2026-1',
  estudiantes: [{ id: ids.sofia, nombres: 'Sofía', apellidos: 'Vera', ordenAutoria: 1 }],
  tutores: [],
  miembrosTribunal: [],
  estadoTribunal: 'BORRADOR',
  programacion: null,
};

const consolidacion = {
  [ids.ti]: {
    estado: 'listo',
    datos: {
      trabajoId: ids.ti,
      estudiantes: [
        { estudiante: { id: ids.andrea, nombres: 'Andrea', apellidos: 'Mendoza' }, estado: 'RESULTADO_COMPLETO', resultadoFinal: { calificacion: '9.00', calificacionMaxima: '10.00' }, etapas: [] },
        { estudiante: { id: ids.mateo, nombres: 'Mateo', apellidos: 'Alcívar' }, estado: 'EVALUACIONES_CERRADAS_INCOMPLETAS', resultadoFinal: null, etapas: [{ nombre: 'Oral', evaluadoresPendientes: [{ posicion: 2, causa: 'SIN_EVALUACION' }] }] },
      ],
    },
  },
};

const recargar = vi.fn();
const datosBase = () => ({
  trabajos: { estado: 'listo', datos: [trabajoTi, trabajoSoft], error: null },
  programaciones: { estado: 'listo', datos: [], error: null },
  actas: { estado: 'listo', datos: [{ id: 'b1111111-1111-4111-8111-111111111111', numero: '001-2026-2-TI', estudiante: 'Andrea Mendoza', carrera: 'TI', periodo: '2026-2', notaFinal: '9.00', generadoEn: '2026-10-24' }], error: null },
  consolidaciones: { estado: 'listo', datos: consolidacion, error: null },
  recargar,
});

function renderizar(elemento) {
  return renderToStaticMarkup(<MemoryRouter>{elemento}</MemoryRouter>);
}

describe('pantallas de seguimiento integradas con la API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usarSeguimientoApi.mockReturnValue(datosBase());
  });

  it('Dashboard usa el catálogo API y representa vacíos de agenda sin confundirlos con error', () => {
    const html = renderizar(<DashboardSeguimientoApi />);
    expect(html).toContain('DEV-TI-001');
    expect(html).toContain('DEV-SOFT-001');
    expect(html).toContain('Sin programaciones registradas');
    expect(html).toContain('1 acta(s) archivada(s).');
    expect(html).not.toContain('No fue posible consultar programaciones');
    expect(html).toContain(`/trabajos/${ids.ti}`);
  });

  it('Secretaría muestra el mismo expediente, tutores, programación, resultado y acta API', () => {
    const html = renderizar(<SecretariaSeguimientoApi />);
    expect(html).toContain('Trabajos');
    expect(html).toContain('Andrea Mendoza');
    expect(html).toContain('9.00 / 10.00');
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('28/10/2026');
    expect(html).toContain('001-2026-2-TI');
    expect(html).toContain(`/trabajos/${ids.ti}`);
    expect(html).toContain('href="/documentos"');
    expect(html).toContain(`trabajoId=${ids.ti}`);
  });

  it('Coordinación filtra TI y SOFT sin cambiar el universo de registros recibido', () => {
    const html = renderizar(<CoordinacionSeguimientoApi />);
    expect(html).toContain('DEV-TI-001');
    expect(html).toContain('DEV-SOFT-001');
    expect(html).toContain('<option value="TI">TI</option>');
    expect(html).toContain('<option value="SOFT">SOFT</option>');
    expect(html).toContain('2 de 2 trabajos');
    expect(html).toContain('coordinacion-api-carrera');
  });

  it('Consulta distingue resultados completos e incompletos y enlaza al UUID real del expediente', () => {
    const html = renderizar(<ConsultaSeguimientoApi />);
    expect(html).toContain('9.00 / 10.00');
    expect(html).toContain('Evaluaciones cerradas, consolidación incompleta');
    expect(html).toContain('Oral: evaluador 2 pendiente (sin evaluación)');
    expect(html).toContain('Sofía Vera');
    expect(html).toContain(`/trabajos/${ids.ti}`);
    expect(html).toContain(`/resultados/${ids.ti}/${ids.andrea}`);
    expect(html).toContain('001-2026-2-TI');
    expect(html).toContain('href="/documentos"');
  });

  it('muestra errores API en lugar de recuperar expedientes locales', () => {
    usarSeguimientoApi.mockReturnValue({
      ...datosBase(),
      trabajos: { estado: 'error', datos: [], error: new Error('Sin conexión') },
    });
    const html = renderizar(<ConsultaSeguimientoApi />);
    expect(html).toContain('Sin conexión');
    expect(html).not.toContain('DEV-TI-001');
    expect(html).not.toContain('Sistema de titulación de ejemplo');
  });

  it('Dashboard no presenta indicadores vacíos cuando falla la lectura de trabajos', () => {
    usarSeguimientoApi.mockReturnValue({
      ...datosBase(),
      trabajos: { estado: 'error', datos: [], error: new Error('NestJS no responde') },
      consolidaciones: { estado: 'no_disponible', datos: {}, error: null, mensaje: 'No hay trabajos disponibles.' },
    });
    const html = renderizar(<DashboardSeguimientoApi />);
    expect(html).toContain('No fue posible consultar trabajos.');
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).not.toContain('No hay trabajos disponibles.');
    expect(html).not.toContain('No hay trabajos registrados');
    expect(html).not.toContain('Sin estados para mostrar');
  });
});
