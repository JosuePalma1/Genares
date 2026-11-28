import { useEffect, useState } from 'react';
import { DialogoGenares } from './dialogos';
import { getJsonApi } from '../services/clienteHttp';

const MENSAJES_PREVISION = {
  SIN_CORRESPONDENCIA: 'La carrera o el período no tiene un código habilitado para emitir actas.',
  CONTADOR_NO_DISPONIBLE: 'El contador requiere revisión antes de prever el próximo código.',
};

export default function NumeracionActas({ carreras, periodos }) {
  const [carreraElegida, setCarreraElegida] = useState('');
  const [periodoElegido, setPeriodoElegido] = useState('');
  const [revision, setRevision] = useState(0);
  const [consulta, setConsulta] = useState(null);
  const carreraId = carreraElegida || carreras[0]?.id;
  const periodoId = periodoElegido || (periodos.find(({ activo }) => activo) ?? periodos[0])?.id;
  const clave = carreraId && periodoId ? `${carreraId}/${periodoId}/${revision}` : null;
  const actual = consulta?.clave === clave ? consulta : null;
  const cargando = Boolean(clave && !actual);

  useEffect(() => {
    if (!clave) return undefined;
    const controlador = new AbortController();
    const { signal } = controlador;
    getJsonApi(`/configuracion-general/numeracion-actas/${carreraId}/${periodoId}`, { signal })
      .then((datos) => {
        if (!signal.aborted) setConsulta({ clave, datos });
      })
      .catch((error) => {
        if (signal.aborted) return;
        setConsulta({ clave, error: true });
        void DialogoGenares.fire({
          icon: 'error',
          title: 'No se pudo consultar la numeración',
          text: error.message,
        });
      });
    return () => controlador.abort();
  }, [carreraId, periodoId, clave]);

  return (
    <section className="card" aria-labelledby="nombre-actas">
      <h2 id="nombre-actas">Nombre de las actas</h2>
      {clave ? (
        <>
          <div className="config-ambito">
            <label>
              Carrera
              <select value={carreraId} onChange={(e) => setCarreraElegida(e.target.value)}>
                {carreras.map(({ id, nombre }) => <option key={id} value={id}>{nombre}</option>)}
              </select>
            </label>
            <label>
              Período académico
              <select value={periodoId} onChange={(e) => setPeriodoElegido(e.target.value)}>
                {periodos.map(({ id, nombre, activo }) => (
                  <option key={id} value={id}>{nombre}{activo ? ' (activo)' : ''}</option>
                ))}
              </select>
            </label>
          </div>
          <div aria-live="polite">
            {cargando && <p>Consultando numeración…</p>}
            {actual?.error && <p>No se pudo cargar la numeración.</p>}
            {actual?.datos && (
              <dl className="config-numeracion-actas">
                <div>
                  <dt>Último número emitido</dt>
                  <dd>{actual.datos.ultimoEmitido ? <code>{actual.datos.ultimoEmitido}</code> : 'Sin actas emitidas'}</dd>
                </div>
                <div>
                  <dt>Siguiente número previsto</dt>
                  <dd>{actual.datos.siguientePrevisto
                    ? <code>{actual.datos.siguientePrevisto}</code>
                    : MENSAJES_PREVISION[actual.datos.motivoSinPrevision] ?? 'Previsión no disponible'}</dd>
                </div>
              </dl>
            )}
          </div>
          <p>El número se asigna al emitir el acta.</p>
          <button type="button" disabled={cargando} onClick={() => setRevision((anterior) => anterior + 1)}>
            {actual?.error ? 'Reintentar consulta' : 'Actualizar numeración'}
          </button>
        </>
      ) : <p>{carreras.length ? 'No hay períodos académicos para consultar.' : 'Tu perfil no tiene carreras habilitadas para esta consulta.'}</p>}
    </section>
  );
}
