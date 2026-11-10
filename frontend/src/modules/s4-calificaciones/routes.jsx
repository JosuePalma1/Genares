import { PaginaResultadoApi } from './presentation/pages/PaginaEvaluacionesApi';
import { Navigate, Route, Routes } from 'react-router-dom';
import { EstructuraAplicacion } from './presentation/layouts/EstructuraAplicacion';
import DashboardPage from './presentation/pages/DashboardPage';
import PaginaProgramacionSustentacion from './presentation/pages/PaginaProgramacionSustentacion';
import PaginaMisEvaluaciones from './presentation/pages/PaginaMisEvaluaciones';
import PaginaImpresionRubrica from './presentation/pages/PaginaImpresionRubrica';
import PaginaConsulta from './presentation/pages/PaginaConsulta';
import PaginaNuevaRubrica from './presentation/pages/PaginaNuevaRubrica';
import PaginaDetalleRubrica from './presentation/pages/PaginaDetalleRubrica';
import PaginaSecretaria from './presentation/pages/PaginaSecretaria';
import PaginaCoordinacion from './presentation/pages/PaginaCoordinacion';
import PaginaNoEncontrada from './presentation/pages/PaginaNoEncontrada';
import PaginaModalidades from './presentation/pages/PaginaModalidades';
import PaginaDetalleModalidad from './presentation/pages/PaginaDetalleModalidad';
import PaginaCarreras from './presentation/pages/PaginaCarreras';
import PaginaCronograma from './presentation/pages/PaginaCronograma';
import PaginaDocumentos from './presentation/pages/PaginaDocumentos';
import PaginaEvaluacionesIntegradasDev from './presentation/pages/PaginaEvaluacionesIntegradasDev';
import PaginaRubricasIntegradasDev from './presentation/pages/PaginaRubricasIntegradasDev';
import { PaginaTrabajosIntegradosDev, PaginaDetalleTrabajoIntegradoDev, PaginaTribunalTrabajoIntegradoDev } from './presentation/pages/PaginaTrabajosIntegradosDev';

export default function Aplicacion() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/dashboard" />} />
      <Route element={<EstructuraAplicacion />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/trabajos" element={<PaginaTrabajosIntegradosDev />} />
        <Route path="/trabajos/nuevo" element={<Navigate replace to="/trabajos" />} />
        <Route path="/trabajos/:idTrabajo" element={<PaginaDetalleTrabajoIntegradoDev />} />
        <Route path="/trabajos/:idTrabajo/tribunal" element={<PaginaTribunalTrabajoIntegradoDev />} />
        <Route path="/trabajos/:idTrabajo/sustentacion" element={<PaginaProgramacionSustentacion />} />
        <Route path="/cronograma" element={<PaginaCronograma />} />
        <Route path="/integracion-dev" element={<Navigate replace to="/trabajos" />} />
        <Route path="/evaluaciones/:asignacionId" element={<PaginaEvaluacionesIntegradasDev />} />
        <Route path="/evaluaciones/integradas/:asignacionId" element={<PaginaEvaluacionesIntegradasDev />} />
        <Route path="/mis-evaluaciones" element={<PaginaMisEvaluaciones />} />
        <Route path="/evaluaciones/:asignacionId/escrita" element={<PaginaEvaluacionesIntegradasDev tipo="ESCRITA" />} />
        <Route path="/evaluaciones/:asignacionId/oral/:idEstudiante" element={<PaginaEvaluacionesIntegradasDev />} />
        <Route path="/resultados/:idTrabajo/:idEstudiante" element={<PaginaResultadoApi />} />
        <Route path="/rubrica/:idTrabajo/:idEstudiante/:idMiembro" element={<PaginaImpresionRubrica />} />
        <Route path="/consulta" element={<PaginaConsulta />} />
        <Route path="/documentos" element={<PaginaDocumentos />} />
        <Route path="/rubricas" element={<PaginaRubricasIntegradasDev />} />
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
