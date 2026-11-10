import { describe, expect, it } from 'vitest';
import { destinoDocumentosRubrica, rutaPdfRubrica } from './documentosRubrica';

describe('rutas de rúbricas documentales', () => {
  it('dirige el flujo al selector común de Documentos con los tres IDs explícitos', () => {
    expect(destinoDocumentosRubrica('trabajo-1', 'estudiante-2', 'miembro-3'))
      .toBe('/documentos?trabajoId=trabajo-1&estudianteId=estudiante-2&miembroId=miembro-3');
  });

  it('conserva la impresión automática solicitada por los enlaces académicos', () => {
    expect(destinoDocumentosRubrica('t', 'e', 'm', true)).toBe('/documentos?trabajoId=t&estudianteId=e&miembroId=m&autoPrint=1');
  });

  it('construye el endpoint PDF único y codifica sus segmentos', () => {
    expect(rutaPdfRubrica('trabajo 1', 'estudiante/2', 'miembro 3'))
      .toBe('/trabajos/trabajo%201/estudiantes/estudiante%2F2/rubricas/miembro%203/pdf');
  });
});
