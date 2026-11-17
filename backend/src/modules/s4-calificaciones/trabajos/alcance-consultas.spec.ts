import { CONSULTA_ACTAS_SEGUIMIENTO, CONSULTA_CONTEOS_SEGUIMIENTO } from '../seguimiento/seguimiento.service';
import { CONSULTA_PAGINA_FINALIZACION } from '../finalizacion/finalizacion.service';
import { CONSULTA_PROGRAMACIONES, CONSULTA_TRABAJOS_DISPONIBLES } from '../sustentaciones/programaciones-sustentacion.service';
import {
  CONSULTA_CATALOGOS_TRABAJOS_MER, CONSULTA_PAGINA_TRABAJOS_MER, CONSULTA_TRABAJOS_MER, FILTRO_TRABAJOS_MER,
} from './trabajos.service';

// RF-03 a RF-05 (demostración por roles): toda consulta de trabajos lleva el ámbito del usuario.
// Las marcas valen NULL hasta que conAlcance() las sustituye, así que la identidad local no cambia.
describe('ámbito en las consultas de S4', () => {
  it.each([
    ['CONSULTA_TRABAJOS_MER', CONSULTA_TRABAJOS_MER],
    ['FILTRO_TRABAJOS_MER', FILTRO_TRABAJOS_MER],
    ['CONSULTA_PAGINA_TRABAJOS_MER', CONSULTA_PAGINA_TRABAJOS_MER],
    ['CONSULTA_CATALOGOS_TRABAJOS_MER', CONSULTA_CATALOGOS_TRABAJOS_MER],
    ['CONSULTA_CONTEOS_SEGUIMIENTO', CONSULTA_CONTEOS_SEGUIMIENTO],
    ['CONSULTA_ACTAS_SEGUIMIENTO', CONSULTA_ACTAS_SEGUIMIENTO],
    ['CONSULTA_PROGRAMACIONES', CONSULTA_PROGRAMACIONES],
    ['CONSULTA_TRABAJOS_DISPONIBLES', CONSULTA_TRABAJOS_DISPONIBLES],
    ['CONSULTA_PAGINA_FINALIZACION', CONSULTA_PAGINA_FINALIZACION],
  ])('%s limita por carreras y por tribunal', (_nombre, consulta) => {
    expect(consulta).toContain('/*ALCANCE_CARRERAS*/NULL');
    expect(consulta).toContain('/*ALCANCE_TRIBUNAL*/NULL');
  });
});
