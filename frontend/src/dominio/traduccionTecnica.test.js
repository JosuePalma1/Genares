import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InsigniaEstado } from '../componentes/interfaz';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

describe('contratos técnicos después de la traducción', () => {
  it('conserva colores diferentes para los estados de evaluación', () => {
    expect(InsigniaEstado({ estado: 'CERRADA' }).props.className).toContain('badge-success');
    expect(InsigniaEstado({ estado: 'BORRADOR' }).props.className).toContain('badge-progress');
    expect(InsigniaEstado({ estado: 'PENDIENTE' }).props.className).toContain('badge-pending');
    expect(InsigniaEstado({ estado: 'Personalizado', tono: 'info' }).props.className).toContain('badge-info');
  });

  it('actualiza el campo nombre de las categorías de rúbrica', () => {
    const pagina = leer('../componentes/EditorEstructuraRubrica.jsx');

    expect(pagina).toContain('{ nombre: e.target.value }');
    expect(pagina).not.toContain('{ ...categoria, name }');
  });

  it('mantiene alineadas las clases principales entre JSX y CSS', () => {
    const estilos = `${leer('../../css/styles.css')}\n${leer('../../css/responsive.css')}\n${leer('../estilos/aplicacion.css')}`;
    const clases = [
      'movil-nav',
      'app-movil-nav',
      'evaluacion-board',
      'evaluacion-summary',
      'summary-calificacion',
      'calificacion-breakdown',
      'evaluacion-card',
      'etapa-marca',
      'evaluacion-meta',
      'result-miembros',
      'result-miembro',
      'tribunal-estado-banner',
      'tribunal-estado-heading',
      'tribunal-estado-note',
      'notificacion-panel',
      'rubrica-formulario',
    ];

    clases.forEach((clase) => expect(estilos).toContain(`.${clase}`));
  });

  it('conserva el nombre técnico isActive entregado por React Router', () => {
    const estructura = leer('../estructuras/EstructuraAplicacion.jsx');

    expect(estructura).toContain('({ isActive })');
    expect(estructura).not.toContain('({ estaActivo })');
  });

  it('mantiene la evaluación en rutas académicas abiertas y delega la selección al tribunal del trabajo', () => {
    const rutas = leer('../Aplicacion.jsx');
    const detalle = leer('../paginas/PaginaDetalleTrabajo.jsx');
    const evaluaciones = leer('../paginas/PaginaMisEvaluaciones.jsx');

    expect(rutas).toContain('path="/evaluaciones/:idTrabajo/escrita" element={<PaginaEvaluacionEscrita />}');
    expect(rutas).toContain('path="/evaluaciones/:idTrabajo/escrita" element={<PaginaEvaluacionEscrita />}');
    expect(detalle).not.toContain('personaActual');
    expect(evaluaciones).not.toContain('actorActual');
    expect(evaluaciones).not.toContain('ROL.TRIBUNAL');
  });

  it('evita ocultar el estado global al calcular el estado de cada trabajo', () => {
    const paginasSeguimiento = [
      leer('../paginas/PaginaSecretaria.jsx'),
      leer('../paginas/PaginaCoordinacion.jsx'),
    ];

    paginasSeguimiento.forEach((pagina) => {
      expect(pagina).not.toContain('const estado = derivarEstadoTrabajo(estado, trabajo)');
      expect(pagina).toContain('const estadoTrabajo = derivarEstadoTrabajo(estado, trabajo)');
    });
  });
});
