import { describe, expect, it } from 'vitest';
import {
  esRutaInternaGenares,
  obtenerRutaAnteriorInterna,
  puedeAccederRutaInterna,
  registrarRutaInterna,
  resolverNavegacionRetorno,
} from './navegacionRetorno';

function crearAlmacenamiento() {
  const valores = new Map();
  return {
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => valores.set(clave, valor),
  };
}

describe('navegacion de retorno', () => {
  it('rechaza destinos externos, login y rutas sin formato interno', () => {
    expect(esRutaInternaGenares('/trabajos/trabajo-184')).toBe(true);
    expect(esRutaInternaGenares('/login')).toBe(false);
    expect(esRutaInternaGenares('https://example.com')).toBe(false);
    expect(esRutaInternaGenares('//example.com')).toBe(false);
  });

  it('permite el retorno a cualquier módulo interno existente sin depender de perfiles', () => {
    expect(puedeAccederRutaInterna('/rubricas')).toBe(true);
    expect(puedeAccederRutaInterna('/secretaria')).toBe(true);
    expect(puedeAccederRutaInterna('/trabajos/trabajo-184/tribunal')).toBe(true);
  });

  it('prefiere el historial interno y usa respaldo seguro cuando no es valido', () => {
    expect(resolverNavegacionRetorno({
      rutaAnterior: '/trabajos?estado=pendiente', rutaRespaldo: '/dashboard', roles: ['TRIBUNAL'],
    })).toEqual({ destino: '/trabajos?estado=pendiente', usarHistorial: true });
    expect(resolverNavegacionRetorno({
      rutaAnterior: '/login', rutaRespaldo: '/mis-evaluaciones', roles: ['TRIBUNAL'],
    })).toEqual({ destino: '/mis-evaluaciones', usarHistorial: false });
  });

  it('registra las rutas por indice para permitir retornos sucesivos y recargas', () => {
    const almacenamiento = crearAlmacenamiento();
    registrarRutaInterna(0, '/trabajos?consulta=tesis', almacenamiento);
    registrarRutaInterna(1, '/trabajos/trabajo-184', almacenamiento);
    registrarRutaInterna(2, '/evaluaciones/trabajo-184/escrita', almacenamiento);
    expect(obtenerRutaAnteriorInterna(2, almacenamiento)).toBe('/trabajos/trabajo-184');
    expect(obtenerRutaAnteriorInterna(1, almacenamiento)).toBe('/trabajos?consulta=tesis');
    expect(obtenerRutaAnteriorInterna(0, almacenamiento)).toBeNull();
  });
});
