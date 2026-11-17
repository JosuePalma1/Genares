import { claveLocalRubrica } from './creacionRubricaCompleta';

function porOrden(a, b) {
  return (a?.orden ?? 0) - (b?.orden ?? 0);
}

function centesimasCanonicas(valor) {
  const texto = String(valor ?? '').trim();
  const coincidencia = /^(\d+)(?:\.(\d{1,2}))?$/.exec(texto);
  if (!coincidencia) return texto;
  return `${coincidencia[1]}.${(coincidencia[2] ?? '').padEnd(2, '0')}`;
}

/** Crea una estructura editable nueva a partir de una versión completa. */
export function crearEstructuraEditorDesdeVersion(version) {
  if (version?.fuenteDatos !== 'api' || !Array.isArray(version.etapas) || !Array.isArray(version.categorias)) {
    throw new TypeError('Seleccione una versión completa como base.');
  }

  return [...version.etapas].sort(porOrden).map((etapa) => ({
    claveLocal: claveLocalRubrica(),
    codigo: etapa.codigo,
    nombre: etapa.nombre,
    alcance: etapa.alcance,
    ...(etapa.descripcion == null ? {} : { descripcion: etapa.descripcion }),
    // Esquema de calificación de la versión base: cuánto vale la parte y, si lo tiene, su peso.
    valor: centesimasCanonicas(etapa.maximoDecimal ?? ''),
    porcentaje: etapa.porcentajeDecimal == null ? '' : centesimasCanonicas(etapa.porcentajeDecimal),
    categorias: version.categorias
      .filter((categoria) => categoria.etapa === etapa.id)
      .sort(porOrden)
      .map((categoria) => ({
        claveLocal: claveLocalRubrica(),
        codigo: categoria.codigo,
        nombre: categoria.nombre,
        indicadores: [...categoria.indicadores].sort(porOrden).map((indicador) => ({
          claveLocal: claveLocalRubrica(),
          label: indicador.label ?? indicador.codigo,
          descripcion: indicador.descripcion,
          calificacionMaxima: indicador.maximoDecimal,
        })),
      })),
  }));
}

function estructuraComparable(etapas) {
  return etapas.map((etapa) => ({
    codigo: etapa.codigo,
    nombre: etapa.nombre,
    alcance: etapa.alcance,
    descripcion: etapa.descripcion ?? null,
    porcentaje: centesimasCanonicas(etapa.porcentaje ?? ''),
    categorias: etapa.categorias.map((categoria) => ({
      codigo: categoria.codigo,
      nombre: categoria.nombre,
      indicadores: categoria.indicadores.map((indicador) => ({
        label: indicador.label,
        descripcion: indicador.descripcion,
        calificacionMaxima: centesimasCanonicas(indicador.calificacionMaxima),
      })),
    })),
  }));
}

/** Ignora claves locales y diferencias de formato decimal equivalentes, pero respeta el orden. */
export function estructuraEditorCoincideConVersion(etapas, version) {
  if (!Array.isArray(etapas) || !version) return false;
  return JSON.stringify(estructuraComparable(etapas))
    === JSON.stringify(estructuraComparable(crearEstructuraEditorDesdeVersion(version)));
}

/** Una versión con porcentaje en todas sus etapas usa «porcentajes»; si no, «sumar puntos». */
export function esquemaDeVersion(version) {
  const etapas = version?.etapas ?? [];
  return etapas.length > 0 && etapas.every((etapa) => etapa.porcentajeDecimal != null) ? 'PORCENTAJES' : 'SUMA';
}

export function prepararClonVersionRubrica(version) {
  if (!version || version.fuenteDatos !== 'api') {
    throw new TypeError('La clonación requiere una versión base completa.');
  }
  return {
    datos: {
      modalidadId: version.modalidadId,
      periodoId: version.periodoId,
      nombre: version.titulo,
      version: '',
      escalaFinal: version.escalaFinal ?? 10,
      esquema: { modo: esquemaDeVersion(version) },
      etapas: crearEstructuraEditorDesdeVersion(version),
    },
    seleccionCarreras: Object.fromEntries((version.carreras ?? []).map((carrera) => [carrera.id, { vigente: false }])),
  };
}
