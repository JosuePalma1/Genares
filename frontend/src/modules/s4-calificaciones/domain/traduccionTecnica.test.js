import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InsigniaEstado } from '../presentation/components/interfaz';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

describe('contratos técnicos después de la traducción', () => {
  it('conserva colores diferentes para los estados de evaluación', () => {
    expect(InsigniaEstado({ estado: 'CERRADA' }).props.className).toContain('badge-success');
    expect(InsigniaEstado({ estado: 'BORRADOR' }).props.className).toContain('badge-progress');
    expect(InsigniaEstado({ estado: 'PENDIENTE' }).props.className).toContain('badge-pending');
    expect(InsigniaEstado({ estado: 'Personalizado', tono: 'info' }).props.className).toContain('badge-info');
  });

  it('actualiza el campo nombre de las categorías de rúbrica', () => {
    const pagina = leer('../presentation/components/EditorEstructuraRubrica.jsx');

    expect(pagina).toContain('{ nombre: e.target.value }');
    expect(pagina).not.toContain('{ ...categoria, name }');
  });

  it('mantiene alineadas las clases principales entre JSX y CSS', () => {
    const estilos = `${leer('../../../shared/presentation/styles/styles.css')}\n${leer('../../../shared/presentation/styles/responsive.css')}\n${leer('../../../shared/presentation/styles/aplicacion.css')}`;
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
    const estructura = leer('../presentation/layouts/EstructuraAplicacion.jsx');

    expect(estructura).toContain('({ isActive })');
    expect(estructura).not.toContain('({ estaActivo })');
  });

  it('mantiene la evaluación en rutas académicas abiertas y delega la selección al tribunal del trabajo', () => {
    const rutas = leer('../routes.jsx');
    const detalle = leer('../presentation/pages/PaginaTrabajosApi.jsx');
    const evaluaciones = leer('../presentation/pages/PaginaMisEvaluaciones.jsx');

    expect(rutas).toContain('path="/trabajos" element={<PaginaTrabajosApi />}');
    expect(rutas).toContain('path="/rubricas" element={<PaginaRubricas />}');
    expect(rutas).toContain('path="/trabajos/:idTrabajo/sustentacion" element={<RedirigirProgramacionLegacy />}');
    expect(rutas).not.toContain('PaginaProgramacionSustentacion');
    expect(rutas).not.toContain('PaginaTrabajosIntegradosDev');
    expect(rutas).not.toContain('PaginaRubricasIntegradasDev');
    expect(rutas).toContain('path="/evaluaciones/:asignacionId/escrita"');
    expect(rutas).toContain('path="/evaluaciones/:asignacionId/oral/:idEstudiante"');
    expect(detalle).not.toContain('personaActual');
    expect(evaluaciones).not.toContain('actorActual');
    expect(evaluaciones).not.toContain('ROL.TRIBUNAL');
  });

  it('evita ocultar el estado global al calcular el estado de cada trabajo', () => {
    const paginasSeguimiento = [
      leer('../presentation/pages/PaginaSecretaria.jsx'),
      leer('../presentation/pages/PaginaCoordinacion.jsx'),
    ];

    paginasSeguimiento.forEach((pagina) => {
      expect(pagina).not.toContain('const estado = derivarEstadoTrabajo(estado, trabajo)');
      expect(pagina).toContain('const estadoTrabajo = derivarEstadoTrabajo(estado, trabajo)');
    });
  });
});
