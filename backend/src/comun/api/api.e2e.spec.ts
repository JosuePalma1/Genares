import { Body, Controller, Get, INestApplication, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ModuloApi } from './modulo-api';
import { configurarAplicacionApi } from './configurar-api';
import { IdentidadApi, SolicitudConIdentidad } from './identidad-api';
import { Publica, RequiereCapacidades } from './metadatos-api';
import { ControladorSalud } from '../../salud/salud.controller';

class CrearRegistroPruebaDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden!: number;
}

@Controller('pruebas-api')
class ControladorPruebasApi {
  @Post()
  @RequiereCapacidades('pruebas:escribir')
  crear(@Body() dto: CrearRegistroPruebaDto): CrearRegistroPruebaDto {
    return dto;
  }

  @Get('sin-politica')
  sinPolitica(): { estado: string } {
    return { estado: 'no debe exponerse' };
  }

  @Post('publica')
  @Publica()
  rutaEscrituraPublica(): { estado: string } {
    return { estado: 'no debe ejecutarse' };
  }

  @Get('error-interno')
  @RequiereCapacidades('pruebas:escribir')
  errorInterno(): never {
    throw new Error('detalle interno sensible');
  }
}

@Module({
  imports: [ModuloApi],
  controllers: [ControladorPruebasApi, ControladorSalud],
})
class ModuloPruebasApi {}

describe('infraestructura API', () => {
  let baseUrl: string;
  let aplicacion: INestApplication;
  const entornoOriginal = process.env.NODE_ENV;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [ModuloPruebasApi] }).compile();
    aplicacion = modulo.createNestApplication();
    aplicacion.use((request: { headers: Record<string, string | string[] | undefined>; identidadApi?: IdentidadApi }, _response: object, next: () => void) => {
      const valorTipo = request.headers['x-principal-prueba'];
      const tipo = Array.isArray(valorTipo) ? valorTipo[0] : valorTipo;
      const identidades: Record<string, IdentidadApi> = {
        verificada: { sujeto: 'prueba-verificada', tipo: 'VERIFICADA', capacidades: ['pruebas:escribir'] },
        'sin-capacidad': { sujeto: 'prueba-sin-capacidad', tipo: 'VERIFICADA', capacidades: [] },
        'desarrollo-local': { sujeto: 'GENARES:LOCAL_DEVELOPMENT', tipo: 'DESARROLLO_LOCAL', capacidades: ['pruebas:escribir'] },
      };
      (request as SolicitudConIdentidad).identidadApi = tipo ? identidades[tipo] : undefined;
      next();
    });
    configurarAplicacionApi(aplicacion);
    await aplicacion.listen(0, '127.0.0.1');
    baseUrl = await aplicacion.getUrl();
  });

  afterAll(async () => {
    await aplicacion.close();
    if (entornoOriginal === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = entornoOriginal;
  });

  async function request(path: string, init?: RequestInit, principal?: string): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (principal) headers.set('x-principal-prueba', principal);
    return fetch(`${baseUrl}${path}`, { ...init, headers });
  }

  it('conserva GET /api/salud y versiona los controladores de API en /api/v1', async () => {
    const salud = await request('/api/salud');
    expect(salud.status).toBe(200);
    expect(await salud.json()).toEqual({ estado: 'ok', servicio: 'genares-backend' });

    const versionada = await request('/api/v1/pruebas-api/sin-politica', undefined, 'verificada');
    expect(versionada.status).toBe(403);
  });

  it('valida DTO, rechaza propiedades extra y transforma solo campos explícitos', async () => {
    const invalida = await request('/api/v1/pruebas-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: '', orden: '2.5', campoExtra: true }),
    }, 'verificada');
    expect(invalida.status).toBe(400);
    const error = await invalida.json();
    expect(error).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR', path: '/api/v1/pruebas-api' });
    expect(error.details).toEqual(expect.arrayContaining([
      expect.stringContaining('campoExtra'),
      expect.stringContaining('nombre'),
      expect.stringContaining('orden'),
    ]));
    expect(error).not.toHaveProperty('stack');

    const valida = await request('/api/v1/pruebas-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: 'Rúbrica', orden: '2' }),
    }, 'verificada');
    expect(valida.status).toBe(201);
    expect(await valida.json()).toEqual({ nombre: 'Rúbrica', orden: 2 });
  });

  it('falla cerrado si falta identidad o política, y deniega capacidades insuficientes', async () => {
    const sinIdentidad = await request('/api/v1/pruebas-api', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    expect(sinIdentidad.status).toBe(401);

    const sinPermiso = await request('/api/v1/pruebas-api', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }, 'sin-capacidad');
    expect(sinPermiso.status).toBe(403);

    const sinPolitica = await request('/api/v1/pruebas-api/sin-politica', undefined, 'verificada');
    expect(sinPolitica.status).toBe(403);

    const escrituraPublica = await request('/api/v1/pruebas-api/publica', { method: 'POST' });
    expect(escrituraPublica.status).toBe(403);
  });

  it('rechaza la identidad t?cnica local fuera del entorno de desarrollo', async () => {
    for (const entorno of ['production', '']) {
      process.env.NODE_ENV = entorno;
      const respuesta = await request('/api/v1/pruebas-api', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nombre: 'Rúbrica', orden: 1 }),
      }, 'desarrollo-local');
      expect(respuesta.status).toBe(401);
      expect(await respuesta.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
    }
  });

  it('no expone excepciones internas', async () => {
    const respuesta = await request('/api/v1/pruebas-api/error-interno', undefined, 'verificada');
    expect(respuesta.status).toBe(500);
    const error = await respuesta.json();
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' });
    expect(JSON.stringify(error)).not.toContain('detalle interno sensible');
  });
});
