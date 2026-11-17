import { DatosDocumentales, notaEtapaSobreDiez } from './modelo-documental';
import { fechaSustentacionActa, notaEnLetras } from './reglas-acta';
import { dibujarActaPdf } from './pdf-actas';

/** Título del PDF: «Nombre completo - acta PAT-xx». */
function tituloActa(datos: DatosDocumentales, estudianteId: string, formato: string) {
  const estudiante = datos.estudiantes.find(({ id }) => id === estudianteId);
  return `${estudiante ? `${estudiante.nombres} ${estudiante.apellidos} - ` : ''}acta ${formato}`;
}

/** Última sesión programada (no cancelada) del estudiante; de ahí salen la fecha y la hora del acta. */
function sesionDelEstudiante(datos: DatosDocumentales, estudianteId: string) {
  const sesiones = (datos.sesiones ?? []).filter((sesion) => sesion.estudianteId === estudianteId);
  return sesiones.length ? sesiones[sesiones.length - 1] : null;
}

// Las firmas (títulos y nombres del tribunal, graduado, tutor y autoridades) las completa la facultad a mano:
// el sistema no las rellena (decisión de Josué, 17/11/2026).

export function camposPat04(datos: DatosDocumentales, estudianteId: string, numero: string, final?: string, aprobado?: boolean) {
  const estudiante = datos.estudiantes.find(({ id }) => id === estudianteId);
  if (!estudiante) throw new Error('El estudiante no pertenece al trabajo.');
  const nombre = `${estudiante.nombres} ${estudiante.apellidos}`;
  const consolidacion = datos.consolidacion.estudiantes.find((item) => item.estudiante.id === estudianteId);
  const componente = (kind: string, scope: string) => {
    const etapas = consolidacion?.etapas ?? [];
    const aplicables = etapas.filter((etapa) => etapa.kind === kind || (etapa.kind === 'PERSONALIZADA' && etapa.scope === scope));
    return aplicables.length === 1 ? notaEtapaSobreDiez(aplicables[0]) : null;
  };
  const nota = (original: string, valor?: string | null, escala = 10) => ({
    original, valor: valor ? `${valor}/${escala}` : 'Pendiente', letras: valor ? notaEnLetras(valor, escala) : 'Pendiente',
  });
  return [
    { original: 'No……', valor: numero },
    { original: '… (opción de titulación)', valor: datos.trabajo.modalidad || 'Por confirmar' },
    { original: '… (NOMBRES DEL/LA ESTUDIANTE)', valor: nombre },
    { original: '...(identificación)', valor: estudiante.identificacion || 'Por confirmar' },
    { original: '“………”', valor: `“${datos.trabajo.titulo}”` },
    nota('7/10', componente('ESCRITA', 'TRABAJO_COMPARTIDO')),
    nota('9/10', componente('ORAL', 'ESTUDIANTE_INDIVIDUAL')),
    nota('16/20', final, Number(consolidacion?.resultadoFinal?.calificacionMaxima ?? datos.rubrica?.escalaFinal ?? 10)),
    { original: 'APROBADO', valor: final ? (aprobado ? 'APROBADO' : 'REPROBADO') : 'RESULTADO PENDIENTE' },
    { original: '… (NOMBRES).', valor: ` ${nombre}.` },
    { original: '………………….', valor: datos.trabajo.carrera || 'Por confirmar' },
    ...camposFecha(datos, estudianteId),
  ];
}

/** Fecha y hora de la sustentación; sin sesión programada, el acta conserva los huecos «xx» del formato. */
function camposFecha(datos: DatosDocumentales, estudianteId: string) {
  const sesion = sesionDelEstudiante(datos, estudianteId);
  if (!sesion) return [];
  const fecha = fechaSustentacionActa(sesion.fecha, sesion.hora);
  return [
    { original: 'a los xx días del mes xxxx del dos mil xxxx (fecha en letras), siendo las 00h00', valor: fecha.enLetras },
    { original: 'xx de xxxx del 20xx', valor: fecha.numerica },
  ];
}

export function pdfPat04(datos: DatosDocumentales, estudianteId: string, numero: string, final?: string, aprobado?: boolean) {
  return dibujarActaPdf('PAT-04-F-017', camposPat04(datos, estudianteId, numero, final, aprobado), tituloActa(datos, estudianteId, 'PAT-04-F-017'));
}

export function camposPat01(datos: DatosDocumentales, estudianteId: string, numero: string, final?: string, aprobado?: boolean) {
  return camposPat04(datos, estudianteId, numero, final, aprobado).map((campo) => {
    const posicion = ['7/10', '9/10', '16/20'].indexOf(campo.original);
    if (posicion >= 0) return { ...campo, original: 'XX/10', ocurrencia: posicion + 1 };
    if (campo.original === 'No……') return { ...campo, original: 'No. ……' };
    if (campo.original === '… (opción de titulación)') return { ...campo, original: '… (modalidad de titulación)' };
    return campo;
  }).concat([{ original: '…(nombre del trabajo de titulación/examen complexivo)', valor: ` «${datos.trabajo.titulo}»` }]);
}

export function pdfPat01(datos: DatosDocumentales, estudianteId: string, numero: string, final?: string, aprobado?: boolean) {
  return dibujarActaPdf('PAT-01-F-019', camposPat01(datos, estudianteId, numero, final, aprobado), tituloActa(datos, estudianteId, 'PAT-01-F-019'));
}
