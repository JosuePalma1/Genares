import { AlertaInstitucional, EncabezadoPagina } from '../components/interfaz';
import { AuditoriaCambios } from './SeguimientoApi';

// AU-01 · Historial de cambios (Paso 2, Anexo A.3.9). Reutiliza la bitácora que ya se
// consulta en Consulta e historial; el servidor exige la capacidad de auditoría.
export default function PaginaAuditoria() {
  return (
    <div className="seguimiento-api-page">
      <EncabezadoPagina
        eyebrow="Control"
        title="Auditoría"
        description="Historial de cambios aceptados en S4: actor, fecha y valores anteriores y nuevos. La bitácora es de solo lectura."
        breadcrumbs={[{ etiqueta: 'Inicio', to: '/dashboard' }, { etiqueta: 'Auditoría' }]}
      />
      <AlertaInstitucional tono="info" titulo="Solicitudes de corrección pendientes de desarrollo">
        La solicitud y autorización de correcciones excepcionales de notas cerradas (AU-02 y AU-03) todavía no están disponibles.
      </AlertaInstitucional>
      <AuditoriaCambios />
    </div>
  );
}
