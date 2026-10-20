import { Navigate, Route, Routes } from 'react-router-dom';
import { ROL } from './datos/datosPrototipo';
import { EstructuraAplicacion } from './estructuras/EstructuraAplicacion';
import { usarPrototipo } from './estado/ContextoPrototipo';
import { EstadoVacio, EncabezadoPagina } from './componentes/interfaz';
import LoginPage from './paginas/LoginPage';
import DashboardPage from './paginas/DashboardPage';
import PaginaTrabajos from './paginas/PaginaTrabajos';
import PaginaFormularioTrabajo from './paginas/PaginaFormularioTrabajo';
import PaginaDetalleTrabajo from './paginas/PaginaDetalleTrabajo';
import PaginaAsignacionTribunal from './paginas/PaginaAsignacionTribunal';
import PaginaProgramacionSustentacion from './paginas/PaginaProgramacionSustentacion';
import PaginaMisEvaluaciones from './paginas/PaginaMisEvaluaciones';
import PaginaEvaluacionEscrita from './paginas/PaginaEvaluacionEscrita';
import PaginaEvaluacionOral from './paginas/PaginaEvaluacionOral';
import PaginaResultados from './paginas/PaginaResultados';
import PaginaImpresionRubrica from './paginas/PaginaImpresionRubrica';
import PaginaConsulta from './paginas/PaginaConsulta';
import PaginaRubricas from './paginas/PaginaRubricas';
import PaginaDetalleRubrica from './paginas/PaginaDetalleRubrica';
import PaginaSecretaria from './paginas/PaginaSecretaria';
import PaginaCoordinacion from './paginas/PaginaCoordinacion';
import PaginaUsuarios from './paginas/PaginaUsuarios';
import PaginaNoEncontrada from './paginas/PaginaNoEncontrada';
import PaginaModalidades from './paginas/PaginaModalidades';
import PaginaDetalleModalidad from './paginas/PaginaDetalleModalidad';

function RequerirRol({ roles, children }) {
  const { actorActual } = usarPrototipo();
  const allowed = actorActual.roles.some((role) => roles.includes(role));
  if (allowed) return children;
  return <><EncabezadoPagina title="Acción no disponible" description="La identidad simulada no tiene permisos para esta función." breadcrumbs={['Inicio', 'Acceso restringido']} /><section className="card"><EstadoVacio title="Permiso insuficiente" description="Cambie la identidad simulada desde el encabezado para validar otro rol." /></section></>;
}

export default function Aplicacion() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/login" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<EstructuraAplicacion />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/trabajos" element={<PaginaTrabajos />} />
        <Route path="/trabajos/nuevo" element={<RequerirRol roles={[ROL.COMISION, ROL.ADMIN]}><PaginaFormularioTrabajo /></RequerirRol>} />
        <Route path="/trabajos/:idTrabajo" element={<PaginaDetalleTrabajo />} />
        <Route path="/trabajos/:idTrabajo/tribunal" element={<RequerirRol roles={[ROL.COMISION, ROL.ADMIN]}><PaginaAsignacionTribunal /></RequerirRol>} />
        <Route path="/trabajos/:idTrabajo/sustentacion" element={<RequerirRol roles={[ROL.COMISION, ROL.ADMIN]}><PaginaProgramacionSustentacion /></RequerirRol>} />
        <Route path="/mis-evaluaciones" element={<PaginaMisEvaluaciones />} />
        <Route path="/evaluaciones/:idTrabajo/escrita" element={<PaginaEvaluacionEscrita />} />
        <Route path="/evaluaciones/:idTrabajo/oral/:idEstudiante" element={<PaginaEvaluacionOral />} />
        <Route path="/resultados/:idTrabajo/:idEstudiante" element={<PaginaResultados />} />
        <Route path="/rubrica/:idTrabajo/:idEstudiante/:idMiembro" element={<PaginaImpresionRubrica />} />
        <Route path="/consulta" element={<PaginaConsulta />} />
        <Route path="/rubricas" element={<RequerirRol roles={[ROL.COMISION, ROL.ADMIN]}><PaginaRubricas /></RequerirRol>} />
        <Route path="/rubricas/:idRubrica" element={<RequerirRol roles={[ROL.COMISION, ROL.ADMIN]}><PaginaDetalleRubrica /></RequerirRol>} />
        <Route path="/maestros/modalidades" element={<RequerirRol roles={[ROL.ADMIN]}><PaginaModalidades /></RequerirRol>} />
        <Route path="/maestros/modalidades/:id" element={<RequerirRol roles={[ROL.ADMIN]}><PaginaDetalleModalidad /></RequerirRol>} />
        <Route path="/secretaria" element={<RequerirRol roles={[ROL.SECRETARIA, ROL.ADMIN]}><PaginaSecretaria /></RequerirRol>} />
        <Route path="/coordinacion" element={<RequerirRol roles={[ROL.COORDINACION, ROL.ADMIN]}><PaginaCoordinacion /></RequerirRol>} />
        <Route path="/usuarios" element={<RequerirRol roles={[ROL.ADMIN]}><PaginaUsuarios /></RequerirRol>} />
        <Route path="*" element={<PaginaNoEncontrada />} />
      </Route>
    </Routes>
  );
}
