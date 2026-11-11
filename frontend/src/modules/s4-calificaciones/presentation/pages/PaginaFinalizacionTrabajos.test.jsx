import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TarjetaFinalizacion } from './PaginaFinalizacionTrabajos';
import { crearServicioFinalizacionApi } from '../services/finalizacionApi';

const trabajo = { id: 't1', titulo: 'Tema de prueba', carrera: 'Software', codigoCarrera: 'SOFT', periodo: '2026-2', estado: 'REGISTRADO' };
const listo = { trabajo, finalizado: false, puedeFinalizar: true, pendientesTrabajo: [],
  estudiantes: [{ idEstudiante: 'e1', nombre: 'Ana Pérez', cumplida: true, pendientes: [] }] };
const bloqueado = { ...listo, puedeFinalizar: false,
  estudiantes: [{ idEstudiante: 'e1', nombre: 'Ana Pérez', cumplida: false, pendientes: ['Falta el acta de calificación archivada.'] }] };

const renderizar = (elemento, puedeFinalizarIdentidad = true) => renderToStaticMarkup(
  <MemoryRouter><TarjetaFinalizacion elemento={elemento} puedeFinalizarIdentidad={puedeFinalizarIdentidad} ocupado={false} alFinalizar={() => {}} /></MemoryRouter>,
);

describe('Finalización del trabajo (SE-03)', () => {
  it('habilita Finalizar solo cuando el servidor confirma todas las condiciones', () => {
    expect(renderizar(listo)).toMatch(/<button class="button button-primary" type="button">.*Finalizar trabajo/);
    const html = renderizar(bloqueado);
    expect(html).toMatch(/<button class="button button-primary" type="button" disabled=""/);
    expect(html).toContain('Falta el acta de calificación archivada.');
  });

  it('no ofrece la acción sin el permiso de cierre ni en un trabajo finalizado', () => {
    expect(renderizar(listo, false)).not.toContain('Finalizar trabajo');
    const finalizado = { ...listo, finalizado: true, puedeFinalizar: false, trabajo: { ...trabajo, estado: 'FINALIZADO' } };
    const html = renderizar(finalizado);
    expect(html).not.toContain('Finalizar trabajo');
    expect(html).toContain('Finalizado');
  });
});

describe('servicio de finalización', () => {
  it('valida la respuesta y envía la finalización al trabajo indicado', async () => {
    const cliente = { getJson: vi.fn().mockResolvedValue({ elementos: [listo], puedeFinalizar: true }), postJson: vi.fn().mockResolvedValue(listo) };
    const servicio = crearServicioFinalizacionApi(cliente);
    await expect(servicio.listar()).resolves.toEqual({ elementos: [listo], puedeFinalizar: true });
    await servicio.finalizar('t1');
    expect(cliente.postJson).toHaveBeenCalledWith('/finalizacion-trabajos/t1', {}, undefined);
  });

  it('rechaza respuestas con forma inesperada', async () => {
    const cliente = { getJson: vi.fn().mockResolvedValue({ elementos: [{ trabajo }], puedeFinalizar: true }) };
    await expect(crearServicioFinalizacionApi(cliente).listar()).rejects.toThrow();
  });
});
