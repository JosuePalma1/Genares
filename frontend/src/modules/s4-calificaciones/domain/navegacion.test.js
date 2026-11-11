import { describe, expect, it } from 'vitest';
import { ESTADO_PERMISO, EXIGENCIA, estadoPermisoDesdeResultado, filtrarNavegacion, rutaActiva } from './navegacion';

const { PERMITIDO, DENEGADO, DESCONOCIDO, CONSULTANDO } = ESTADO_PERMISO;

const grupos = [
  {
    etiqueta: 'A',
    elementos: [
      { to: '/libre', etiqueta: 'Libre' },
      { to: '/lectura', etiqueta: 'Lectura', permiso: 'lectura' },
      { to: '/auditoria', etiqueta: 'Auditoría', permiso: 'auditoria', exigencia: EXIGENCIA.AUTORIZACION },
    ],
  },
  {
    etiqueta: 'B',
    elementos: [{
      clave: 'padre', etiqueta: 'Padre',
      hijos: [
        { to: '/hijo', etiqueta: 'Hijo', permiso: 'hijo' },
        { clave: 'pendiente', etiqueta: 'Pendiente', pendiente: true },
      ],
    }],
  },
];

const etiquetas = (resultado) => resultado.flatMap((grupo) => grupo.elementos
  .flatMap((elemento) => [elemento.etiqueta, ...(elemento.hijos ?? []).map((hijo) => hijo.etiqueta)]));

describe('visibilidad del menú', () => {
  it('muestra las opciones de lectura mientras se consulta o si falla la red', () => {
    for (const estado of [CONSULTANDO, DESCONOCIDO, PERMITIDO]) {
      expect(etiquetas(filtrarNavegacion(grupos, { lectura: estado, hijo: estado }))).toContain('Lectura');
    }
  });

  it('oculta una opción de lectura cuando el servidor la niega', () => {
    expect(etiquetas(filtrarNavegacion(grupos, { lectura: DENEGADO }))).not.toContain('Lectura');
  });

  it('muestra Auditoría solo cuando el servidor confirma la autorización', () => {
    for (const estado of [CONSULTANDO, DESCONOCIDO, DENEGADO]) {
      expect(etiquetas(filtrarNavegacion(grupos, { auditoria: estado }))).not.toContain('Auditoría');
    }
    expect(etiquetas(filtrarNavegacion(grupos, { auditoria: PERMITIDO }))).toContain('Auditoría');
  });

  it('oculta la opción padre si solo le quedan subopciones pendientes', () => {
    const resultado = filtrarNavegacion(grupos, { hijo: DENEGADO });
    expect(etiquetas(resultado)).not.toContain('Padre');
    expect(resultado.map((grupo) => grupo.etiqueta)).toEqual(['A']);
  });

  it('conserva las subopciones pendientes junto a una navegable', () => {
    expect(etiquetas(filtrarNavegacion(grupos, { hijo: PERMITIDO }))).toEqual(expect.arrayContaining(['Padre', 'Hijo', 'Pendiente']));
  });
});

describe('estado del permiso', () => {
  it('distingue permiso concedido, negado y desconocido', () => {
    expect(estadoPermisoDesdeResultado({ status: 'fulfilled', value: {} })).toBe(PERMITIDO);
    expect(estadoPermisoDesdeResultado({ status: 'rejected', reason: { status: 403 } })).toBe(DENEGADO);
    expect(estadoPermisoDesdeResultado({ status: 'rejected', reason: { status: 401 } })).toBe(DENEGADO);
    expect(estadoPermisoDesdeResultado({ status: 'rejected', reason: { status: 500 } })).toBe(DESCONOCIDO);
    expect(estadoPermisoDesdeResultado({ status: 'rejected', reason: new TypeError('red') })).toBe(DESCONOCIDO);
  });
});

describe('ruta activa', () => {
  it('marca subrutas y rutas declaradas, y respeta la coincidencia exacta', () => {
    expect(rutaActiva({ to: '/rubricas' }, '/rubricas/nueva')).toBe(true);
    expect(rutaActiva({ to: '/rubricas' }, '/rubricas-otro')).toBe(false);
    expect(rutaActiva({ to: '/consulta', activaEn: ['/resultados'] }, '/resultados/t/e')).toBe(true);
    expect(rutaActiva({ to: '/dashboard', end: true }, '/dashboard/x')).toBe(false);
  });
});
