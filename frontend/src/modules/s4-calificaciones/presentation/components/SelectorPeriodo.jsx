/** Periodos académicos que entrega el servidor; el activo se marca como actual. */
export function SelectorPeriodo({ id, valor, periodos = [], alCambiar }) {
  const incluido = valor === 'TODOS' || periodos.some(({ codigo }) => codigo === valor);
  return (
    <select id={id} className="select" value={valor} onChange={(evento) => alCambiar(evento.target.value)}>
      <option value="TODOS">Todos</option>
      {!incluido && <option value={valor}>{valor}</option>}
      {periodos.map(({ codigo, activo }) => <option key={codigo} value={codigo}>{activo ? `${codigo} (actual)` : codigo}</option>)}
    </select>
  );
}
