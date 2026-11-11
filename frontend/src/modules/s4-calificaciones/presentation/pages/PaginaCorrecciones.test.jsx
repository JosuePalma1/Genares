import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TablaCambios, TarjetaSolicitud } from './PaginaCorrecciones';
import { erroresSolicitud } from './PaginaSolicitarCorreccion';
import { crearServicioCorreccionesApi } from '../services/correccionesApi';

const solicitud = {
  id: 's1', estado: 'PENDIENTE', motivo: 'Error de transcripción', trabajo: 'Tema', etapa: 'Escrita',
  estudiante: null, evaluador: 'Docente A', solicitadoPor: 'docente', solicitadoEn: '2026-11-10T10:00:00Z',
  resueltoPor: null, resueltoEn: null, comentarioResolucion: null,
  puntajesAnteriores: [{ idIndicador: 'i1', score: '0.33' }, { idIndicador: 'i2', score: '0.20' }],
  puntajesPropuestos: [{ idIndicador: 'i1', score: '0.33', observation: null }, { idIndicador: 'i2', score: '0.34', observation: 'Corregido' }],
  totalAnterior: '0.53', totalPropuesto: '0.67',
};
const renderizar = (props) => renderToStaticMarkup(<MemoryRouter><TarjetaSolicitud solicitud={solicitud} puedeAutorizar
  ocupado={false} alAprobar={() => {}} alRechazar={() => {}} alVerJustificativo={() => {}} {...props} /></MemoryRouter>);

describe('solicitudes de corrección (AU-03)', () => {
  it('solo quien autoriza ve Aprobar y Rechazar, y solo en solicitudes pendientes', () => {
    expect(renderizar()).toContain('Aprobar y aplicar');
    expect(renderizar({ puedeAutorizar: false })).not.toContain('Aprobar y aplicar');
    expect(renderizar({ solicitud: { ...solicitud, estado: 'APLICADA', resueltoPor: 'coordinacion', resueltoEn: '2026-11-11T10:00:00Z' } }))
      .not.toContain('Rechazar');
    expect(renderizar({ puedeAutorizar: false })).toContain('Ver PDF justificativo');
  });

  it('muestra la nota anterior y la corregida, y resalta solo los indicadores que cambian', () => {
    const html = renderToStaticMarkup(<TablaCambios solicitud={solicitud} />);
    expect(html.match(/<tr class="cambia">/g)).toHaveLength(1);
    expect(html).toContain('0.20');
    expect(html).toContain('<strong>0.34</strong>');
    expect(html).toContain('<strong>0.67</strong>');
  });
});

describe('formulario de solicitud (AU-02)', () => {
  const base = { motivo: 'Error de transcripción en el acta', archivo: { type: 'application/pdf', size: 1000 },
    puntajes: [{ indicador: '1', score: '0.20', observation: null, calificacionMaxima: '0.34', nuevo: '0.30', observacionNueva: '' }] };

  it('acepta una solicitud completa', () => {
    expect(erroresSolicitud(base)).toEqual([]);
  });

  it('exige motivo, PDF, notas dentro del máximo y algún cambio', () => {
    expect(erroresSolicitud({ ...base, motivo: 'corto' })).toContain('El motivo debe tener al menos 10 caracteres.');
    expect(erroresSolicitud({ ...base, archivo: null })).toContain('Adjunte el PDF justificativo.');
    expect(erroresSolicitud({ ...base, archivo: { type: 'image/png', size: 10 } })).toContain('El justificativo debe ser un archivo PDF.');
    expect(erroresSolicitud({ ...base, puntajes: [{ ...base.puntajes[0], nuevo: '0.5' }] })[0]).toMatch(/entre 0 y 0.34/);
    expect(erroresSolicitud({ ...base, puntajes: [{ ...base.puntajes[0], nuevo: '0.20' }] }))
      .toContain('La corrección no modifica ninguna nota ni observación.');
  });
});

describe('servicio de correcciones', () => {
  it('envía la solicitud como formulario con archivo, sin fijar el Content-Type', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => solicitud });
    const servicio = crearServicioCorreccionesApi({ clienteJson: {}, fetcher });
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    await servicio.solicitar({ idEvaluacion: 'e1', motivo: 'Motivo suficiente', revisionEsperada: 3, puntajes: [{ idIndicador: 'i1', score: 0.3 }], justificativo: pdf });
    const [, opciones] = fetcher.mock.calls[0];
    expect(opciones.method).toBe('POST');
    expect(opciones.headers['Content-Type']).toBeUndefined();
    expect(opciones.headers['X-Genares-Write-Intent']).toBe('local-development');
    expect(opciones.body.get('revisionEsperada')).toBe('3');
    expect(JSON.parse(opciones.body.get('puntajes'))).toEqual([{ idIndicador: 'i1', score: 0.3 }]);
    expect(opciones.body.get('justificativo')).toBeInstanceOf(Blob);
  });

  it('propaga el rechazo del servidor con su estado HTTP', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ message: 'conflicto' }) });
    const servicio = crearServicioCorreccionesApi({ clienteJson: {}, fetcher });
    await expect(servicio.solicitar({ idEvaluacion: 'e1', motivo: 'Motivo suficiente', revisionEsperada: 1, puntajes: [], justificativo: new Blob() }))
      .rejects.toMatchObject({ status: 409 });
  });

  it('valida la forma de las respuestas de consulta', async () => {
    const servicio = crearServicioCorreccionesApi({ clienteJson: { getJson: vi.fn().mockResolvedValue([{ id: 's1' }]) } });
    await expect(servicio.listar('PENDIENTE')).rejects.toThrow();
  });
});
