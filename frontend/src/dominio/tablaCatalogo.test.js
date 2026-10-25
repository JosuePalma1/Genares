import { describe, expect, it } from 'vitest';
import { filtrarCatalogo, ordenarCatalogo } from './tablaCatalogo';

const registros = [
  { id: '1', codigo: 'ING', nombre: 'Ingeniería Ambiental', estaActivo: true },
  { id: '2', codigo: 'ARQ', nombre: 'Arquitectura', estaActivo: false },
  { id: '3', codigo: 'ING-2', nombre: 'Ingeniería Civil', estaActivo: true },
];

describe('datos de tabla de catálogos', () => {
  it('busca por código o nombre sin distinguir mayúsculas ni tildes', () => {
    expect(filtrarCatalogo(registros, { busqueda: 'ambiental' }).map(({ id }) => id)).toEqual(['1']);
    expect(filtrarCatalogo(registros, { busqueda: 'ING' }).map(({ id }) => id)).toEqual(['1', '3']);
    expect(filtrarCatalogo(registros, { busqueda: 'ingenieria civil' }).map(({ id }) => id)).toEqual(['3']);
  });

  it('filtra registros activos e inactivos y combina búsqueda con estado', () => {
    expect(filtrarCatalogo(registros, { estado: 'ACTIVAS' }).map(({ id }) => id)).toEqual(['1', '3']);
    expect(filtrarCatalogo(registros, { estado: 'INACTIVAS' }).map(({ id }) => id)).toEqual(['2']);
    expect(filtrarCatalogo(registros, { busqueda: 'ingeniería', estado: 'INACTIVAS' })).toEqual([]);
  });

  it('ordena ascendente y descendente sin mutar el listado recibido', () => {
    const ascendente = ordenarCatalogo(registros, 'nombre', 'asc');
    expect(ascendente.map(({ codigo }) => codigo)).toEqual(['ARQ', 'ING', 'ING-2']);
    expect(ordenarCatalogo(registros, 'codigo', 'desc').map(({ codigo }) => codigo)).toEqual(['ING-2', 'ING', 'ARQ']);
    expect(registros.map(({ codigo }) => codigo)).toEqual(['ING', 'ARQ', 'ING-2']);
  });

  it('ordena estados booleanos de forma estable y accesible', () => {
    expect(ordenarCatalogo(registros, 'estaActivo', 'asc').map(({ estaActivo }) => estaActivo))
      .toEqual([false, true, true]);
    expect(ordenarCatalogo(registros, 'estaActivo', 'desc').map(({ estaActivo }) => estaActivo))
      .toEqual([true, true, false]);
  });
});
