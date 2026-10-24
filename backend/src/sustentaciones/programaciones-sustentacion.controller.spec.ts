import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ModuloApi } from '../comun/api/modulo-api';
import { configurarAplicacionApi } from '../comun/api/configurar-api';
import { IdentidadApi, SolicitudConIdentidad } from '../comun/api/identidad-api';
import { ProgramacionesSustentacionController } from './programaciones-sustentacion.controller';
import { ProgramacionesSustentacionService } from './programaciones-sustentacion.service';

const servicio = {
  capacidades: jest.fn(),
  trabajosDisponibles: jest.fn(),
  listarParaImpresion: jest.fn(),
  listar: jest.fn(),
  obtener: jest.fn(),
  crear: jest.fn(),
  actualizar: jest.fn(),
  cambiarEstado: jest.fn(),
};

@Module({ imports: [ModuloApi], controllers: [ProgramacionesSustentacionController], providers: [
  { provide: ProgramacionesSustentacionService, useValue: servicio },
] })
class ModuloPruebaProgramaciones {}

describe('API de programaciones de sustentación', () => {
  let aplicacion: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [ModuloPruebaProgramaciones] }).compile();
    aplicacion = modulo.createNestApplication();
    aplicacion.use((request: { headers: Record<string, string | string[] | undefined>; identidadApi?: IdentidadApi }, _response: object, next: () => void) => {
      const valor = request.headers['x-principal-prueba'];
      const principal = Array.isArray(valor) ? valor[0] : valor;
      const identidades: Record<string, IdentidadApi> = {
        lector: { sujeto: 'sujeto-lector', tipo: 'VERIFICADA', capacidades: ['programaciones:leer'] },
        administrador: {
          sujeto: 'sujeto-administrador', tipo: 'VERIFICADA',
          capacidades: ['programaciones:leer', 'programaciones:administrar'],
        },
        'desarrollo-local': {
          sujeto: 'GENARES:LOCAL_DEVELOPMENT', tipo: 'DESARROLLO_LOCAL',
          capacidades: ['programaciones:leer', 'programaciones:administrar'],
        },
        denegado: { sujeto: 'sujeto-denegado', tipo: 'VERIFICADA', capacidades: [] },
      };
      (request as SolicitudConIdentidad).identidadApi = principal ? identidades[principal] : undefined;
      next();
    });
    configurarAplicacionApi(aplicacion);
    await aplicacion.listen(0, '127.0.0.1');
    baseUrl = await aplicacion.getUrl();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await aplicacion?.close();
  });

  async function solicitar(path: string, principal?: string, method = 'GET', body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {};
    if (principal) headers['x-principal-prueba'] = principal;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  it('exige identidad y capacidad de lectura en las rutas de consulta', async () => {
    servicio.listar.mockResolvedValue({ elementos: [], filtros: { carreras: [], periodos: [] } });
    expect((await solicitar('/api/v1/programaciones-sustentacion')).status).toBe(401);
    expect((await solicitar('/api/v1/programaciones-sustentacion', 'denegado')).status).toBe(403);
    expect((await solicitar('/api/v1/programaciones-sustentacion', 'lector')).status).toBe(200);
    expect(servicio.listar).toHaveBeenCalledTimes(1);
  });

  it('acepta el filtro histórico COMPLETADA para consultar FINALIZADA', async () => {
    servicio.listar.mockResolvedValue({ elementos: [], filtros: { carreras: [], periodos: [] } });
    const respuesta = await solicitar('/api/v1/programaciones-sustentacion?estado=COMPLETADA', 'lector');
    expect(respuesta.status).toBe(200);
    expect(servicio.listar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'COMPLETADA' }));
  });

  it('solo permite escribir a quien tiene capacidad administrativa y toma el actor de la identidad', async () => {
    const dto = {
      idTrabajo: '22222222-2222-4222-8222-222222222222',
      fechaProgramada: '2026-10-24', horaProgramada: '09:30', sala: 'Sala 1',
    };
    servicio.crear.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });

    expect((await solicitar('/api/v1/programaciones-sustentacion', 'lector', 'POST', dto)).status).toBe(403);
    expect(servicio.crear).not.toHaveBeenCalled();

    expect((await solicitar('/api/v1/programaciones-sustentacion', 'administrador', 'POST', dto)).status).toBe(201);
    expect(servicio.crear).toHaveBeenCalledWith(dto, 'sujeto-administrador', false);
  });

  it('pasa al servicio el actor técnico del acceso local, sin exigir una cuenta institucional', async () => {
    servicio.crear.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
    const dto = {
      idTrabajo: '22222222-2222-4222-8222-222222222222',
      fechaProgramada: '2026-10-24', horaProgramada: '09:30', sala: 'Sala local',
    };

    const respuesta = await solicitar('/api/v1/programaciones-sustentacion', 'desarrollo-local', 'POST', dto);
    expect(respuesta.status).toBe(201);
    expect(servicio.crear).toHaveBeenCalledWith(dto, 'GENARES:LOCAL_DEVELOPMENT', true);
  });

  it('rechaza propiedades adicionales, formatos inválidos y UUID inválidos antes del servicio', async () => {
    const conCampoAdicional = await solicitar('/api/v1/programaciones-sustentacion', 'administrador', 'POST', {
      idTrabajo: '22222222-2222-4222-8222-222222222222',
      fechaProgramada: '2026-10-24', horaProgramada: '09:30', sala: 'Sala 1', estado: 'COMPLETADA',
    });
    expect(conCampoAdicional.status).toBe(400);

    const fechaInvalida = await solicitar('/api/v1/programaciones-sustentacion', 'administrador', 'POST', {
      idTrabajo: '22222222-2222-4222-8222-222222222222',
      fechaProgramada: '24/10/2026', horaProgramada: '09:30', sala: 'Sala 1',
    });
    expect(fechaInvalida.status).toBe(400);
    expect((await solicitar('/api/v1/programaciones-sustentacion/no-es-uuid', 'lector')).status).toBe(400);
    expect(servicio.crear).not.toHaveBeenCalled();
  });

  it('reserva el cambio operativo de estado a la capacidad administrativa', async () => {
    servicio.cambiarEstado.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', estado: 'EN_SUSTENTACION' });
    const body = { estado: 'EN_SUSTENTACION' };
    expect((await solicitar('/api/v1/programaciones-sustentacion/11111111-1111-4111-8111-111111111111/estado', 'lector', 'PATCH', body)).status).toBe(403);
    expect(servicio.cambiarEstado).not.toHaveBeenCalled();

    const respuesta = await solicitar('/api/v1/programaciones-sustentacion/11111111-1111-4111-8111-111111111111/estado', 'administrador', 'PATCH', body);
    expect(respuesta.status).toBe(200);
    expect(servicio.cambiarEstado).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111', body, 'sujeto-administrador', false,
    );
  });

  it('rechaza estados operativos no permitidos antes de invocar el servicio', async () => {
    const respuesta = await solicitar(
      '/api/v1/programaciones-sustentacion/11111111-1111-4111-8111-111111111111/estado',
      'administrador', 'PATCH', { estado: 'PROGRAMADA' },
    );
    expect(respuesta.status).toBe(400);
    expect(servicio.cambiarEstado).not.toHaveBeenCalled();
  });
});
