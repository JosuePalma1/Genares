import { Body, Controller, Get, INestApplication, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ModuloApi } from './modulo-api';
import { configurarAplicacionApi } from './configurar-api';
import {
  BASE_POSTGRES_9D,
  crearMiddlewareIdentidadLocal,
  crearMiddlewareProteccionEscrituraLocal,
  direccionEsLoopback,
  instalarIdentidadDesarrolloLocal,
  MARCA_BASE_POSTGRES_9D,
  PerfilIdentidadLocal,
  resolverPerfilIdentidadLocal,
  resolverOrigenesEscrituraLocal,
  SolicitudLocalApi,
  validarBasePostgresDesechable9D,
} from './identidad-desarrollo-local';
import { RequiereCapacidades } from './metadatos-api';

@Controller('lectura-local-prueba')
class ControladorLecturaLocalPrueba {
  @Get()
  @RequiereCapacidades('rubricas:leer')
  consultar(): { origen: string } {
    return { origen: 'postgresql-local' };
  }

  @Post()
  @RequiereCapacidades('rubricas:administrar')
  escribir(@Body() body: object): object {
    return body;
  }
}

@Module({ imports: [ModuloApi], controllers: [ControladorLecturaLocalPrueba] })
class ModuloPruebaIdentidadLocal {}

async function iniciarApiConPerfil(perfil: PerfilIdentidadLocal) {
  const modulo = await Test.createTestingModule({ imports: [ModuloPruebaIdentidadLocal] }).compile();
  const aplicacion = modulo.createNestApplication();
  aplicacion.use(crearMiddlewareIdentidadLocal(perfil));
  if (perfil === 'administrador-rubricas') {
    aplicacion.use(crearMiddlewareProteccionEscrituraLocal(['http://127.0.0.1:5173']));
  }
  configurarAplicacionApi(aplicacion);
  await aplicacion.listen(0, '127.0.0.1');
  return { aplicacion, baseUrl: await aplicacion.getUrl() };
}

describe('identidad local controlada por servidor', () => {
  it('permanece desactivada si no hay opt-in explícito', () => {
    expect(resolverPerfilIdentidadLocal({ NODE_ENV: 'development' })).toBeNull();
  });

  it('rechaza opt-in fuera de desarrollo y pruebas', () => {
    expect(() => resolverPerfilIdentidadLocal({
      NODE_ENV: 'production',
      LOCAL_DEV_IDENTITY_ENABLED: 'true',
      LOCAL_DEV_IDENTITY_PROFILE: 'lector',
    })).toThrow();
  });

  it('solo crea el perfil fijo de lectura, ignorando headers y capacidades del navegador', () => {
    const solicitud = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'x-dev-profile': 'sin-capacidades', 'x-capacidades': 'rubricas:administrar' },
    } as unknown as SolicitudLocalApi;
    const continuar = jest.fn();

    crearMiddlewareIdentidadLocal('lector')(solicitud, {}, continuar);

    expect(solicitud.identidadApi).toEqual({
      sujeto: 'desarrollo-local-lector',
      tipo: 'SIMULADA',
      capacidades: ['rubricas:leer', 'modalidades:leer'],
    });
    expect(continuar).toHaveBeenCalledTimes(1);
  });

  it('no instala identidad para conexiones remotas ni acepta direcciones reenviadas', () => {
    const solicitud = {
      socket: { remoteAddress: '192.0.2.25' },
      headers: { 'x-forwarded-for': '127.0.0.1' },
    } as unknown as SolicitudLocalApi;
    crearMiddlewareIdentidadLocal('lector')(solicitud, {}, jest.fn());
    expect(solicitud.identidadApi).toBeUndefined();
    expect(direccionEsLoopback('::ffff:127.0.0.1')).toBe(true);
    expect(direccionEsLoopback('192.0.2.25')).toBe(false);
  });

  it('no ofrece un perfil de administración local', () => {
    expect(() => resolverPerfilIdentidadLocal({
      NODE_ENV: 'development',
      LOCAL_DEV_IDENTITY_ENABLED: 'true',
      LOCAL_DEV_IDENTITY_PROFILE: 'administrador',
    })).toThrow();
  });

  it('exige opt-in explícito y una base 9D marcada para instalar al administrador local', async () => {
    const entorno = {
      NODE_ENV: 'development',
      LOCAL_DEV_IDENTITY_ENABLED: 'true',
      LOCAL_DEV_IDENTITY_PROFILE: 'administrador-rubricas',
      LOCAL_DEV_WRITE_ENABLED: 'true',
      LOCAL_DEV_WRITE_ORIGINS: 'http://127.0.0.1:5173',
      DB_DISPOSABLE: 'true',
      DB_HOST: '127.0.0.1',
      DB_PORT: '55441',
      DB_NAME: BASE_POSTGRES_9D,
    };
    expect(resolverPerfilIdentidadLocal(entorno)).toBe('administrador-rubricas');
    expect(resolverOrigenesEscrituraLocal(entorno)).toEqual(['http://127.0.0.1:5173']);

    expect(() => resolverPerfilIdentidadLocal({ ...entorno, NODE_ENV: 'production' })).toThrow();
    expect(() => resolverPerfilIdentidadLocal({ ...entorno, DB_NAME: 'genares_dev_8e_test' })).toThrow();
    expect(() => resolverPerfilIdentidadLocal({ ...entorno, LOCAL_DEV_WRITE_ORIGINS: 'https://evil.example' })).toThrow();
    expect(() => resolverPerfilIdentidadLocal({ ...entorno, LOCAL_DEV_WRITE_ENABLED: 'false' })).toThrow();

    const aplicacionUsos = { use: jest.fn() };
    const baseCorrecta = {
      nombre: BASE_POSTGRES_9D,
      direccion: '127.0.0.1',
      puerto: 55441,
      marca: MARCA_BASE_POSTGRES_9D,
    };
    await expect(instalarIdentidadDesarrolloLocal(aplicacionUsos as unknown as INestApplication, entorno, async () => baseCorrecta)).resolves.toBe('administrador-rubricas');
    expect(aplicacionUsos.use).toHaveBeenCalledTimes(2);
    expect(() => validarBasePostgresDesechable9D(entorno, { ...baseCorrecta, marca: 'otra-base' })).toThrow();
    await expect(instalarIdentidadDesarrolloLocal(aplicacionUsos as unknown as INestApplication, entorno, async () => ({ ...baseCorrecta, nombre: 'genares_dev_8e_test' }))).rejects.toThrow();
  });

  it('deniega escrituras locales sin origen exacto, Fetch Metadata, JSON y marca de intención', async () => {
    const { aplicacion, baseUrl } = await iniciarApiConPerfil('administrador-rubricas');
    try {
      const base = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      } as const;
      const origenAjeno = await fetch(`${baseUrl}/api/v1/lectura-local-prueba`, {
        ...base,
        headers: { ...base.headers, origin: 'http://evil.example', 'sec-fetch-site': 'cross-site', 'x-genares-write-intent': 'local-development' },
      });
      expect(origenAjeno.status).toBe(403);

      const fetchCruzado = await fetch(`${baseUrl}/api/v1/lectura-local-prueba`, {
        ...base,
        headers: { ...base.headers, origin: 'http://127.0.0.1:5173', 'sec-fetch-site': 'cross-site', 'x-genares-write-intent': 'local-development' },
      });
      expect(fetchCruzado.status).toBe(403);

      const sinMarca = await fetch(`${baseUrl}/api/v1/lectura-local-prueba`, {
        ...base,
        headers: { ...base.headers, origin: 'http://127.0.0.1:5173', 'sec-fetch-site': 'same-origin' },
      });
      expect(sinMarca.status).toBe(403);

      const autorizado = await fetch(`${baseUrl}/api/v1/lectura-local-prueba`, {
        ...base,
        headers: {
          ...base.headers,
          origin: 'http://127.0.0.1:5173',
          'sec-fetch-site': 'same-origin',
          'x-genares-write-intent': 'local-development',
          'x-capacidades': 'ninguna',
        },
      });
      expect(autorizado.status).toBe(201);
    } finally {
      await aplicacion.close();
    }
  }, 30000);

  it('autoriza lectura, deniega escritura y no permite que headers elijan identidad o capacidades', async () => {
    const { aplicacion, baseUrl } = await iniciarApiConPerfil('lector');
    try {
      const lectura = await fetch(`${baseUrl}/api/v1/lectura-local-prueba`, {
        headers: { 'x-dev-profile': 'sin-identidad', 'x-capacidades': 'rubricas:administrar' },
      });
      expect(lectura.status).toBe(200);
      expect(await lectura.json()).toEqual({ origen: 'postgresql-local' });

      const escritura = await fetch(`${baseUrl}/api/v1/lectura-local-prueba`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-capacidades': 'rubricas:administrar' },
        body: '{}',
      });
      expect(escritura.status).toBe(403);
    } finally {
      await aplicacion.close();
    }
  }, 30000);

  it('cambio de perfil del servidor deniega lectura y perfil sin identidad devuelve 401', async () => {
    for (const [perfil, esperado] of [['sin-capacidades', 403], ['sin-identidad', 401]] as const) {
      const { aplicacion, baseUrl } = await iniciarApiConPerfil(perfil);
      try {
        const respuesta = await fetch(`${baseUrl}/api/v1/lectura-local-prueba`, {
          headers: { 'x-dev-profile': 'lector', 'x-principal-prueba': 'verificada' },
        });
        expect(respuesta.status).toBe(esperado);
      } finally {
        await aplicacion.close();
      }
    }
  }, 30000);
});
