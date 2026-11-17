/** Quita lo que Windows, macOS o Linux no admiten en un nombre de archivo y junta las piezas con « - ». */
export function nombreArchivoPdf(...partes: Array<string | null | undefined>): string {
  const limpio = partes
    .map((parte) => (parte ?? '').replace(/[\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' - ')
    .slice(0, 150)
    .trim();
  return `${limpio || 'documento'}.pdf`;
}

/**
 * Cabecera Content-Disposition con el nombre completo (tildes y ñ incluidas, RFC 5987) y una copia
 * solo ASCII para clientes antiguos.
 */
export function dispositionPdf(nombre: string): string {
  const ascii = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
