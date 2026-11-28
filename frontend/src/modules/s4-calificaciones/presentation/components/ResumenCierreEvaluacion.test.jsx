import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DetalleCierreOral } from './ResumenCierreEvaluacion';

const estudiante = { id: 'estudiante-a', nombre: 'Ana Pérez' };
const evaluador = { id: 'puesto-uno', nombre: 'Evaluador Uno' };
const otro = { id: 'puesto-dos', nombre: 'Evaluador Dos' };
const etapa = { id: 'oral', nombre: 'Sustentación', calificacionMaxima: '5.00' };
const datos = {
  evaluadoresTribunal: [evaluador, otro],
  evaluaciones: [
    { idEtapaRubrica: 'oral', idEstudiante: estudiante.id, idAsignacionTribunal: otro.id, estado: 'BORRADOR' },
    { idEtapaRubrica: 'oral', idEstudiante: 'estudiante-b', idAsignacionTribunal: otro.id, estado: 'CERRADA' },
  ],
  consolidados: [],
};

function render(cambios = {}) {
  return renderToStaticMarkup(<MemoryRouter><DetalleCierreOral
    asignacionId="trabajo"
    etapa={etapa}
    evaluador={evaluador}
    cierre={{ estudiante, total: '4.2500' }}
    datos={datos}
    {...cambios}
  /></MemoryRouter>);
}

describe('Resumen del cierre oral', () => {
  it('muestra la nota confirmada y el estado del otro miembro para ese estudiante', () => {
    const html = render();
    expect(html).toContain('4,25 / 5,00');
    expect(html).toContain('Ver rúbrica PDF');
    expect(html).toContain('Evaluador Dos');
    expect(html).toContain('Calificando');
    expect(html).toContain('Resultado consolidado pendiente');
    expect(html).not.toContain('Ver acta en Documentos');
  });

  it('ofrece el acta del estudiante cuando el servidor devuelve su resultado definitivo, incluso con nota cero', () => {
    const html = render({ datos: {
      ...datos,
      consolidados: [
        { idEstudiante: estudiante.id, estado: 'RESULTADO_COMPLETO', resultadoFinal: { calificacion: '0.00', calificacionMaxima: '20.00' } },
        { idEstudiante: 'estudiante-b', estado: 'RESULTADO_COMPLETO', resultadoFinal: { calificacion: '19.00', calificacionMaxima: '20.00' } },
      ],
    } });
    expect(html).toContain('0,00 / 20,00');
    expect(html).not.toContain('19,00');
    expect(html).toContain('/documentos?trabajoId=trabajo&amp;estudianteId=estudiante-a');
    expect(html).toContain('Ver acta en Documentos');
  });
});
