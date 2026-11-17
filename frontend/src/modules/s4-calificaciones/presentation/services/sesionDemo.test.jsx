import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { borrarSesionDemo, cabeceraSesionDemo, guardarSesionDemo, leerSesionDemo } from './sesionDemo';
import { crearClienteHttp } from './clienteHttp';
import { ListaUsuariosDemo } from '../pages/PaginaEntrar';

function almacen() {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, String(v)), removeItem: (k) => datos.delete(k) };
}

const sesion = { token: 'abc.def', usuario: { usuario: 'tribunal.ti', nombre: 'María Docente TI A', rol: 'TRIBUNAL', nombreRol: 'Tribunal' } };

describe('sesión de demostración por roles', () => {
  it('se guarda, se lee y se borra; sin sesión no añade cabecera', () => {
    const disco = almacen();
    expect(cabeceraSesionDemo(disco)).toEqual({});
    guardarSesionDemo(sesion, disco);
    expect(leerSesionDemo(disco)).toEqual(sesion);
    expect(cabeceraSesionDemo(disco)).toEqual({ Authorization: 'Bearer abc.def' });
    borrarSesionDemo(disco);
    expect(leerSesionDemo(disco)).toBeNull();
  });

  it('ignora una sesión corrupta', () => {
    const disco = almacen();
    disco.setItem('genares:demo:sesion:v1', '{"token":1}');
    expect(leerSesionDemo(disco)).toBeNull();
  });

  it('el cliente HTTP envía la sesión guardada en cada petición', async () => {
    vi.stubGlobal('localStorage', almacen());
    guardarSesionDemo(sesion);
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    await crearClienteHttp({ habilitado: true, fetcher }).getJson('/trabajos');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer abc.def');
    borrarSesionDemo();
    vi.unstubAllGlobals();
  });

  it('la entrada lista los usuarios con su rol y lo que ven', () => {
    const html = renderToStaticMarkup(<ListaUsuariosDemo alElegir={() => {}} usuarios={[
      { usuario: 'tribunal.ti', nombre: 'María', rol: 'TRIBUNAL', nombreRol: 'Tribunal', carreras: null },
      { usuario: 'coordinacion.ti', nombre: 'Coordinación TI', rol: 'COORDINACION', nombreRol: 'Coordinación', carreras: ['DEV-TI'] },
      { usuario: 'admin.tecnico', nombre: 'Administración', rol: 'ADMINISTRACION', nombreRol: 'Administración técnica', carreras: [] },
    ]} />);
    expect(html).toContain('tribunal.ti');
    expect(html).toContain('Sus trabajos');
    expect(html).toContain('<td>TI</td>');
    expect(html).toContain('Ninguna');
  });
});
