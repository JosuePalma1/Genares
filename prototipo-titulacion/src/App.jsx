import { Navigate, Route, Routes } from 'react-router-dom';
import { ROLE } from './data/prototypeData';
import { AppLayout } from './layouts/AppLayout';
import { usePrototype } from './state/PrototypeContext';
import { EmptyState, PageHeader } from './components/ui';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WorksPage from './pages/WorksPage';
import WorkFormPage from './pages/WorkFormPage';
import WorkDetailPage from './pages/WorkDetailPage';
import TribunalAssignmentPage from './pages/TribunalAssignmentPage';
import ScheduleDefensePage from './pages/ScheduleDefensePage';
import MyEvaluationsPage from './pages/MyEvaluationsPage';
import WrittenEvaluationPage from './pages/WrittenEvaluationPage';
import OralEvaluationPage from './pages/OralEvaluationPage';
import ResultsPage from './pages/ResultsPage';
import RubricPrintPage from './pages/RubricPrintPage';
import ConsultationPage from './pages/ConsultationPage';
import RubricsPage from './pages/RubricsPage';
import RubricDetailPage from './pages/RubricDetailPage';
import SecretaryPage from './pages/SecretaryPage';
import CoordinationPage from './pages/CoordinationPage';
import UsersPage from './pages/UsersPage';
import NotFoundPage from './pages/NotFoundPage';

function RequireRole({ roles, children }) {
  const { currentActor } = usePrototype();
  const allowed = currentActor.roles.some((role) => roles.includes(role));
  if (allowed) return children;
  return <><PageHeader title="Acción no disponible" description="La identidad simulada no tiene permisos para esta función." breadcrumbs={['Inicio', 'Acceso restringido']} /><section className="card"><EmptyState title="Permiso insuficiente" description="Cambie la identidad simulada desde el encabezado para validar otro rol." /></section></>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/login" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/trabajos" element={<WorksPage />} />
        <Route path="/trabajos/nuevo" element={<RequireRole roles={[ROLE.COMMISSION, ROLE.ADMIN]}><WorkFormPage /></RequireRole>} />
        <Route path="/trabajos/:workId" element={<WorkDetailPage />} />
        <Route path="/trabajos/:workId/tribunal" element={<RequireRole roles={[ROLE.COMMISSION, ROLE.ADMIN]}><TribunalAssignmentPage /></RequireRole>} />
        <Route path="/trabajos/:workId/sustentacion" element={<RequireRole roles={[ROLE.COMMISSION, ROLE.ADMIN]}><ScheduleDefensePage /></RequireRole>} />
        <Route path="/mis-evaluaciones" element={<MyEvaluationsPage />} />
        <Route path="/evaluaciones/:workId/escrita" element={<RequireRole roles={[ROLE.TRIBUNAL]}><WrittenEvaluationPage /></RequireRole>} />
        <Route path="/evaluaciones/:workId/oral/:studentId" element={<RequireRole roles={[ROLE.TRIBUNAL]}><OralEvaluationPage /></RequireRole>} />
        <Route path="/resultados/:workId/:studentId" element={<ResultsPage />} />
        <Route path="/rubrica/:workId/:studentId/:memberId" element={<RubricPrintPage />} />
        <Route path="/consulta" element={<ConsultationPage />} />
        <Route path="/rubricas" element={<RequireRole roles={[ROLE.COMMISSION, ROLE.ADMIN]}><RubricsPage /></RequireRole>} />
        <Route path="/rubricas/:rubricId" element={<RequireRole roles={[ROLE.COMMISSION, ROLE.ADMIN]}><RubricDetailPage /></RequireRole>} />
        <Route path="/secretaria" element={<RequireRole roles={[ROLE.SECRETARY, ROLE.ADMIN]}><SecretaryPage /></RequireRole>} />
        <Route path="/coordinacion" element={<RequireRole roles={[ROLE.COORDINATION, ROLE.ADMIN]}><CoordinationPage /></RequireRole>} />
        <Route path="/usuarios" element={<RequireRole roles={[ROLE.ADMIN]}><UsersPage /></RequireRole>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

