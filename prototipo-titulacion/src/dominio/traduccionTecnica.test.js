import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

describe('contratos técnicos después de la traducción', () => {
  it('actualiza el campo nombre de las categorías de rúbrica', () => {
    const pagina = leer('../paginas/PaginaDetalleRubrica.jsx');

    expect(pagina).toContain('{ ...categoria, nombre }');
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

    expect(estructura).toContain('isActive: estaActivo');
    expect(estructura).not.toContain('({ estaActivo })');
  });

  it('autoriza las evaluaciones por asignación de tribunal y no solo por rol global', () => {
    const rutas = leer('../Aplicacion.jsx');
    const detalle = leer('../paginas/PaginaDetalleTrabajo.jsx');
    const evaluaciones = leer('../paginas/PaginaMisEvaluaciones.jsx');

    expect(rutas).toContain('path="/evaluaciones/:idTrabajo/escrita" element={<PaginaEvaluacionEscrita />}');
    expect(detalle).toContain('const isAssignedMember = trabajo.idsTribunal.includes(personaActual?.id);');
    expect(evaluaciones).not.toContain('actorActual.roles.includes(ROL.TRIBUNAL)');
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
