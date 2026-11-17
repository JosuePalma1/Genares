import { describe, expect, it } from 'vitest';
import { NAVEGACION } from '../presentation/layouts/EstructuraAplicacion';
import { filtrarNavegacionPorRol, RUTAS_POR_ROL, rutaInicialPorRol } from './navegacionDemo';

const rutas = (grupos) => grupos.flatMap((g) => g.elementos.flatMap((e) => (e.hijos ? e.hijos.map((h) => h.to) : [e.to])));

describe('menú por rol en la demostración (Paso 2, A.4)', () => {
  it('sin rol no cambia el menú', () => {
    expect(filtrarNavegacionPorRol(NAVEGACION, null)).toBe(NAVEGACION);
  });

  it('el tribunal no ve rúbricas, seguimiento ni documentos', () => {
    const visibles = rutas(filtrarNavegacionPorRol(NAVEGACION, 'TRIBUNAL'));
    expect(visibles).toEqual(expect.arrayContaining(['/dashboard', '/trabajos', '/cronograma', '/mis-evaluaciones', '/consulta']));
    for (const oculta of ['/rubricas', '/coordinacion', '/secretaria', '/documentos', '/auditoria']) expect(visibles).not.toContain(oculta);
  });

  it('secretaría no ve rúbricas, cronograma ni Mis evaluaciones', () => {
    const visibles = rutas(filtrarNavegacionPorRol(NAVEGACION, 'SECRETARIA'));
    for (const oculta of ['/rubricas', '/cronograma', '/mis-evaluaciones']) expect(visibles).not.toContain(oculta);
    expect(visibles).toContain('/documentos');
  });

  it('cada ruta de los roles existe en el menú y cada rol empieza en una pantalla que puede usar', () => {
    const todas = rutas(NAVEGACION);
    for (const [rol, lista] of Object.entries(RUTAS_POR_ROL)) {
      for (const ruta of lista) expect(todas).toContain(ruta);
      expect(lista).toContain(rutaInicialPorRol(rol));
    }
    expect(rutaInicialPorRol('ADMINISTRACION')).toBe('/maestros/modalidades');
    expect(rutaInicialPorRol(undefined)).toBe('/dashboard');
  });
});
