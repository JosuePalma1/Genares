import { Navigate, Route, Routes } from 'react-router-dom';
import { EstructuraAplicacion } from './estructuras/EstructuraAplicacion';
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
import PaginaNuevaRubrica from './paginas/PaginaNuevaRubrica';
import PaginaDetalleRubrica from './paginas/PaginaDetalleRubrica';
import PaginaSecretaria from './paginas/PaginaSecretaria';
import PaginaCoordinacion from './paginas/PaginaCoordinacion';
import PaginaNoEncontrada from './paginas/PaginaNoEncontrada';
import PaginaModalidades from './paginas/PaginaModalidades';
import PaginaDetalleModalidad from './paginas/PaginaDetalleModalidad';
import PaginaCarreras from './paginas/PaginaCarreras';
import PaginaCronograma from './paginas/PaginaCronograma';
import PaginaDocumentos from './paginas/PaginaDocumentos';

export default function Aplicacion() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/dashboard" />} />
      <Route element={<EstructuraAplicacion />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/trabajos" element={<PaginaTrabajos />} />
        <Route path="/trabajos/nuevo" element={<PaginaFormularioTrabajo />} />
        <Route path="/trabajos/:idTrabajo" element={<PaginaDetalleTrabajo />} />
        <Route path="/trabajos/:idTrabajo/tribunal" element={<PaginaAsignacionTribunal />} />
        <Route path="/trabajos/:idTrabajo/sustentacion" element={<PaginaProgramacionSustentacion />} />
        <Route path="/cronograma" element={<PaginaCronograma />} />
        <Route path="/mis-evaluaciones" element={<PaginaMisEvaluaciones />} />
        <Route path="/evaluaciones/:idTrabajo/escrita" element={<PaginaEvaluacionEscrita />} />
        <Route path="/evaluaciones/:idTrabajo/oral/:idEstudiante" element={<PaginaEvaluacionOral />} />
        <Route path="/resultados/:idTrabajo/:idEstudiante" element={<PaginaResultados />} />
        <Route path="/rubrica/:idTrabajo/:idEstudiante/:idMiembro" element={<PaginaImpresionRubrica />} />
        <Route path="/consulta" element={<PaginaConsulta />} />
        <Route path="/documentos" element={<PaginaDocumentos />} />
        <Route path="/rubricas" element={<PaginaRubricas />} />
        <Route path="/rubricas/nueva" element={<PaginaNuevaRubrica />} />
        <Route path="/rubricas/:idRubrica/nueva-version/:idVersion" element={<PaginaNuevaRubrica />} />
        <Route path="/rubricas/:idRubrica" element={<PaginaDetalleRubrica />} />
        <Route path="/maestros/modalidades" element={<PaginaModalidades />} />
        <Route path="/maestros/modalidades/:id" element={<PaginaDetalleModalidad />} />
        <Route path="/maestros/carreras" element={<PaginaCarreras />} />
        <Route path="/secretaria" element={<PaginaSecretaria />} />
        <Route path="/coordinacion" element={<PaginaCoordinacion />} />
        <Route path="*" element={<PaginaNoEncontrada />} />
      </Route>
    </Routes>
  );
}
