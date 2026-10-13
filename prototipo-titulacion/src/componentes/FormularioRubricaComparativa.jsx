import { LockKeyhole } from 'lucide-react';
import {
  calificacionCategoria,
  maximoEtapa,
  nombreCompleto,
  obtenerCategoriasEtapa,
  obtenerDefinicionEtapa,
  valorCalificacionPresentable,
} from '../dominio/flujoTrabajo';
import { InsigniaEstado } from './interfaz';

const formatearCalificacion = (valor) => Number(valor || 0).toFixed(2);

export function FormularioRubricaComparativa({
  rubrica,
  estudiantes,
  formularios,
  estados,
  alCambiarCalificacion,
  alCambiarObservacion,
}) {
  const etapa = obtenerDefinicionEtapa(rubrica, 'ORAL');
  const categorias = obtenerCategoriasEtapa(rubrica, 'ORAL');
  const maximo = maximoEtapa(rubrica, 'ORAL');

  return (
    <div className="rubrica-formulario rubrica-comparativa-form">
      <header className="rubrica-form-heading">
        <div>
          <span className="page-eyebrow">{String(etapa?.codigo ?? 'PARTE II').replaceAll('_', ' ')}{etapa?.porcentaje ? ` · ${etapa.porcentaje} %` : ''}</span>
          <h2>{etapa?.nombre ?? 'Sustentación del proyecto'}</h2>
          <p>Cada indicador se muestra una vez. Registre valores y observaciones independientes para cada estudiante.</p>
        </div>
        <strong className="rubrica-comparativa-maximo">Máximo {formatearCalificacion(maximo)} por estudiante</strong>
      </header>

      <div className="rubrica-categoria-list">
        {categorias.map((categoria) => (
          <section className="rubrica-section rubrica-categoria" key={categoria.id} aria-labelledby={`comparativa-${categoria.id}-title`}>
            <div className="rubrica-section-header">
              <div>
                <span className="rubrica-categoria-code">Categoría {categoria.codigo}</span>
                <h3 id={`comparativa-${categoria.id}-title`}>{categoria.nombre}</h3>
              </div>
              <span className="rubrica-categoria-maximo">Máximo {formatearCalificacion(categoria.maximo)}</span>
            </div>

            <div className="rubrica-indicador-list">
              {(categoria.indicadores ?? []).map((indicador, indice) => (
                <article className="rubrica-comparativa-indicador" key={indicador.id}>
                  <div className="rubrica-comparativa-criterio">
                    <span className="rubrica-indicador-numero">Indicador {indice + 1}</span>
                    <h4>{indicador.etiqueta}</h4>
                    <p>Valoración máxima: <strong>{formatearCalificacion(indicador.maximo)} puntos</strong></p>
                  </div>

                  <div className="rubrica-comparativa-estudiantes">
                    {estudiantes.map((estudiante, studentIndex) => {
                      const formulario = formularios[estudiante.id] ?? { calificaciones: {}, observaciones: {} };
                      const cerrado = estados[estudiante.id]?.cerrado;
                      const valor = valorCalificacionPresentable(formulario.calificaciones?.[indicador.id]);
                      const incompleto = formulario.mostrarErrores && !cerrado && valor === '';
                      const nombre = nombreCompleto(estudiante);
                      const inputId = `comparativa-${estudiante.id}-${indicador.id}`;
                      const observationId = `${inputId}-observacion`;
                      const helpId = `${inputId}-ayuda`;
                      const errorId = `${inputId}-error`;

                      return (
                        <div className={`rubrica-estudiante-control ${cerrado ? 'is-read-only' : ''} ${incompleto ? 'has-validation-error' : ''}`} key={estudiante.id}>
                          <div className="rubrica-estudiante-control-heading">
                            <div>
                              <span>Estudiante {String.fromCharCode(65 + studentIndex)}</span>
                              <strong>{nombre}</strong>
                            </div>
                            {cerrado && <InsigniaEstado tono="success"><LockKeyhole size={14} /> Finalizada</InsigniaEstado>}
                          </div>

                          <div className="calificacion-control">
                            <label htmlFor={inputId}>Calificación de {nombre}</label>
                            <div className="calificacion-input-wrap">
                              <input
                                className="calificacion-input"
                                id={inputId}
                                name={`${estudiante.id}-${indicador.id}`}
                                type="number"
                                min="0"
                                max={indicador.maximo}
                                step="0.01"
                                inputMode="decimal"
                                value={valor}
                                readOnly={cerrado}
                                aria-invalid={incompleto || undefined}
                                aria-describedby={`${helpId}${incompleto ? ` ${errorId}` : ''}`}
                                onChange={(evento) => alCambiarCalificacion(estudiante.id, indicador.id, evento.target.value, indicador.maximo)}
                              />
                              <span aria-hidden="true">/ {formatearCalificacion(indicador.maximo)}</span>
                            </div>
                            <span className="sr-only" id={helpId}>Máximo {formatearCalificacion(indicador.maximo)} puntos para el indicador {indicador.etiqueta}</span>
                            {incompleto && <span className="calificacion-error" id={errorId}>Ingrese una calificación, incluso si es cero.</span>}
                            {!cerrado && (
                              <button
                                type="button"
                                className="button button-outline button-sm calificacion-max-button"
                                title={`Asignar máximo a ${nombre}: ${formatearCalificacion(indicador.maximo)} puntos`}
                                onClick={() => alCambiarCalificacion(estudiante.id, indicador.id, indicador.maximo, indicador.maximo)}
                              >
                                Máx
                              </button>
                            )}
                          </div>

                          <div className="criterion-note">
                            <label htmlFor={observationId}>Observación de {nombre} <span>(opcional)</span></label>
                            <textarea
                              className="textarea"
                              id={observationId}
                              value={formulario.observaciones?.[indicador.id] ?? ''}
                              readOnly={cerrado}
                              rows="2"
                              placeholder={cerrado ? 'Sin observaciones' : `Observación para ${estudiante.nombres}`}
                              onChange={(evento) => alCambiarObservacion(estudiante.id, indicador.id, evento.target.value)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>

            <div className="rubrica-comparativa-subtotales" aria-label={`Subtotales de la categoría ${categoria.codigo}`}>
              {estudiantes.map((estudiante, studentIndex) => (
                <div key={estudiante.id}>
                  <span>Estudiante {String.fromCharCode(65 + studentIndex)} · {estudiante.nombres}</span>
                  <strong>{formatearCalificacion(calificacionCategoria(formularios[estudiante.id]?.calificaciones ?? {}, categoria))} / {formatearCalificacion(categoria.maximo)}</strong>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
