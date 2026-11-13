import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ESTADO_PERMISO } from '../../domain/navegacion';
import { IndicadorBorradores, NAVEGACION, Navegacion } from './EstructuraAplicacion';
import { avisoColaBorradores } from '../hooks/usarSincronizacionBorradores';

const { PERMITIDO, DENEGADO, CONSULTANDO } = ESTADO_PERMISO;
const TODOS = { rubricas: PERMITIDO, modalidades: PERMITIDO, carreras: PERMITIDO, programaciones: PERMITIDO, auditoria: PERMITIDO, correcciones: PERMITIDO };

function renderizar(props = {}, ruta = '/dashboard') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[ruta]}><Navegacion permisos={TODOS} rutaActual={ruta} {...props} /></MemoryRouter>,
  );
}

const OPCIONES_ANEXO_A = ['Inicio', 'Trabajos de titulación', 'Cronograma', 'Mis evaluaciones', 'Rúbricas',
  'Seguimiento', 'Resultados', 'Documentos', 'Auditoría'];

describe('barra lateral de Genares', () => {
  it('incluye las nueve opciones de la matriz de navegación en su orden', () => {
    const principales = NAVEGACION.flatMap((grupo) => grupo.elementos.map((elemento) => elemento.etiqueta));
    expect(principales).toEqual(OPCIONES_ANEXO_A);
    const html = renderizar();
    for (const opcion of OPCIONES_ANEXO_A) expect(html).toContain(`<span>${opcion}</span>`);
  });

  it('cada enlace apunta a una ruta declarada en routes.jsx', () => {
    const rutas = readFileSync(fileURLToPath(new URL('../../routes.jsx', import.meta.url)), 'utf8');
    const enlaces = NAVEGACION.flatMap((grupo) => grupo.elementos.flatMap((elemento) => [elemento, ...(elemento.hijos ?? [])]))
      .filter((elemento) => elemento.to);
    expect(enlaces.length).toBeGreaterThan(0);
    for (const { to } of enlaces) expect(rutas).toContain(`path="${to}"`);
  });

  it('agrupa modalidades y versiones dentro de Rúbricas, y Coordinación y Secretaría dentro de Seguimiento', () => {
    const hijos = (clave) => NAVEGACION.flatMap((grupo) => grupo.elementos)
      .find((elemento) => elemento.clave === clave).hijos.map((hijo) => hijo.etiqueta);
    expect(hijos('rubricas')).toEqual(['Rúbricas y versiones', 'Modalidades', 'Carreras (consulta)']);
    expect(hijos('seguimiento')).toEqual(['Coordinación', 'Secretaría', 'Finalización del trabajo']);
  });

  it('ya no quedan opciones pendientes: todas las vistas del menú tienen pantalla', () => {
    const html = renderizar();
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).toContain('href="/auditoria/correcciones"');
  });

  it('enlaza la finalización del trabajo (SE-03) dentro de Seguimiento', () => {
    const html = renderizar({}, '/seguimiento/finalizacion');
    expect(html).toMatch(/class="nav-subitem active"[^>]*href="\/seguimiento\/finalizacion"/);
    expect(html).toMatch(/class="nav-parent contiene-activa">(?:(?!<\/p>).)*<span>Seguimiento<\/span>/);
  });

  it('oculta Auditoría hasta que el servidor confirma alguna de sus autorizaciones', () => {
    expect(renderizar({ permisos: { ...TODOS, auditoria: CONSULTANDO, correcciones: CONSULTANDO } })).not.toContain('Auditoría');
    expect(renderizar({ permisos: { ...TODOS, auditoria: DENEGADO, correcciones: DENEGADO } })).not.toContain('Auditoría');
    expect(renderizar()).toContain('href="/auditoria"');
  });

  it('separa la bitácora de las correcciones: cada subopción exige su propio permiso', () => {
    const soloCorrecciones = renderizar({ permisos: { ...TODOS, auditoria: DENEGADO } });
    expect(soloCorrecciones).toContain('href="/auditoria/correcciones"');
    expect(soloCorrecciones).not.toContain('href="/auditoria"');
    const soloBitacora = renderizar({ permisos: { ...TODOS, correcciones: DENEGADO } });
    expect(soloBitacora).toContain('href="/auditoria"');
    expect(soloBitacora).not.toContain('href="/auditoria/correcciones"');
  });

  it('dentro de las correcciones solo marca activa su subopción, no la bitácora', () => {
    const html = renderizar({}, '/auditoria/correcciones/nueva');
    expect(html).toMatch(/class="nav-subitem active"[^>]*href="\/auditoria\/correcciones"/);
    expect(html).not.toMatch(/class="nav-subitem active"[^>]*href="\/auditoria"/);
  });

  it('oculta las operaciones administrativas que el servidor niega a un docente del tribunal', () => {
    const html = renderizar({ permisos: { rubricas: DENEGADO, modalidades: DENEGADO, carreras: DENEGADO, programaciones: PERMITIDO, auditoria: DENEGADO, correcciones: DENEGADO } });
    expect(html).not.toContain('<span>Rúbricas</span>');
    expect(html).not.toContain('href="/maestros/modalidades"');
    expect(html).toContain('href="/mis-evaluaciones"');
    expect(html).toContain('href="/cronograma"');
  });

  it('marca como activa la subopción de la ruta actual y su opción principal', () => {
    const html = renderizar({}, '/maestros/modalidades/123');
    expect(html).toMatch(/class="nav-parent contiene-activa">(?:(?!<\/p>).)*<span>Rúbricas<\/span>/);
    expect(html).not.toMatch(/class="nav-parent contiene-activa">(?:(?!<\/p>).)*<span>Seguimiento<\/span>/);
    expect(html).toMatch(/class="nav-subitem active"[^>]*href="\/maestros\/modalidades"/);
    expect(renderizar({}, '/resultados/t/e')).toMatch(/class="active"[^>]*href="\/consulta"/);
  });

  it('distingue los accesos simulados de la identidad local de desarrollo', () => {
    expect(renderizar({ identidadLocal: true })).toContain('Accesos simulados');
    expect(renderizar({ identidadLocal: false })).not.toContain('Accesos simulados');
  });
});

describe('indicador de borradores sin sincronizar (RF-31/RF-32)', () => {
  it('muestra la cola del dispositivo y queda vacío cuando no hay nada pendiente', () => {
    const conPendientes = renderToStaticMarkup(<IndicadorBorradores aviso={avisoColaBorradores({ pendientes: 3, conflictos: 0, sincronizando: false })} />);
    expect(conPendientes).toContain('role="status"');
    expect(conPendientes).toContain('3 sin sincronizar');
    expect(conPendientes).toContain('Se enviarán al servidor cuando haya conexión');
    expect(renderToStaticMarkup(<IndicadorBorradores aviso={null} />)).not.toContain('cola-borradores-chip');
  });
});
