import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { EVALUATION_STATUS } from '../data/prototypeData';
import { categoryScore, fullName, memberGrade, stageScore } from '../domain/workflow';
import { usePrototype } from '../state/PrototypeContext';
import { EmptyState, StatusBadge } from '../components/ui';

export default function RubricPrintPage() {
  const { workId, studentId, memberId } = useParams();
  const { state, dispatch } = usePrototype();
  const location = useLocation();
  const autoPrintStarted = useRef(false);
  const work = state.works.find((item) => item.id === workId);
  const student = state.people.find((person) => person.id === studentId);
  const member = state.people.find((person) => person.id === memberId);
  const tutor = state.people.find((person) => person.id === work?.tutorId);
  const evaluation = state.evaluations.find((item) => item.workId === workId && item.memberId === memberId);
  const oral = evaluation?.oralByStudent?.[studentId];
  const printable = evaluation?.written.status === EVALUATION_STATUS.CLOSED && oral?.status === EVALUATION_STATUS.CLOSED;

  const printRubric = () => {
    dispatch({ type: 'MARK_RUBRIC_PRINTED', evaluationId: evaluation.id, studentId });
    window.setTimeout(() => window.print(), 120);
  };

  useEffect(() => {
    if (!location.state?.autoPrint || !printable || autoPrintStarted.current) return;
    const marker = `genares-autoprint-${location.key}`;
    if (window.sessionStorage.getItem(marker)) return;
    window.sessionStorage.setItem(marker, '1');
    autoPrintStarted.current = true;
    const timer = window.setTimeout(printRubric, 350);
    return () => window.clearTimeout(timer);
  }, [location.key, location.state?.autoPrint, printable]);

  if (!work || !student || !member || !evaluation || !printable) return <EmptyState title="Rúbrica aún no disponible" description="La revisión escrita y la evaluación oral deben estar finalizadas para este estudiante." />;
  const rubric = evaluation.rubricSnapshot;
  const writtenCategories = rubric.categories.filter((category) => category.stage === 'WRITTEN');
  const oralCategories = rubric.categories.filter((category) => category.stage === 'ORAL');
  const grade = memberGrade(evaluation, studentId);

  const renderPart = (title, subtitle, categories, scores, observations) => <section className="print-part"><div className="print-part-title"><div><h2>{title}</h2><p>{subtitle}</p></div><strong>{categories.reduce((sum, category) => sum + category.max, 0).toFixed(2)} puntos</strong></div><table className="rubric-print-table"><thead><tr><th>Categoría / indicador</th><th>Valoración máxima</th><th>Calificación</th><th>Observación</th></tr></thead><tbody>{categories.map((category) => <RubricCategoryRows key={category.id} category={category} scores={scores} observations={observations} />)}</tbody><tfoot><tr><th>Total de la parte</th><th>{categories.reduce((sum, category) => sum + category.max, 0).toFixed(2)}</th><th>{categories.reduce((sum, category) => sum + categoryScore(scores, category), 0).toFixed(2)}</th><th /></tr></tfoot></table></section>;

  return (
    <div className="print-page-shell">
      <div className="print-toolbar"><Link className="button button-outline" to={`/resultados/${work.id}/${student.id}`}><ArrowLeft size={17} /> Volver a resultados</Link><div><StatusBadge tone="success">Evaluación finalizada</StatusBadge> <button className="button button-primary" type="button" onClick={printRubric}><Printer size={18} /> Imprimir nuevamente</button></div></div>
      <article className="rubric-document">
        <header className="rubric-document-header"><img src="/assets/identidad-placeholder.svg" alt="Identidad institucional provisional" /><div><p>UNIVERSIDAD LAICA ELOY ALFARO DE MANABÍ</p><p>FACULTAD DE CIENCIAS DE LA VIDA Y TECNOLOGÍAS</p><h1>RÚBRICA DE EVALUACIÓN DE TRABAJO DE INTEGRACIÓN CURRICULAR</h1><h2>MODALIDAD {work.modality.toUpperCase()}</h2></div></header>
        <section className="print-metadata"><div><span>Título del trabajo</span><strong>{work.title}</strong></div><div><span>Estudiante</span><strong>{fullName(student)}</strong></div><div><span>Cédula</span><strong>{student.cedula}</strong></div><div><span>Tutor</span><strong>{fullName(tutor)}</strong></div><div><span>Período / versión</span><strong>{work.period} · {rubric.version}</strong></div><div><span>Miembro del tribunal</span><strong>{fullName(member)}</strong></div></section>
        {renderPart('PARTE I · REVISIÓN PROYECTO ESCRITO', '50 % de la rúbrica', writtenCategories, evaluation.written.scores, evaluation.written.observations)}
        {renderPart('PARTE II · SUSTENTACIÓN DEL PROYECTO', '50 % de la rúbrica · evaluación individual', oralCategories, oral.scores, oral.observations)}
        <section className="print-summary"><h2>Resumen de evaluación</h2><div className="print-summary-grid">{rubric.categories.map((category) => { const scores = category.stage === 'WRITTEN' ? evaluation.written.scores : oral.scores; return <div key={category.id}><span>{category.code}. {category.name}</span><strong>{categoryScore(scores, category).toFixed(2)} / {category.max.toFixed(2)}</strong></div>; })}<div className="print-final-grade"><span>CALIFICACIÓN FINAL DE LA RÚBRICA</span><strong>{grade.toFixed(2)} / 10,00</strong></div></div></section>
        <footer className="signature-area"><div><span className="signature-line" /><strong>{fullName(member)}</strong><span>Miembro del tribunal</span></div><p>Documento: Rúbrica de evaluación. No constituye un acta oficial del SGA.</p></footer>
      </article>
    </div>
  );
}

function RubricCategoryRows({ category, scores, observations }) {
  return <>{category.indicators.map((indicator, index) => <tr key={indicator.id}><td><strong>{category.code}.{index + 1} {indicator.label}</strong>{index === 0 && <span className="print-category-name">{category.name}</span>}</td><td>{indicator.max.toFixed(2)}</td><td>{Number(scores?.[indicator.id] ?? 0).toFixed(2)}</td><td>{observations?.[indicator.id] || '—'}</td></tr>)}<tr className="category-total-row"><th>Subtotal {category.code}</th><th>{category.max.toFixed(2)}</th><th>{categoryScore(scores, category).toFixed(2)}</th><th /></tr></>;
}

