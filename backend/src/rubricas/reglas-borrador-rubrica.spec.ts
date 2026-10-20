import { AlcanceEtapaRubrica, EtapaEvaluacion } from '../comun/enums-dominio';
import { ActualizarVersionRubricaDto, EtapaBorradorRubricaDto } from './dto/actualizar-version-rubrica.dto';
import {
  validarEstructuraActivableRubrica,
  validarEstructuraBorradorRubrica,
} from './reglas-borrador-rubrica';

const etapa = (
  tipo: EtapaEvaluacion,
  alcance: AlcanceEtapaRubrica,
  codigo: string,
  orden: number,
): EtapaBorradorRubricaDto => ({
  tipo,
  alcance,
  codigo,
  nombre: codigo,
  calificacionMaxima: '5.00',
  orden,
  categorias: [],
});

describe('validarEstructuraBorradorRubrica', () => {
  it('admite subtotal cero para grupos vacíos y mantiene indicadores positivos y activación completa', () => {
    const vacia = etapa(EtapaEvaluacion.ESCRITA, AlcanceEtapaRubrica.TRABAJO_COMPARTIDO, 'ESC', 1);
    vacia.calificacionMaxima = '0.00';
    vacia.categorias = [{ codigo: 'A', nombre: 'Vacía', calificacionMaxima: '0.00', orden: 1, indicadores: [] }];
    expect(() => validarEstructuraBorradorRubrica({ revision: 1, etapas: [vacia] })).not.toThrow();
    expect(() => validarEstructuraActivableRubrica({ revision: 1, etapas: [vacia] })).toThrow();
    vacia.categorias[0].indicadores.push({ label: 'A1', descripcion: 'Indicador', calificacionMaxima: '0.00', orden: 1 });
    expect(() => validarEstructuraBorradorRubrica({ revision: 1, etapas: [vacia] })).toThrow(/mayor que cero/);
  });
  it('permite guardar una estructura vacía o parcial sin imponer condiciones de activación', () => {
    expect(() => validarEstructuraBorradorRubrica({ revision: 1, etapas: [] })).not.toThrow();
    expect(() => validarEstructuraBorradorRubrica({
      revision: 1,
      etapas: [etapa(EtapaEvaluacion.ESCRITA, AlcanceEtapaRubrica.TRABAJO_COMPARTIDO, 'ESC', 1)],
    })).not.toThrow();
  });

  it('conserva los alcances permitidos y rechaza incoherencias cuando están las dos etapas completas', () => {
    const completa = {
      revision: 1,
      etapas: [
        {
          ...etapa(EtapaEvaluacion.ESCRITA, AlcanceEtapaRubrica.TRABAJO_COMPARTIDO, 'ESC', 1),
          calificacionMaxima: '5.25',
          categorias: [{
            codigo: 'ESC-CAT', nombre: 'Escrita', calificacionMaxima: '5.25', orden: 1,
            indicadores: [{ label: 'I-E', descripcion: 'Indicador', calificacionMaxima: '5.25', orden: 1 }],
          }],
        },
        {
          ...etapa(EtapaEvaluacion.ORAL, AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL, 'ORA', 2),
          calificacionMaxima: '4.70',
          categorias: [{
            codigo: 'ORA-CAT', nombre: 'Oral', calificacionMaxima: '4.70', orden: 2,
            indicadores: [{ label: 'I-O', descripcion: 'Indicador', calificacionMaxima: '4.70', orden: 1 }],
          }],
        },
      ],
    } as ActualizarVersionRubricaDto;
    expect(() => validarEstructuraBorradorRubrica(completa)).not.toThrow();
    expect(() => validarEstructuraActivableRubrica(completa)).not.toThrow();
    expect(() => validarEstructuraActivableRubrica({ revision: 1, etapas: [] })).toThrow(/escrita y oral/i);
    completa.etapas[0].categorias[0].calificacionMaxima = '5.00';
    expect(() => validarEstructuraBorradorRubrica(completa)).toThrow(/sumatoria/i);
    expect(() => validarEstructuraActivableRubrica(completa)).toThrow(/sumatoria/i);
  });

  it('rechaza códigos y órdenes duplicados, alcances inválidos, negativos y exceso de decimales', () => {
    const escrita = etapa(EtapaEvaluacion.ESCRITA, AlcanceEtapaRubrica.TRABAJO_COMPARTIDO, 'ESC', 1);
    const oral = etapa(EtapaEvaluacion.ORAL, AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL, 'ESC', 1);
    expect(() => validarEstructuraBorradorRubrica({ revision: 1, etapas: [escrita, oral] })).toThrow(/códigos/i);
    oral.codigo = 'ORA';
    expect(() => validarEstructuraBorradorRubrica({ revision: 1, etapas: [escrita, oral] })).toThrow(/órdenes/i);
    oral.orden = 2;
    oral.alcance = AlcanceEtapaRubrica.TRABAJO_COMPARTIDO;
    expect(() => validarEstructuraBorradorRubrica({ revision: 1, etapas: [escrita, oral] })).toThrow(/alcance/i);
    oral.alcance = AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL;
    oral.calificacionMaxima = '-1';
    expect(() => validarEstructuraBorradorRubrica({ revision: 1, etapas: [escrita, oral] })).toThrow(/decimales/i);
    oral.calificacionMaxima = '1.234';
    expect(() => validarEstructuraBorradorRubrica({ revision: 1, etapas: [escrita, oral] })).toThrow(/decimales/i);
  });
});
