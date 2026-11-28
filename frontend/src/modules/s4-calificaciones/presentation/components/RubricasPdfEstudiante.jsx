import { FileText } from 'lucide-react';
import { rutaPdfRubrica } from '../../domain/documentosRubrica';
import { BotonDocumentoPdf } from './BotonPdf';
import './rubricasPdfEstudiante.css';

function nombre(persona) {
  return [persona.nombres, persona.apellidos].filter(Boolean).join(' ');
}

export function RubricasPdfEstudiante({ trabajo, estudiante, miembros = trabajo.miembrosTribunal }) {
  if (!trabajo.idVersionRubrica || trabajo.estadoTribunal !== 'CONFIRMADO' || !miembros.length) return null;

  return (
    <div className="rubricas-pdf-estudiante" role="group" aria-label={`Rúbricas de ${nombre(estudiante)}`}>
      {miembros.map((miembro) => (
        <BotonDocumentoPdf
          key={miembro.idMiembroTribunal}
          ruta={rutaPdfRubrica(trabajo.id, estudiante.id, miembro.idMiembroTribunal)}
          className="button button-sm button-outline"
          etiqueta={`Ver rúbrica PDF de ${nombre(estudiante)} · ${nombre(miembro)}`}
        >
          <FileText size={15} aria-hidden="true" /> Rúbrica PDF · {nombre(miembro)}
        </BotonDocumentoPdf>
      ))}
    </div>
  );
}
