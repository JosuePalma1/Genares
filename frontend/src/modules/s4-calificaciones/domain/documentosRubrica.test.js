import { describe, expect, it } from 'vitest';
import { mensajeErrorDocumento, rutaPdfRubrica } from './documentosRubrica';

describe('rutas de rúbricas documentales', () => {
  it('construye el endpoint PDF único y codifica sus segmentos', () => {
    expect(rutaPdfRubrica('trabajo 1', 'estudiante/2', 'miembro 3'))
      .toBe('/trabajos/trabajo%201/estudiantes/estudiante%2F2/rubricas/miembro%203/pdf');
  });

  it('explica los fallos de la rúbrica según el código HTTP y conserva el resto', () => {
    const ruta = rutaPdfRubrica('t', 'e', 'm');
    expect(mensajeErrorDocumento({ status: 403 }, ruta)).toBe('Su perfil no tiene permiso para consultar esta rúbrica.');
    expect(mensajeErrorDocumento({ status: 409 }, ruta)).toBe('El trabajo no tiene una versión de rúbrica disponible para imprimir.');
    expect(mensajeErrorDocumento({ name: 'ErrorConexionApi' }, ruta)).toBe('No fue posible generar el documento. Intente de nuevo más tarde.');
    expect(mensajeErrorDocumento({ status: 500, message: 'Fallo del acta' }, '/actas/a/pdf')).toBe('Fallo del acta');
  });
});
