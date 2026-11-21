import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { accesoPorAlcance, alcanceActual, conAlcance, ejecutarConIdentidad, filtroAlcance, SIN_RESTRICCION } from './contexto-alcance';
import { GuardiaCapacidades } from './guardia-capacidades';
import {
  CAPACIDADES_POR_ROL, CONTRASENA_DEMO, credencialesValidas, crearFirmador, crearManejadorSesionDemo,
  crearMiddlewareIdentidadDemo, identidadDeUsuarioDemo, USUARIOS_DEMO,
} from './identidad-demo';
import { IdentidadApi } from './identidad-api';

const usuario = (nombre: string) => USUARIOS_DEMO.find((u) => u.usuario === nombre)!;
const LOCAL: IdentidadApi = { sujeto: 'GENARES:LOCAL_DEVELOPMENT', tipo: 'DESARROLLO_LOCAL', capacidades: [] };

describe('ámbito de la petición (contexto-alcance)', () => {
  it('el superusuario de demo puede calificar y cerrar sin límites de carrera ni tribunal', () => {
    const cuenta = usuario('super.admin');
    expect(cuenta).toBeDefined();
    const identidad = identidadDeUsuarioDemo(cuenta);
    expect(identidad.capacidades).toEqual(expect.arrayContaining([
      'integracion:guardar-borrador', 'integracion:cerrar-evaluacion',
    ]));
    ejecutarConIdentidad(identidad, () => {
      expect(alcanceActual()).toEqual(SIN_RESTRICCION);
      expect(conAlcance(accesoPorAlcance())[0]).toContain('TRUE OR');
    });
  });

  it('sin identidad o con la identidad local no restringe ni cambia la consulta', () => {
    const sql = `SELECT 1 FROM s2.asignacion_tema a LEFT JOIN gen.carrera c ON true WHERE true ${filtroAlcance()}`;
    expect(alcanceActual()).toEqual(SIN_RESTRICCION);
    ejecutarConIdentidad(LOCAL, () => {
      expect(alcanceActual()).toEqual(SIN_RESTRICCION);
      expect(conAlcance(sql, [1])).toEqual([sql, [1]]);
    });
    // Las marcas valen NULL: la consulta sin sustituir es válida y no filtra.
    expect(sql).toContain('/*ALCANCE_CARRERAS*/NULL::text[] IS NULL');
  });

  it('coordinación: limita por sus carreras y añade los parámetros al final', () => {
    ejecutarConIdentidad(identidadDeUsuarioDemo(usuario('coordinacion.ti')), () => {
      expect(alcanceActual()).toEqual({ carreras: ['DEV-TI'], tribunalDe: null });
      const [sql, parametros] = conAlcance(`WHERE a.id = $1 ${filtroAlcance()}`, ['x']);
      expect(sql).toContain('$2::text[] IS NULL OR c.codigo = ANY($2::text[])');
      expect(sql).toContain('u_alc.sujeto_autenticacion = $3');
      expect(sql).not.toContain('ALCANCE_');
      expect(parametros).toEqual(['x', ['DEV-TI'], null]);
    });
  });

  it('tribunal: solo los trabajos de su tribunal, en cualquier carrera', () => {
    ejecutarConIdentidad(identidadDeUsuarioDemo(usuario('tribunal.ti')), () => {
      expect(alcanceActual()).toEqual({ carreras: null, tribunalDe: 'dev-ti-a' });
      const [, parametros] = conAlcance(accesoPorAlcance('t', 'c.codigo'), []);
      expect(parametros).toEqual([null, 'dev-ti-a']);
    });
  });
});

describe('usuarios de demostración (identidad-demo)', () => {
  it('cada rol tiene solo sus capacidades (Paso 1 §2, Paso 2 A.4)', () => {
    expect(CAPACIDADES_POR_ROL.TRIBUNAL).toContain('integracion:guardar-borrador');
    expect(CAPACIDADES_POR_ROL.TRIBUNAL).not.toContain('rubricas:administrar');
    expect(CAPACIDADES_POR_ROL.TRIBUNAL).not.toContain('programaciones:administrar');
    expect(CAPACIDADES_POR_ROL.SECRETARIA).not.toContain('rubricas:leer');
    expect(CAPACIDADES_POR_ROL.SECRETARIA).not.toContain('integracion:guardar-borrador');
    expect(CAPACIDADES_POR_ROL.PRESIDENCIA).not.toContain('rubricas:administrar');
    expect(CAPACIDADES_POR_ROL.COORDINACION).toEqual(expect.arrayContaining(['rubricas:administrar', 'programaciones:administrar', 'trabajos:finalizar']));
    expect(CAPACIDADES_POR_ROL.ADMINISTRACION).not.toContain('trabajos:leer');
    for (const capacidades of Object.values(CAPACIDADES_POR_ROL)) expect(capacidades).not.toContain('evaluaciones:leer-demostracion');
  });

  it('acepta solo la contraseña común y un usuario existente', () => {
    expect(credencialesValidas('Secretaria ', CONTRASENA_DEMO)?.usuario).toBe('secretaria');
    expect(credencialesValidas('secretaria', 'otra')).toBeNull();
    expect(credencialesValidas('nadie', CONTRASENA_DEMO)).toBeNull();
    expect(credencialesValidas(undefined, CONTRASENA_DEMO)).toBeNull();
  });

  it('el token firmado identifica al usuario y rechaza alteraciones, vencimientos y otros arranques', () => {
    const firmador = crearFirmador(Buffer.alloc(32, 1));
    const token = firmador.emitir('presidencia', 1000);
    expect(firmador.verificar(token, 2000)?.usuario).toBe('presidencia');
    expect(firmador.verificar(`${token}x`, 2000)).toBeNull();
    expect(firmador.verificar(token, 1000 + 13 * 60 * 60 * 1000)).toBeNull();
    expect(crearFirmador(Buffer.alloc(32, 2)).verificar(token, 2000)).toBeNull();
    expect(firmador.verificar(undefined)).toBeNull();
  });

  it('el middleware sustituye la identidad local y deja sin identidad una sesión inválida', () => {
    const firmador = crearFirmador(Buffer.alloc(32, 3));
    const valida: Record<string, any> = { identidadApi: LOCAL, headers: { authorization: `Bearer ${firmador.emitir('comision.ti')}` } };
    let vista: unknown;
    crearMiddlewareIdentidadDemo(firmador)(valida, null, () => { vista = alcanceActual(); });
    expect(valida.identidadApi).toMatchObject({ tipo: 'DEMOSTRACION', sujeto: 'demo-comision-ti', rol: 'COMISION' });
    expect(vista).toEqual({ carreras: ['DEV-TI'], tribunalDe: null });

    const vencida: Record<string, any> = { identidadApi: LOCAL, headers: { cookie: 'otra=1; genares_demo=falso.token' } };
    crearMiddlewareIdentidadDemo(firmador)(vencida, null, () => undefined);
    expect(vencida.identidadApi).toBeUndefined();

    const sinSesion: Record<string, any> = { identidadApi: LOCAL, headers: {} };
    crearMiddlewareIdentidadDemo(firmador)(sinSesion, null, () => undefined);
    expect(sinSesion.identidadApi).toBe(LOCAL);
  });

  it('la entrada devuelve el token y una cookie; con credenciales malas responde 401', async () => {
    const firmador = crearFirmador(Buffer.alloc(32, 4));
    const responder = (cuerpo: unknown) => new Promise<{ estado?: number; cuerpo: any; cookie?: string }>((resolver) => {
      const cabeceras: Record<string, string> = {};
      const respuesta = {
        statusCode: 0,
        setHeader: (nombre: string, valor: string | string[]) => { cabeceras[nombre] = String(valor); },
        end: (texto?: string) => resolver({ estado: respuesta.statusCode, cuerpo: texto ? JSON.parse(texto) : null, cookie: cabeceras['Set-Cookie'] }),
      };
      crearManejadorSesionDemo(firmador)({ method: 'POST', url: '/api/v1/demo/sesion', body: cuerpo }, respuesta, () => undefined);
    });
    const bien = await responder({ usuario: 'tribunal.soft', contrasena: CONTRASENA_DEMO });
    expect(bien.estado).toBe(200);
    expect(firmador.verificar(bien.cuerpo.token)?.usuario).toBe('tribunal.soft');
    expect(bien.cookie).toContain('HttpOnly');
    expect(bien.cuerpo.usuario).toMatchObject({ usuario: 'tribunal.soft', nombreRol: 'Tribunal' });
    const mal = await responder({ usuario: 'tribunal.soft', contrasena: 'x' });
    expect(mal.estado).toBe(401);
    expect(mal.cuerpo.token).toBeUndefined();
  });
});

describe('guardia con usuarios de demostración', () => {
  const anterior = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = anterior; });
  const contexto = (identidad: IdentidadApi | undefined) => ({
    getHandler: () => undefined, getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ identidadApi: identidad, method: 'GET' }) }),
  }) as never;
  const guardia = (capacidades: string[]) => new GuardiaCapacidades({
    getAllAndOverride: (clave: string) => (clave.includes('PUBLICA') || clave.includes('publica') ? undefined : capacidades),
  } as unknown as Reflector);

  it('permite lo que su rol tiene y rechaza lo demás', () => {
    process.env.NODE_ENV = 'development';
    const secretaria = identidadDeUsuarioDemo(usuario('secretaria'));
    expect(guardia(['documentos:emitir']).canActivate(contexto(secretaria))).toBe(true);
    expect(() => guardia(['rubricas:administrar']).canActivate(contexto(secretaria))).toThrow(ForbiddenException);
  });

  it('fuera de desarrollo no acepta usuarios de demostración', () => {
    process.env.NODE_ENV = 'production';
    expect(() => guardia(['trabajos:leer']).canActivate(contexto(identidadDeUsuarioDemo(usuario('presidencia'))))).toThrow(UnauthorizedException);
  });
});
