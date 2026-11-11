export const LIMITE_TRABAJOS_PREDETERMINADO = 25;
export const LIMITE_TRABAJOS_MAXIMO = 100;
export const TODOS_LOS_PERIODOS = 'TODOS';

/** Igual que el buscador del frontend: sin tildes y en minúsculas. */
export function normalizarBusqueda(texto: string | null | undefined): string | null {
  const limpio = String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
  return limpio || null;
}

export function leerPaginacion(
  limite?: string,
  pagina?: string,
  { predeterminado = LIMITE_TRABAJOS_PREDETERMINADO, maximo = LIMITE_TRABAJOS_MAXIMO } = {},
): { limite: number; pagina: number; desplazamiento: number } {
  const limiteLeido = Number(limite ?? predeterminado);
  const paginaLeida = Number(pagina ?? 1);
  const limiteValido = Math.min(maximo, Math.max(1, Number.isFinite(limiteLeido) ? Math.trunc(limiteLeido) : predeterminado));
  const paginaValida = Math.max(1, Number.isFinite(paginaLeida) ? Math.trunc(paginaLeida) : 1);
  return { limite: limiteValido, pagina: paginaValida, desplazamiento: (paginaValida - 1) * limiteValido };
}

/** Periodo que se filtra: el pedido, o el activo más reciente; `null` significa todos. */
export function periodoAplicado(
  solicitado: string | undefined,
  periodos: Array<{ codigo: string; activo: boolean }>,
): string | null {
  if (solicitado === TODOS_LOS_PERIODOS) return null;
  if (solicitado) return solicitado;
  return periodos.find(({ activo }) => activo)?.codigo ?? null;
}
