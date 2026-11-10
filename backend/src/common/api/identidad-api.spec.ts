import { IdentidadApi, puedeConsultarDemostracion } from './identidad-api';

describe('lectura amplia del catálogo sintético local', () => {
  const entornoOriginal = process.env.NODE_ENV;
  afterEach(() => {
    if (entornoOriginal === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = entornoOriginal;
  });

  it('solo aplica a la identidad técnica local durante development', () => {
    process.env.NODE_ENV = 'development';
    const adminLocal: IdentidadApi = {
      sujeto: 'GENARES:LOCAL_DEVELOPMENT', tipo: 'DESARROLLO_LOCAL', capacidades: ['evaluaciones:leer-demostracion'],
    };
    expect(puedeConsultarDemostracion({ identidadApi: adminLocal })).toBe(true);
    expect(puedeConsultarDemostracion({ identidadApi: { ...adminLocal, tipo: 'VERIFICADA' } })).toBe(false);
    expect(puedeConsultarDemostracion({ identidadApi: { ...adminLocal, capacidades: ['evaluaciones:leer'] } })).toBe(false);
    process.env.NODE_ENV = 'test';
    expect(puedeConsultarDemostracion({ identidadApi: adminLocal })).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(puedeConsultarDemostracion({ identidadApi: adminLocal })).toBe(false);
  });
});
